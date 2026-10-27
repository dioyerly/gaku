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

// Validar token
$token = (string)cfg('centro.export_token', '');
if ($token === '' || strlen($token) < 32) {
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

if (!hash_equals($token, $bearerToken)) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

// Validar view
$view = (string)($_GET['view'] ?? '');
if ($view !== 'summary') {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'view_not_implemented']);
    exit;
}

// Procesar summary
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    $result = [];
    $now = time();

    // Cuentas totales
    $cuentas_total = (int)(one('SELECT COUNT(*) c FROM users')['c'] ?? 0);
    $result['cuentas_total'] = $cuentas_total;

    // Con acceso activo
    $con_acceso = 0;
    $users = all('SELECT id FROM users');
    foreach ($users as $u) {
        $access = Billing::accessForUser((int)$u['id']);
        if ($access['state'] === 'active') $con_acceso++;
    }
    $result['con_acceso'] = $con_acceso;

    // Suscripciones pagando (authorized, no período de prueba)
    $pagando = (int)(one(
        'SELECT COUNT(*) c FROM subscriptions WHERE status = ? AND next_charge <= ?',
        ['authorized', $now]
    )['c'] ?? 0);
    $result['pagando'] = $pagando;

    // En período de prueba (últimos 30 días de creación, si están authorized)
    $prueba_limit = $now - 30 * 86400;
    $en_prueba = (int)(one(
        'SELECT COUNT(*) c FROM subscriptions WHERE status = ? AND created > ?',
        ['authorized', $prueba_limit]
    )['c'] ?? 0);
    $result['en_prueba'] = $en_prueba;

    // Gracia o cortesía (no existe ese concepto claro en schema)
    $result['gracia'] = 0;

    // Solo lectura (suscripciones vencidas, status != authorized)
    $solo_lectura = (int)(one(
        'SELECT COUNT(*) c FROM subscriptions WHERE status != ? AND status != ?',
        ['authorized', 'pending']
    )['c'] ?? 0);
    $result['solo_lectura'] = $solo_lectura;

    // Bloqueados (no existe estado de bloqueo explícito en schema)
    $result['bloqueados'] = 0;

    // Suscripciones iniciadas en últimos 30 días
    $treinta_dias = $now - 30 * 86400;
    $suscripciones_30d = (int)(one(
        'SELECT COUNT(*) c FROM subscriptions WHERE created > ?',
        [$treinta_dias]
    )['c'] ?? 0);
    $result['suscripciones_iniciadas_30d'] = $suscripciones_30d;

    // Fecha generada en ISO 8601
    $result['generado'] = date('c');

    http_response_code(200);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    error_log('export.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'internal']);
}
