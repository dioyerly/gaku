<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';

// Solo GET (lectura) y POST (acciones del Centro)
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'POST') {
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

if ($method === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $reply = static function (int $code, array $data): void {
        http_response_code($code);
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    };
    if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) $reply(415, ['error' => 'json_required']);
    $raw = (string)file_get_contents('php://input', false, null, 0, 4097);
    if (strlen($raw) > 4096) $reply(413, ['error' => 'request_too_large']);
    $in = json_decode($raw, true);
    if (!is_array($in)) $reply(400, ['error' => 'invalid_request']);

    $accion = $in['accion'] ?? null;
    if (!is_string($accion)) $reply(400, ['error' => 'invalid_request']);
    if (!in_array($accion, ['crear_gracia', 'dar_gracia', 'quitar_gracia', 'set_acceso', 'link_clave'], true)) $reply(404, ['error' => 'action_not_implemented']);

    $bad = static function (string $m): never { throw new InvalidArgumentException($m); };
    $int = static function ($v, int $min, int $max, string $campo) use ($bad): int {
        if (!is_int($v) || $v < $min || $v > $max) $bad("El campo $campo no es válido.");
        return $v;
    };
    $txt = static function ($v, int $min, int $max, string $campo) use ($bad): string {
        if (!is_string($v)) $bad("El campo $campo no es válido.");
        $v = trim($v);
        if (mb_strlen($v) < $min || mb_strlen($v) > $max) $bad("El campo $campo no es válido.");
        return $v;
    };

    $pdo = null;
    try {
        $pdo = db();
        if ($accion === 'crear_gracia') {
            $nom = $txt($in['nombre'] ?? null, 1, 120, 'nombre');
            $em = strtolower($txt($in['email'] ?? null, 1, 190, 'email'));
            $dias = array_key_exists('dias', $in) ? $int($in['dias'], 1, 3650, 'dias') : 7;
            $mot = array_key_exists('motivo', $in) && $in['motivo'] !== null ? $txt($in['motivo'], 0, 80, 'motivo') : '';
            $mot = $mot ?: 'Cuenta de gracia';
            $cl = array_key_exists('clave', $in) && $in['clave'] !== null ? $txt($in['clave'], 0, 200, 'clave') : '';
            $gen = false;
            if ($cl === '') { $cl = substr(strtr(base64_encode(random_bytes(12)), '+/=', 'xyz'), 0, 12) . '7'; $gen = true; }
            if (!filter_var($em, FILTER_VALIDATE_EMAIL)) $bad('El email no es válido.');
            if (mb_strlen($nom) > 80) $bad('El nombre admite hasta 80 caracteres.');
            if (!$gen && mb_strlen($cl) < 8) $bad('La clave debe tener al menos 8 caracteres.');
            if (one('SELECT id FROM users WHERE email=?', [$em])) throw new RuntimeException('Ese email ya tiene una cuenta.');
            $pdo->beginTransaction(); $now = time(); $vence = $now + $dias * 86400;
            q('INSERT INTO users(email,pass_hash,name,email_verified,settings,created_at) VALUES(?,?,?,1,?,?)', [$em, password_hash($cl, PASSWORD_DEFAULT), $nom, '{}', $now]);
            $nid = (int)$pdo->lastInsertId();
            q('INSERT INTO subscriptions(preapproval_id,user_id,payer_email,status,reason,amount_cent,currency,period_days,next_charge,created,updated) VALUES(?,?,?,"authorized",?,0,"ARS",?,?,?,?)', ['manual-' . $nid . '-' . bin2hex(random_bytes(4)), $nid, $em, $mot, $dias, $vence, $now, $now]);
            $pdo->commit();
            Billing::audit('centro', 'centro_crear_gracia', "$em · $dias días · $mot");
            $reply(200, $gen ? ['ok' => true, 'clave_generada' => $cl] : ['ok' => true]);
        } elseif ($accion === 'dar_gracia') {
            $cid = $int($in['cuenta'] ?? null, 1, PHP_INT_MAX, 'cuenta');
            $dias = $int($in['dias'] ?? null, 1, 3650, 'dias');
            $c = one('SELECT * FROM users WHERE id=?', [$cid]); if (!$c) $bad('No existe esa cuenta.');
            if ((int)one('SELECT COUNT(*) c FROM subscriptions WHERE user_id=? AND preapproval_id NOT LIKE "manual-%" AND status="authorized"', [$cid])['c'] > 0) throw new RuntimeException('Esa cuenta ya tiene una suscripción activa en Mercado Pago.');
            $man = one('SELECT * FROM subscriptions WHERE user_id=? AND preapproval_id LIKE "manual-%" ORDER BY id DESC LIMIT 1', [$cid]); $now = time();
            if ($man) { $vence = max($now, (int)$man['next_charge']) + $dias * 86400; q('UPDATE subscriptions SET status="authorized", next_charge=?, period_days=?, updated=? WHERE id=?', [$vence, $dias, $now, $man['id']]); }
            else { $vence = $now + $dias * 86400; q('INSERT INTO subscriptions(preapproval_id,user_id,payer_email,status,reason,amount_cent,currency,period_days,next_charge,created,updated) VALUES(?,?,?,"authorized","Cuenta de gracia",0,"ARS",?,?,?,?)', ['manual-' . $cid . '-' . bin2hex(random_bytes(4)), $cid, $c['email'], $dias, $vence, $now, $now]); }
            Billing::audit('centro', 'centro_dar_gracia', $c['email'] . " · +$dias días");
            $reply(200, ['ok' => true, 'vence' => date('Y-m-d H:i:s', $vence)]);
        } elseif ($accion === 'quitar_gracia') {
            $cid = $int($in['cuenta'] ?? null, 1, PHP_INT_MAX, 'cuenta');
            q('UPDATE subscriptions SET status="cancelled", next_charge=?, updated=? WHERE user_id=? AND preapproval_id LIKE "manual-%"', [time() - 1, time(), $cid]);
            Billing::audit('centro', 'centro_quitar_gracia', "cuenta $cid");
            $reply(200, ['ok' => true]);
        } elseif ($accion === 'set_acceso') {
            $cid = $int($in['cuenta'] ?? null, 1, PHP_INT_MAX, 'cuenta');
            $valor = $in['valor'] ?? null;
            if (!is_string($valor) || !in_array($valor, ['auto', 'activo', 'bloqueado'], true)) $bad('El campo valor no es válido.');
            q('UPDATE users SET access_override=? WHERE id=?', [$valor, $cid]);
            Billing::audit('centro', 'centro_override', "cuenta $cid => $valor");
            $reply(200, ['ok' => true]);
        } else { // link_clave
            $cid = $int($in['cuenta'] ?? null, 1, PHP_INT_MAX, 'cuenta');
            $u = one('SELECT email FROM users WHERE id=?', [$cid]); if (!$u) $bad('No existe esa cuenta.');
            $tok = bin2hex(random_bytes(20));
            q('UPDATE users SET reset_token=?, reset_expires=? WHERE id=?', [hash('sha256', $tok), time() + 3600, $cid]);
            Billing::audit('centro', 'centro_link_clave', "cuenta $cid");
            $reply(200, ['ok' => true, 'link' => Billing::appUrl() . '/app.php#/restablecer/' . $tok]);
        }
    } catch (InvalidArgumentException $e) {
        if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
        $reply(400, ['error' => 'invalid_request', 'detalle' => $e->getMessage()]);
    } catch (PDOException $e) {
        if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
        error_log('export.php: ' . $e->getMessage());
        $reply(500, ['error' => 'internal']);
    } catch (RuntimeException $e) {
        if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
        $reply(409, ['error' => 'conflict', 'detalle' => $e->getMessage()]);
    } catch (Throwable $e) {
        if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
        error_log('export.php: ' . $e->getMessage());
        $reply(500, ['error' => 'internal']);
    }
    exit;
}

