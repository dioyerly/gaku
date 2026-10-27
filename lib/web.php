<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/Mailer.php';
require_once __DIR__ . '/Billing.php';
require_once __DIR__ . '/Page.php';
function gk_wa(): string { return preg_replace('/\D/', '', (string)cfg('contact.whatsapp', '')); }
function gk_ayuda(): string { $w = gk_wa(); return $w !== '' ? '<p class="m">¿Necesitás ayuda? <a href="https://wa.me/' . gk_esc($w) . '">Escribinos por WhatsApp</a>.</p>' : ''; }
