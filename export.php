<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';

// Solo GET permitido
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

// Validar token (leer hash desde base de datos)
$tokenHashRow = one('SELECT v FROM meta WHERE k=?', ['centro_token_hash']);
$tokenHash = $tokenHashRow ? (string)$tokenHashRow['v'] : '';

if ($tokenHash === '') {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'not_configured']);
    exit;
}

$auth = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
$bearerToken = '';
if (preg_match('/^Bearer\s+(\S+)$/', $auth, $m)) {
    $bearerToken = $m[1];
}

// Hashear el token que viene y comparar
$receivedHash = hash('sha256', $bearerToken);
if (!hash_equals($tokenHash, $receivedHash)) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

// Validar view
$views = ['summary', 'events', 'customers', 'pagos', 'sistema'];
$view = (string)($_GET['view'] ?? '');
if (!in_array($view, $views, true)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'view_not_implemented']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$fd = fn($t, string $f) => $t ? date($f, (int)$t) : null;
$out = static function (array $data): void {
    http_response_code(200);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
};

try {
    $now = time();

    if ($view === 'events') {
        $out(['events' => []]);
        exit;
    }

    if ($view === 'customers') {
        $rows = [];
        foreach (all('SELECT * FROM users ORDER BY id DESC') as $u) {
            $a = Billing::accessForUser((int)$u['id']);
            $sub = $a['sub'] ?? null;
            if ($a['state'] === 'blocked') $cat = 'bloqueado';
            elseif ($a['state'] === 'readonly') $cat = 'solo_lectura';
            elseif ($a['kind'] === 'trial') $cat = 'prueba';
            elseif ($a['kind'] === 'paid') $cat = 'pago';
            else $cat = 'manual';
            $monto = 0;
            if ($sub) {
                $p = one('SELECT amount_cent FROM payments WHERE preapproval_id=? AND status="processed" ORDER BY COALESCE(debit_date, updated) DESC LIMIT 1', [$sub['preapproval_id']]);
                $monto = $p ? (int)$p['amount_cent'] : 0;
            }
            $ov = (string)$u['access_override'];
            $rows[] = [
                'id' => (int)$u['id'],
                'nombre' => $u['name'] !== '' ? $u['name'] : $u['email'],
                'email' => $u['email'],
                'categoria' => $cat,
                'estado' => $sub ? (string)$sub['status'] : 'sin_suscripcion',
                'override' => in_array($ov, ['activo', 'bloqueado'], true) ? $ov : null,
                'motivo' => $a['reason'] !== '' ? $a['reason'] : null,
                'alta' => $fd($u['created_at'], 'Y-m-d'),
                'ultimo_ingreso' => $fd($u['last_login'], 'Y-m-d'),
                'ultimo_pago' => $fd($a['last_paid'] ?? null, 'Y-m-d H:i:s'),
                'monto_cent' => $monto,
                'moneda' => 'ARS',
                'vence' => $fd($a['until'] ?? null, 'Y-m-d'),
            ];
        }
        $out(['customers' => $rows]);
        exit;
    }

    if ($view === 'pagos') {
        $sin = [];
        foreach (all('SELECT * FROM subscriptions WHERE user_id IS NULL AND preapproval_id NOT LIKE "manual-%" ORDER BY id DESC LIMIT 50') as $s) {
            $sin[] = [
                'email_pago' => $s['payer_email'] !== '' ? $s['payer_email'] : null,
                'estado' => (string)$s['status'],
                'creada' => $fd($s['created'], 'Y-m-d H:i:s'),
                'link_alta' => $s['status'] === 'authorized' ? Billing::appUrl() . '/alta.php?pid=' . rawurlencode((string)$s['preapproval_id']) : null,
            ];
        }
        $cuotas = [];
        foreach (all('SELECT p.*, u.email FROM payments p LEFT JOIN subscriptions s ON s.preapproval_id=p.preapproval_id LEFT JOIN users u ON u.id=s.user_id ORDER BY p.id DESC LIMIT 50') as $p) {
            $cuotas[] = [
                'fecha' => $fd($p['debit_date'] ?: $p['created'], 'Y-m-d H:i:s'),
                'email' => $p['email'] !== null ? (string)$p['email'] : null,
                'estado' => (string)$p['status'],
                'reintento' => (int)$p['retry'],
                'monto_cent' => (int)$p['amount_cent'],
                'moneda' => (string)$p['currency'],
                'detalle' => $p['detail'] !== '' ? (string)$p['detail'] : null,
            ];
        }
        $out(['sin_cuenta' => $sin, 'cuotas' => $cuotas]);
        exit;
    }

    if ($view === 'sistema') {
        $ultMp = one('SELECT MAX(received) m FROM mp_events')['m'] ?? null;
        $ultLand = one('SELECT MAX(ts) m FROM landing_events')['m'] ?? null;
        $err24 = (int)(one('SELECT COUNT(*) c FROM mp_events WHERE received>? AND result="error"', [$now - 86400])['c'] ?? 0);
        $notif = [];
        foreach (all('SELECT * FROM mp_events ORDER BY id DESC LIMIT 40') as $e) {
            $notif[] = [
                'recibido' => $fd($e['received'], 'Y-m-d H:i:s'),
                'topic' => $e['topic'],
                'data_id' => $e['data_id'],
                'firma_ok' => (bool)$e['sig_ok'],
                'resultado' => $e['result'],
                'detalle' => $e['detail'],
            ];
        }
        $aud = [];
        foreach (all('SELECT * FROM audit ORDER BY id DESC LIMIT 40') as $e) {
            $aud[] = ['ts' => $fd($e['ts'], 'Y-m-d H:i:s'), 'actor' => $e['actor'], 'accion' => $e['action'], 'detalle' => $e['detail']];
        }
        $out([
            'diagnostico' => [
                'mp_token_cargado' => (string)cfg('mp.access_token') !== '',
                'webhook_secret_cargado' => (string)cfg('mp.webhook_secret') !== '',
                'link_suscripcion_ok' => (bool)preg_match('~^https://[^\s]+$~', (string)cfg('mp.plan_url')),
                'https_ok' => strpos(Billing::appUrl(), 'https://') === 0,
                'mail_real' => Mailer::configured(),
            ],
            'ultima_notificacion_mp' => $fd($ultMp, 'Y-m-d H:i:s'),
            'notificaciones_error_24h' => $err24,
            'landing_ultimo_evento' => $fd($ultLand, 'Y-m-d H:i:s'),
            'notificaciones' => $notif,
            'auditoria' => $aud,
        ]);
        exit;
    }

    // summary
    $result = [];

    $result['cuentas_total'] = (int)(one('SELECT COUNT(*) c FROM users')['c'] ?? 0);

    $con_acceso = 0;
    foreach (all('SELECT id FROM users') as $u) {
        $access = Billing::accessForUser((int)$u['id']);
        if ($access['state'] === 'active') $con_acceso++;
    }
    $result['con_acceso'] = $con_acceso;

    $result['pagando'] = (int)(one(
        'SELECT COUNT(*) c FROM subscriptions WHERE status = ? AND next_charge <= ?',
        ['authorized', $now]
    )['c'] ?? 0);

    $result['en_prueba'] = (int)(one(
        'SELECT COUNT(*) c FROM subscriptions WHERE status = ? AND created > ?',
        ['authorized', $now - 30 * 86400]
    )['c'] ?? 0);

    $result['gracia'] = 0;

    $result['solo_lectura'] = (int)(one(
        'SELECT COUNT(*) c FROM subscriptions WHERE status != ? AND status != ?',
        ['authorized', 'pending']
    )['c'] ?? 0);

    $result['bloqueados'] = 0;

    $result['suscripciones_iniciadas_30d'] = (int)(one(
        'SELECT COUNT(*) c FROM subscriptions WHERE created > ?',
        [$now - 30 * 86400]
    )['c'] ?? 0);

    $result['generado'] = date('c');

    $out($result);
} catch (Throwable $e) {
    error_log('export.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'internal']);
}