// Validar view
$views =['summary', 'events', 'customers', 'pagos', 'sistema'];
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

    // Landing (misma lógica que la pestaña Landing del panel admin)
    $rango = (int)($_GET['d'] ?? 30);
    if (!in_array($rango, [7, 30, 90], true)) $rango = 30;
    $desde = date('Y-m-d', $now - ($rango - 1) * 86400);
    $hoyD = date('Y-m-d', $now);
    $dias = [];
    for ($i = $rango - 1; $i >= 0; $i--) $dias[date('Y-m-d', $now - $i * 86400)] = ['dia' => date('Y-m-d', $now - $i * 86400), 'visitas' => 0, 'clicks' => 0, 'clicks_whatsapp' => 0];
    $tot = ['visitas' => 0, 'precio' => 0, 'clicks_suscribirme' => 0, 'clicks_whatsapp' => 0, 'clicks_app' => 0, 'scroll50' => 0, 'scroll90' => 0];
    $hoy = ['visitas' => 0, 'clicks' => 0];
    foreach (all('SELECT day, COUNT(DISTINCT IF(type="visita",visitor,NULL)) v, COUNT(DISTINCT IF(type="precio",visitor,NULL)) p, COUNT(DISTINCT IF(type="scroll50",visitor,NULL)) s5, COUNT(DISTINCT IF(type="scroll90",visitor,NULL)) s9, SUM(type="click_sub") cs, SUM(type="click_wa") cw, SUM(type="click_app") ca FROM landing_events WHERE day>=? GROUP BY day', [$desde]) as $r) {
        $d = (string)$r['day'];
        if (isset($dias[$d])) { $dias[$d]['visitas'] = (int)$r['v']; $dias[$d]['clicks'] = (int)$r['cs']; $dias[$d]['clicks_whatsapp'] = (int)$r['cw']; }
        $tot['visitas'] += (int)$r['v']; $tot['precio'] += (int)$r['p']; $tot['scroll50'] += (int)$r['s5']; $tot['scroll90'] += (int)$r['s9'];
        $tot['clicks_suscribirme'] += (int)$r['cs']; $tot['clicks_whatsapp'] += (int)$r['cw']; $tot['clicks_app'] += (int)$r['ca'];
        if ($d === $hoyD) { $hoy['visitas'] = (int)$r['v']; $hoy['clicks'] = (int)$r['cs']; }
    }
    $origen = [];
    foreach (all('SELECT IF(source="","directo",source) o, COUNT(DISTINCT IF(type="visita",CONCAT(day,visitor),NULL)) v, COUNT(DISTINCT IF(type IN ("click_sub","click_buy"),CONCAT(day,visitor),NULL)) c FROM landing_events WHERE day>=? GROUP BY o ORDER BY v DESC, c DESC LIMIT 12', [$desde]) as $r) {
        $origen[] = ['origen' => (string)$r['o'], 'visitas' => (int)$r['v'], 'clicks' => (int)$r['c']];
    }
    $disp = [];
    foreach (all('SELECT device d, COUNT(DISTINCT IF(type="visita",CONCAT(day,visitor),NULL)) v, COUNT(DISTINCT IF(type IN ("click_sub","click_buy"),CONCAT(day,visitor),NULL)) c FROM landing_events WHERE day>=? AND device<>"" GROUP BY d ORDER BY v DESC', [$desde]) as $r) {
        $disp[] = ['dispositivo' => (string)$r['d'], 'visitas' => (int)$r['v'], 'clicks' => (int)$r['c']];
    }
    $boton = [];
    foreach (all('SELECT type t, IF(detail="","—",detail) b, COUNT(*) c FROM landing_events WHERE day>=? AND type IN ("click_sub","click_buy") GROUP BY t, b ORDER BY c DESC', [$desde]) as $r) {
        $boton[] = ['tipo' => (string)$r['t'], 'boton' => (string)$r['b'], 'clicks' => (int)$r['c']];
    }
    $ult = one('SELECT MAX(ts) m FROM landing_events');
    $result['landing'] = [
        'tiene_datos' => one('SELECT id FROM landing_events LIMIT 1') !== null,
        'totales' => $tot,
        'hoy' => $hoy,
        'por_dia' => array_values($dias),
        'origen' => $origen,
        'dispositivo' => $disp,
        'boton' => $boton,
        'ultimo_evento' => $ult && $ult['m'] ? date('Y-m-d H:i:s', (int)$ult['m']) : null,
    ];

    $result['generado'] = date('c');

    $out($result);
} catch (Throwable $e) {
    error_log('export.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'internal']);
}
