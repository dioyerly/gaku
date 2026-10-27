<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';
/* Entrega el archivo HTML de Gaku solo a quien tiene una licencia activa. */
$k = (string)($_GET['k'] ?? '');
if (!rate_hit('dl:' . client_ip(), 20, 3600)) gk_page('Demasiados intentos', '<h1>Demasiados intentos</h1><div class="e">Probá más tarde.</div>', 429);
$l = Billing::licenseByKey($k);
if (!$l || $l['status'] !== 'active') gk_page('Licencia no válida', '<h1>Licencia no válida</h1><div class="e">No encontramos una licencia activa con esa clave.</div><p class="m"><a href="licencia.php">Recuperar mi licencia</a></p>' . gk_ayuda(), 404);
$tpl = @file_get_contents(__DIR__ . '/lib/local-template.html');
if ($tpl === false) gk_page('No disponible', '<h1>Archivo no disponible</h1><div class="e">Falta el archivo base en el servidor.</div>' . gk_ayuda(), 500);
$rep = [
  '__GAKU_PUBKEY__' => json_encode(Billing::publicJwk()),
  '__GAKU_API__' => Billing::appUrl() . '/activar.php',
  '__GAKU_PLAN__' => Billing::appUrl() . '/index.html#precio',
  '__GAKU_WA__' => gk_wa(),
  '__GAKU_RECHECK__' => (string)((int)cfg('once.recheck_days', 7) * 86400),
  '__GAKU_BUILD__' => date('Ymd'),
];
$out = strtr($tpl, $rep);
header('Content-Type: text/html; charset=utf-8'); header('Content-Disposition: attachment; filename="Gaku.html"'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
echo $out;
