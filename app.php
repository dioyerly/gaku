<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
header('X-Frame-Options: DENY'); header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: same-origin');
$brand = cfg('brand'); $v = max(@filemtime(__DIR__ . '/assets/app.js') ?: 1, @filemtime(__DIR__ . '/assets/app.css') ?: 1);
?><!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f4f7f8">
<meta name="mre-brand" content="<?= htmlspecialchars(json_encode($brand, JSON_UNESCAPED_UNICODE), ENT_QUOTES) ?>">
<title><?= htmlspecialchars((string)$brand['name']) ?></title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230f6b7d'/%3E%3Ctext x='16' y='23' font-size='20' font-weight='700' text-anchor='middle' fill='white' font-family='Georgia,serif'%3EG%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/app.css?v=<?= $v ?>">
</head>
<body>
<noscript><p style="padding:2rem">Esta aplicación necesita JavaScript.</p></noscript>
<div id="root"></div>
<script src="assets/app.js?v=<?= $v ?>"></script>
</body>
</html>
