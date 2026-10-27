<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';
/* Lleva al link del plan de suscripción de Mercado Pago (se configura en config.php → mp.plan_url). */
$u = (string)cfg('mp.plan_url');
if (!preg_match('~^https://[^\s]+$~', $u)) gk_page('Suscripción', '<h1>Suscripción</h1><div class="n">El link de suscripción todavía no está configurado.</div>' . gk_ayuda(), 503);
header('Location: ' . $u, true, 302); exit;
