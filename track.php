<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';
/* Contador de la landing: visitas y clicks. Sin cookies, sin guardar la IP.
   El visitante es un código que cambia cada día (hash de IP + navegador + fecha). */
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
function fin(int $c): void { http_response_code($c); echo $c === 204 ? '' : '{"ok":false}'; exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fin(405);
$in = json_decode((string)file_get_contents('php://input', false, null, 0, 2048), true);
if (!is_array($in)) fin(400);
$TIPOS = ['visita', 'click_sub', 'click_buy', 'click_wa', 'click_app', 'click_demo', 'precio', 'demo', 'scroll50', 'scroll90'];
$tipo = (string)($in['t'] ?? ''); if (!in_array($tipo, $TIPOS, true)) fin(400);
$ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
if ($ua === '' || preg_match('~bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|uptime|headless|lighthouse|curl|wget|python|go-http|java/|okhttp~i', $ua)) fin(204);
$hoy = date('Y-m-d');
$vis = substr(hash_hmac('sha256', $hoy . '|' . client_ip() . '|' . $ua, (string)(cfg('mp.webhook_secret') ?: 'gaku') . '|track'), 0, 16);
$src = strtolower(trim((string)($in['u'] ?? '')));
if ($src === '') {
  $host = preg_replace('~^www\.~', '', strtolower((string)parse_url((string)($in['r'] ?? ''), PHP_URL_HOST)));
  $own = strtolower((string)parse_url((string)cfg('app_url'), PHP_URL_HOST));
  if ($host === '' || $host === $own) $src = '';
  elseif (preg_match('~instagram~', $host)) $src = 'instagram';
  elseif (preg_match('~facebook|fb\.com|fb\.me|messenger~', $host)) $src = 'facebook';
  elseif (preg_match('~google~', $host)) $src = 'google';
  elseif (preg_match('~whatsapp|wa\.me~', $host)) $src = 'whatsapp';
  elseif (preg_match('~tiktok~', $host)) $src = 'tiktok';
  elseif (preg_match('~(^|\.)t\.co$|twitter|(^|\.)x\.com$~', $host)) $src = 'x';
  else $src = $host;
}
$src = substr((string)preg_replace('~[^a-z0-9._\- ]~', '', $src), 0, 60);
$camp = substr((string)preg_replace('~[^a-zA-Z0-9._\- ]~', '', (string)($in['c'] ?? '')), 0, 60);
$w = (int)($in['w'] ?? 0); $dev = $w > 0 && $w < 760 ? 'movil' : ($w > 0 && $w < 1100 ? 'tablet' : 'pc');
$det = substr((string)preg_replace('~[^a-zA-Z0-9._\- ]~', '', (string)($in['d'] ?? '')), 0, 40);
try {
  $n = (int)one('SELECT COUNT(*) c FROM landing_events WHERE visitor=? AND day=? AND ts>?', [$vis, $hoy, time() - 600])['c'];
  if ($n >= 80) fin(204);
  q('INSERT INTO landing_events(ts,day,type,visitor,source,campaign,device,detail) VALUES(?,?,?,?,?,?,?,?)', [time(), $hoy, $tipo, $vis, $src, $camp, $dev, $det]);
  if (random_int(1, 300) === 1) q('DELETE FROM landing_events WHERE day < ?', [date('Y-m-d', time() - 400 * 86400)]);
} catch (Throwable $e) { error_log('track: ' . $e->getMessage()); fin(204); }
fin(204);
