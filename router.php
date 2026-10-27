<?php
// Servidor de desarrollo: php -S localhost:8080 router.php
$p = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/(storage|lib|bin|tests|src|config\.php|config\.sample\.php)#', $p) || preg_match('#\.(sql|md|py|sh)$#', $p)) { http_response_code(404); exit; }
if ($p === '/' || $p === '') { readfile(__DIR__ . '/index.html'); return true; }
return false;
