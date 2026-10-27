<?php
// Disparador por URL para hostings sin cron: cron.php?token=CLAVE (definila en config.php → cron_token)
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/Mailer.php';
require __DIR__ . '/lib/Reminders.php';
header('Content-Type: application/json; charset=utf-8');
$tok = (string)cfg('cron_token', '');
if ($tok === '' || !hash_equals($tok, (string)($_GET['token'] ?? ''))) { http_response_code(403); echo '{"error":"forbidden"}'; exit; }
echo json_encode(Reminders::run());
