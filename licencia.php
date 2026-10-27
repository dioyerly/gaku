<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';
/* Recuperar la licencia: se reenvía al mail de la compra. La respuesta es siempre la misma (no revela si el mail existe). */
session_name('gk_lic'); session_set_cookie_params(['path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]); session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
$msg = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  $e = strtolower(trim((string)($_POST['email'] ?? '')));
  if (!hash_equals((string)$_SESSION['csrf'], (string)($_POST['csrf'] ?? ''))) $msg = '<div class="e">La sesión venció. Recargá la página.</div>';
  elseif (!rate_hit('lic:' . client_ip(), 6, 3600)) $msg = '<div class="e">Demasiados intentos. Probá más tarde.</div>';
  else {
    if (filter_var($e, FILTER_VALIDATE_EMAIL) && rate_hit('licm:' . $e, 3, 3600)) foreach (all('SELECT id FROM licenses WHERE email=? AND status="active"', [$e]) as $l) Billing::mailLicense((int)$l['id']);
    $msg = '<div class="o">Si ese correo tiene una licencia, te la enviamos ahora. Revisá también spam.</div>';
  }
}
gk_page('Recuperar licencia', '<h1>Recuperar mi licencia</h1><p>Escribí el correo con el que compraste y te reenviamos la clave y el link de descarga.</p>' . $msg
  . '<form method="post" action="licencia.php"><input type="hidden" name="csrf" value="' . gk_esc($_SESSION['csrf']) . '"><label for="e">Correo de la compra</label><input id="e" name="email" type="email" required maxlength="190" autocomplete="email"><button type="submit">Enviarme la licencia</button></form>' . gk_ayuda());
