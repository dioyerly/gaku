<?php
// Programador: ejecutá cada 5 minutos →  */5 * * * * php /ruta/bin/cron.php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';
require dirname(__DIR__) . '/lib/Mailer.php';
require dirname(__DIR__) . '/lib/Reminders.php';
$r = Reminders::run((int)(getenv('MRE_NOW') ?: 0) ?: null);
echo json_encode($r, JSON_UNESCAPED_UNICODE), "\n";
