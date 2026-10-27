<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';
/* Pago único: crea el pedido, una preferencia de Mercado Pago y manda al comprador a pagar. */
if (!rate_hit('buy:' . client_ip(), 12, 3600)) gk_page('Demasiados intentos', '<h1>Demasiados intentos</h1><div class="e">Esperá un rato y volvé a probar.</div>' . gk_ayuda(), 429);
try { $r = Billing::createOrder(); }
catch (Throwable $e) { error_log('comprar: ' . $e->getMessage()); gk_page('No pudimos iniciar el pago', '<h1>No pudimos iniciar el pago</h1><div class="e">Mercado Pago no respondió. Probá de nuevo en un minuto.</div><a class="b" href="index.html#precio">Volver</a>' . gk_ayuda(), 502); }
header('Location: ' . $r['url'], true, 302); exit;
