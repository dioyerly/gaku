<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';
/* Suscripción: pide el correo y manda al plan correcto.
   Si ese correo ya tuvo una suscripción de Mercado Pago, va al plan sin prueba.
   Si no, va al plan con prueba. */
$plan = (string)cfg('mp.plan_url');
$sin = (string)cfg('mp.plan_url_sin_prueba');
$esUrl = static fn(string $u): bool => (bool)preg_match('~^https://[^\s]+$~', $u);
if (!$esUrl($plan)) gk_page('Suscripción', '<h1>Suscripción</h1><div class="n">El link de suscripción todavía no está configurado.</div>' . gk_ayuda(), 503, "'self' https:");

$formulario = '<h1>Suscripción</h1><p>Escribí el correo que vas a usar en Mercado Pago.</p><form method="post" action="suscribir.php"><label for="e">Correo</label><input id="e" name="email" type="email" required maxlength="190" autocomplete="email"><button type="submit">Continuar</button></form>';

$email = strtolower(trim((string)($_POST['email'] ?? '')));
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || $email === '') gk_page('Suscripción', $formulario . gk_ayuda(), 200, "'self' https:");
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) gk_page('Suscripción', '<div class="e">Escribí un correo válido.</div>' . $formulario . gk_ayuda(), 422, "'self' https:");
if (!rate_hit('susc:' . client_ip(), 20, 3600)) gk_page('Suscripción', '<div class="e">Demasiados intentos. Probá más tarde.</div>' . gk_ayuda(), 429, "'self' https:");

$usado = one('SELECT id FROM subscriptions WHERE payer_email=? AND preapproval_id NOT LIKE "manual-%" LIMIT 1', [$email]);
if ($usado && !$esUrl($sin)) gk_page('Suscripción', '<div class="n">La suscripción todavía no está disponible para este correo. Escribinos por WhatsApp.</div>' . gk_ayuda(), 503, "'self' https:");

$destino = $usado ? $sin : $plan;
header('Location: ' . $destino, true, 302);
exit;
