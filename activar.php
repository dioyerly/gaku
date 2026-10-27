<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';
/* Activación de la versión en un archivo HTML (pago único). La llama el archivo desde el dispositivo del cliente.
   a = activate (registra el dispositivo, máx. 3) · check (revalida) · release (libera este dispositivo) */
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *'); header('Access-Control-Allow-Methods: POST, OPTIONS'); header('Access-Control-Allow-Headers: Content-Type'); header('Access-Control-Max-Age: 600');
function out(int $c, array $d): void { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') out(204, []);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(405, ['error' => 'POST']);
$raw = file_get_contents('php://input', false, null, 0, 4097); $j = json_decode((string)$raw, true);
if (!is_array($j)) out(400, ['error' => 'bad_json', 'message' => 'Datos inválidos']);
$a = (string)($j['a'] ?? ''); $k = (string)($j['k'] ?? ''); $d = (string)($j['d'] ?? ''); $l = trim((string)($j['l'] ?? ''));
if (!in_array($a, ['activate', 'check', 'release'], true)) out(400, ['error' => 'bad_action', 'message' => 'Acción inválida']);
$lim = $a === 'activate' ? 15 : 60;
if (!rate_hit('act:' . client_ip(), $lim, 900) || !rate_hit('actk:' . strtoupper($k), $lim, 900)) out(429, ['error' => 'rate', 'message' => 'Demasiados intentos. Esperá unos minutos.']);
try {
  if ($a === 'release') { Billing::release($k, $d); Billing::audit('licencia', 'release', substr($k, 0, 9) . '…'); out(200, ['ok' => true]); }
  [$ok, $res] = Billing::activate($k, $d, $l, $a === 'activate');
  if ($ok) Billing::audit('licencia', $a, substr($k, 0, 9) . '… ' . substr($d, 0, 8));
  out($ok ? 200 : 403, $res);
} catch (Throwable $e) { error_log('activar: ' . $e->getMessage()); out(500, ['error' => 'server', 'message' => 'No pudimos validar la licencia ahora. Probá más tarde.']); }
