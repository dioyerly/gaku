<?php
declare(strict_types=1);

define('ROOT', dirname(__DIR__));
define('STORAGE', ROOT . '/storage');

function cfg(?string $path = null, $default = null)
{
    static $c = null;
    if ($c === null) {
        $base = require ROOT . '/config.sample.php';
        $f = getenv('GAKU_CONFIG') ?: ROOT . '/config.php';
        $local = is_file($f) ? require $f : [];
        $c = array_replace_recursive($base, is_array($local) ? $local : []);
        foreach (['GAKU_APP_URL' => 'app_url', 'GAKU_CRON_TOKEN' => 'cron_token'] as $env => $k) {
            if (($v = getenv($env)) !== false && $v !== '') $c[$k] = $v;
        }
        foreach (['host' => 'GAKU_DB_HOST', 'name' => 'GAKU_DB_NAME', 'user' => 'GAKU_DB_USER', 'pass' => 'GAKU_DB_PASS'] as $k => $env) {
            if (($v = getenv($env)) !== false && $v !== '') $c['db'][$k] = $v;
        }
        foreach (['host' => 'GAKU_SMTP_HOST', 'port' => 'GAKU_SMTP_PORT', 'secure' => 'GAKU_SMTP_SECURE', 'user' => 'GAKU_SMTP_USER', 'pass' => 'GAKU_SMTP_PASS', 'from' => 'GAKU_SMTP_FROM'] as $k => $env) {
            if (($v = getenv($env)) !== false && $v !== '') $c['mail'][$k] = $k === 'port' ? (int)$v : $v;
        }
        if (($v = getenv('GAKU_MP_API')) !== false && $v !== '') $c['mp']['api_base'] = $v;
    }
    if ($path === null) return $c;
    $cur = $c;
    foreach (explode('.', $path) as $p) {
        if (!is_array($cur) || !array_key_exists($p, $cur)) return $default;
        $cur = $cur[$p];
    }
    return $cur;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $d = cfg('db');
    $dsn = 'mysql:host=' . ($d['host'] ?: 'localhost') . ';dbname=' . $d['name'] . ';charset=utf8mb4';
    $pdo = new PDO($dsn, (string)$d['user'], (string)$d['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, time_zone='+00:00'",
    ]);
    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    static $done = false;
    if ($done) return;
    $done = true;
    $pdo->exec('CREATE TABLE IF NOT EXISTS meta (k VARCHAR(60) PRIMARY KEY, v TEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $v = (int)($pdo->query("SELECT v FROM meta WHERE k='schema'")->fetchColumn() ?: 0);
    if ($v >= 2) return;
    $sql = file_get_contents(ROOT . '/lib/schema.sql');
    foreach (array_filter(array_map('trim', explode(";\n", $sql))) as $stmt) $pdo->exec($stmt);
    $pdo->exec("REPLACE INTO meta(k,v) VALUES('schema','2')");
}

function now_ms(): int
{
    static $last = 0;
    $t = (int)floor(microtime(true) * 1000);
    if ($t <= $last) $t = $last + 1;
    return $last = $t;
}

function uid(int $n = 8): string
{
    return bin2hex(random_bytes($n));
}

function jdec(?string $s): array
{
    if ($s === null || $s === '') return [];
    $d = json_decode($s, true);
    return is_array($d) ? $d : [];
}

function jenc($v): string
{
    if (is_array($v) && !$v) return '{}';
    return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
}

function q(string $sql, array $p = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($p);
    return $st;
}

function one(string $sql, array $p = []): ?array
{
    $r = q($sql, $p)->fetch();
    return $r === false ? null : $r;
}

function all(string $sql, array $p = []): array
{
    return q($sql, $p)->fetchAll();
}

function rate_hit(string $bucket, int $limit, int $windowSec): bool
{
    // devuelve true si todavía está permitido (y registra el intento)
    $since = time() - $windowSec;
    q('DELETE FROM rate WHERE ts < ?', [time() - 86400]);
    $n = (int)q('SELECT COUNT(*) FROM rate WHERE bucket=? AND ts>=?', [$bucket, $since])->fetchColumn();
    if ($n >= $limit) return false;
    q('INSERT INTO rate(bucket, ts) VALUES(?,?)', [$bucket, time()]);
    return true;
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function valid_tz(?string $tz): bool
{
    return $tz && in_array($tz, DateTimeZone::listIdentifiers(), true);
}

/** Convierte "YYYY-MM-DDTHH:mm" (hora local de tz) a epoch UTC. */
function local_to_epoch(string $local, string $tz): ?int
{
    try {
        $z = new DateTimeZone(valid_tz($tz) ? $tz : 'UTC');
        $fmt = strlen($local) <= 10 ? 'Y-m-d H:i' : 'Y-m-d\TH:i';
        $s = strlen($local) <= 10 ? $local . ' 00:00' : substr($local, 0, 16);
        $d = DateTimeImmutable::createFromFormat($fmt, $s, $z);
        return $d ? $d->getTimestamp() : null;
    } catch (Throwable $e) {
        return null;
    }
}
