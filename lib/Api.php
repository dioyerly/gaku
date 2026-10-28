<?php
declare(strict_types=1);

require_once __DIR__ . '/Mailer.php';
require_once __DIR__ . '/Billing.php';
require_once __DIR__ . '/Reminders.php';

final class HttpError extends Exception
{
    public function __construct(public int $status, string $msg, public string $codeName = 'error', public array $extra = [])
    {
        parent::__construct($msg);
    }
}

final class Api
{
    /** Tipos de registro y quién puede escribirlos. */
    public const TYPES = ['period', 'subject', 'teacher', 'slot', 'exception', 'task', 'exam', 'note', 'material', 'event', 'session', 'quiz', 'question', 'help', 'bag', 'plan'];
    /** Tipos que un estudiante con acceso propio puede crear y editar (lo suyo). */
    public const STUDENT_WRITE = ['task', 'material', 'note', 'quiz', 'question', 'help', 'bag', 'session', 'plan'];
    /** Campos que un estudiante puede cambiar en registros ajenos (marcar avances). */
    public const STUDENT_PATCH = [
        'task' => ['status', 'steps', 'statusBy', 'doneAt'],
        'material' => ['status', 'log', 'statusBy'],
        'exam' => ['topics', 'prep'],
        'session' => ['done'],
        'help' => [],
    ];
    public const SETTINGS_KEYS = ['theme', 'mode', 'textSize', 'hour12', 'weekStart', 'tz', 'notif', 'activeStudent', 'view'];

    private static ?array $user = null;
    private static ?array $member = null;

    // ---------------------------------------------------------------- núcleo
    public static function handle(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: same-origin');
        try {
            self::session();
            $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
            $path = trim((string)($_GET['r'] ?? ''), '/');
            $parts = $path === '' ? [] : explode('/', $path);
            if ($method !== 'GET' && $method !== 'HEAD') self::csrf();
            self::gate($method, $parts);
            $res = self::route($method, $parts);
            if ($res !== null) echo jenc($res);
        } catch (HttpError $e) {
            http_response_code($e->status);
            echo jenc(['error' => $e->codeName, 'message' => $e->getMessage()] + $e->extra);
        } catch (Throwable $e) {
            error_log('[api] ' . $e->getMessage() . ' @' . $e->getFile() . ':' . $e->getLine());
            http_response_code(500);
            echo jenc(['error' => 'server', 'message' => 'Algo salió mal en el servidor. Probá de nuevo.']);
        }
    }

    /** Acceso por pago: bloqueado => afuera; solo lectura => se puede ver, no guardar. */
    public static ?array $access = null;
    private static function gate(string $method, array $parts): void
    {
        $uid = (int)($_SESSION['uid'] ?? 0);
        if (!$uid) return;
        $a = Billing::accessForUser($uid);
        self::$access = $a;
        $first = $parts[0] ?? '';
        if ($a['state'] === 'blocked' && !($first === 'auth' && ($parts[1] ?? '') === 'logout') && $first !== 'meta') {
            $_SESSION = []; session_regenerate_id(true); $_SESSION['csrf'] = bin2hex(random_bytes(16));
            throw new HttpError(401, 'Tu cuenta está bloqueada. Escribinos para resolverlo.', 'blocked');
        }
        if ($a['state'] === 'readonly' && $method !== 'GET' && $method !== 'HEAD' && $first !== 'auth' && $first !== 'meta' && $first !== 'subscription') {
            throw new HttpError(402, 'Tu suscripción no está al día: podés ver tus datos, pero no guardar cambios. Renovala para seguir.', 'readonly', ['access' => self::accessOut($a)]);
        }
    }

    public static function accessOut(?array $a): ?array
    {
        if (!$a) return null;
        return ['state' => $a['state'], 'kind' => $a['kind'], 'reason' => $a['reason'], 'until' => $a['until'], 'owner' => $a['owner'] ?? true, 'plan_url' => self::planUrl($a)];
    }

    private static function planUrl(?array $a): string
    {
        $sin = (string)cfg('mp.plan_url_sin_prueba');
        $real = !empty($a['sub']) && strpos((string)($a['sub']['preapproval_id'] ?? ''), 'manual-') !== 0;
        if ($real && preg_match('~^https://[^\s]+$~', $sin)) return $sin;
        return (string)cfg('mp.plan_url');
    }

    private static function session(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        $dir = STORAGE . '/sessions';
        if (!is_dir($dir)) @mkdir($dir, 0770, true);
        if (is_dir($dir) && is_writable($dir)) session_save_path($dir);
        $secure = !empty($_SERVER['HTTPS']) || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        ini_set('session.gc_maxlifetime', (string)(60 * 60 * 24 * 30));
        ini_set('session.use_strict_mode', '1');
        session_name('mre');
        session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 30, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
        session_start();
        if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }

    private static function csrf(): void
    {
        $t = $_SERVER['HTTP_X_CSRF'] ?? '';
        if (!is_string($t) || !hash_equals((string)($_SESSION['csrf'] ?? ''), $t)) {
            throw new HttpError(403, 'La sesión venció. Recargá la página.', 'csrf');
        }
    }

    private static function body(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') return [];
        if (strlen($raw) > 2_500_000) throw new HttpError(413, 'Contenido demasiado grande', 'too_big');
        $d = json_decode($raw, true);
        if (!is_array($d)) throw new HttpError(400, 'Datos inválidos', 'bad_json');
        return $d;
    }

    private static function route(string $m, array $p): ?array
    {
        $a = $p[0] ?? '';
        $b = $p[1] ?? null;
        $c = $p[2] ?? null;
        switch ($a) {
            case 'meta': return self::meta();
            case 'auth':
                return match (true) {
                    $m === 'POST' && $b === 'register' => self::register(),
                    $m === 'POST' && $b === 'login' => self::login(),
                    $m === 'POST' && $b === 'logout' => self::logout(),
                    $m === 'GET' && $b === 'me' => self::meInfo(),
                    $m === 'POST' && $b === 'verify' => self::verify(),
                    $m === 'POST' && $b === 'resend' => self::resend(),
                    $m === 'POST' && $b === 'forgot' => self::forgot(),
                    $m === 'POST' && $b === 'reset' => self::reset(),
                    $m === 'POST' && $b === 'password' => self::changePassword(),
                    $m === 'POST' && $b === 'delete' => self::deleteAccount(),
                    default => throw new HttpError(404, 'No existe', 'not_found'),
                };
            case 'settings': if ($m === 'PUT') return self::saveSettings(); break;
            case 'family':
                if ($m === 'POST' && $b === 'setup') return self::familySetup();
                if ($m === 'PUT') return self::familyUpdate();
                break;
            case 'subscription':
                if ($m === 'POST' && $b === 'cancel') return self::subscriptionCancel();
                break;
            case 'students':
                if ($m === 'POST' && !$b) return self::studentSave(null);
                if ($m === 'PUT' && $b) return self::studentSave($b);
                if ($m === 'DELETE' && $b) return self::studentDelete($b);
                break;
            case 'sync': if ($m === 'GET') return self::sync(); break;
            case 'records':
                if ($m === 'POST' && !$b) return self::recordCreate();
                if ($m === 'PUT' && $b) return self::recordUpdate($b, false);
                if ($m === 'PATCH' && $b) return self::recordUpdate($b, true);
                if ($m === 'DELETE' && $b) return self::recordDelete($b);
                break;
            case 'invites':
                if ($m === 'POST' && $b === 'accept') return self::inviteAccept();
                if ($m === 'POST' && !$b) return self::inviteCreate();
                if ($m === 'DELETE' && $b) return self::inviteRevoke($b);
                break;
            case 'members': if ($m === 'DELETE' && $b) return self::memberRemove((int)$b); break;
            case 'files':
                if ($m === 'POST' && !$b) return self::fileUpload();
                if ($m === 'GET' && $b) { self::fileServe($b); return null; }
                break;
            case 'import': if ($m === 'POST') return self::import(); break;
            case 'reminders':
                if ($m === 'GET' && $b === 'status') return self::reminderStatus();
                if ($m === 'POST' && $b === 'test') return self::reminderTest();
                break;
        }
        throw new HttpError(404, 'No existe', 'not_found');
    }

    // ---------------------------------------------------------- utilidades
    private static function user(): array
    {
        if (self::$user) return self::$user;
        $id = (int)($_SESSION['uid'] ?? 0);
        $u = $id ? one('SELECT * FROM users WHERE id=?', [$id]) : null;
        if (!$u) throw new HttpError(401, 'Iniciá sesión para continuar', 'auth');
        self::$user = $u;
        self::$member = one('SELECT m.*, f.name AS family_name, f.mode, f.owner_id, f.settings AS family_settings FROM members m JOIN families f ON f.id=m.family_id WHERE m.user_id=?', [$id]);
        return $u;
    }

    private static function member(bool $required = true): ?array
    {
        self::user();
        if (!self::$member && $required) throw new HttpError(409, 'Primero completá la configuración inicial', 'no_family');
        return self::$member;
    }

    private static function guardian(): array
    {
        $m = self::member();
        if ($m['role'] !== 'guardian') throw new HttpError(403, 'Esta acción es solo para responsables', 'forbidden');
        return $m;
    }

    private static function str($v, int $max = 200): string
    {
        return mb_substr(trim((string)($v ?? '')), 0, $max);
    }

    private static function userOut(array $u): array
    {
        return [
            'id' => (int)$u['id'], 'email' => $u['email'], 'name' => $u['name'],
            'verified' => (bool)$u['email_verified'], 'settings' => jdec($u['settings']),
        ];
    }

    private static function meOut(): array
    {
        $u = self::user();
        $m = self::$member;
        return [
            'user' => self::userOut($u),
            'member' => $m ? ['role' => $m['role'], 'student_id' => $m['student_id'], 'family_id' => $m['family_id'], 'is_owner' => (int)$m['owner_id'] === (int)$u['id']] : null,
            'family' => $m ? ['id' => $m['family_id'], 'name' => $m['family_name'], 'mode' => $m['mode'], 'settings' => jdec($m['family_settings'])] : null,
            'csrf' => $_SESSION['csrf'],
            'access' => self::accessOut(self::$access ?? Billing::accessForUser((int)$u['id'])),
        ];
    }

    private static function startSession(int $uid): void
    {
        session_regenerate_id(true);
        $_SESSION['uid'] = $uid;
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
        self::$user = null;
        self::$member = null;
        q('UPDATE users SET last_login=? WHERE id=?', [time(), $uid]);
    }

    // ---------------------------------------------------------------- meta
    private static function meta(): array
    {
        $has = (int)q('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
        return [
            'brand' => cfg('brand'),
            'mail_configured' => Mailer::configured(),
            'default_tz' => cfg('default_tz'),
            'open_registration' => false,
            'csrf' => $_SESSION['csrf'],
            'logged' => !empty($_SESSION['uid']),
            'access' => self::accessOut(self::$access),
            'site' => self::appUrl() . '/index.html',
        ];
    }

    // ---------------------------------------------------------------- auth
    private static function register(): array
    {
        $b = self::body();
        $email = strtolower(self::str($b['email'] ?? '', 190));
        $pass = (string)($b['password'] ?? '');
        $name = self::str($b['name'] ?? '', 80);
        $invite = strtoupper(self::str($b['invite'] ?? '', 20));
        if (!rate_hit('reg:' . client_ip(), 10, 3600)) throw new HttpError(429, 'Demasiados intentos. Probá más tarde.', 'rate');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new HttpError(422, 'Escribí un correo válido', 'email');
        if (mb_strlen($pass) < 8) throw new HttpError(422, 'La contraseña debe tener al menos 8 caracteres', 'password');
        if ($name === '') throw new HttpError(422, 'Escribí tu nombre', 'name');
        $has = (int)q('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
        if ($invite === '') throw new HttpError(403, 'Para crear tu cuenta primero tenés que suscribirte. Si te invitó alguien, pedile el código de invitación.', 'closed');
        $inv = null;
        if ($invite !== '') $inv = self::inviteCheck($invite);
        if (one('SELECT id FROM users WHERE email=?', [$email])) throw new HttpError(409, 'Ese correo ya tiene una cuenta. Iniciá sesión.', 'exists');
        $token = bin2hex(random_bytes(20));
        q('INSERT INTO users(email,pass_hash,name,email_verified,verify_token,verify_expires,settings,created_at) VALUES(?,?,?,0,?,?,?,?)', [
            $email, password_hash($pass, PASSWORD_DEFAULT), $name, hash('sha256', $token), time() + 172800, '{}', time(),
        ]);
        $uid = (int)db()->lastInsertId();
        if ($inv) self::inviteUse($inv, $uid);
        self::sendVerification($email, $name, $token);
        self::startSession($uid);
        return self::meOut();
    }

    private static function sendVerification(string $email, string $name, string $token): void
    {
        if (!Mailer::configured()) return;
        $url = self::appUrl() . '/app.php#/verificar/' . $token;
        $html = Mailer::layout('Confirmá tu correo', '<p>Hola ' . htmlspecialchars($name) . ', confirmá tu correo para recibir avisos.</p><p><a href="' . htmlspecialchars($url) . '" style="background:#0f5f73;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Confirmar correo</a></p><p style="font-size:12px;color:#6a7685">Vence en 48 horas. Si no creaste esta cuenta, ignorá este mensaje.</p>');
        [$ok, $err] = Mailer::send($email, 'Confirmá tu correo', "Confirmá tu correo entrando a:\n$url\n\nVence en 48 horas.", $html);
        q('INSERT INTO mail_log(user_id,to_email,kind,status,error,created_at) VALUES((SELECT id FROM users WHERE email=?),?,?,?,?,?)', [$email, $email, 'verify', $ok ? 'sent' : 'failed', $ok ? null : $err, time()]);
    }

    public static function appUrl(): string
    {
        $u = rtrim((string)cfg('app_url'), '/');
        if ($u !== '') return $u;
        $scheme = (!empty($_SERVER['HTTPS']) || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')) ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
        return $scheme . '://' . $host . $dir;
    }

    private static function login(): array
    {
        $b = self::body();
        $email = strtolower(self::str($b['email'] ?? '', 190));
        $pass = (string)($b['password'] ?? '');
        $ip = client_ip();
        if (!rate_hit('login:' . $ip . ':' . $email, 8, 900) || !rate_hit('loginip:' . $ip, 40, 900)) {
            throw new HttpError(429, 'Demasiados intentos. Esperá unos minutos.', 'rate');
        }
        $u = one('SELECT * FROM users WHERE email=?', [$email]);
        $ok = password_verify($pass, $u['pass_hash'] ?? '$2y$10$abcdefghijklmnopqrstuuG6V1bY5q6xqz3mC5N0nYk2xH2m3D1yW');
        if (!$u || !$ok) throw new HttpError(401, 'Correo o contraseña incorrectos', 'bad_login');
        if (password_needs_rehash($u['pass_hash'], PASSWORD_DEFAULT)) q('UPDATE users SET pass_hash=? WHERE id=?', [password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
        self::startSession((int)$u['id']);
        return self::meOut();
    }

    private static function logout(): array
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) session_regenerate_id(true);
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
        self::$user = null; self::$member = null;
        return ['ok' => true, 'csrf' => $_SESSION['csrf']];
    }

    private static function meInfo(): array
    {
        return self::meOut();
    }

    private static function verify(): array
    {
        $b = self::body();
        $t = self::str($b['token'] ?? '', 80);
        if (!rate_hit('verify:' . client_ip(), 20, 900)) throw new HttpError(429, 'Demasiados intentos', 'rate');
        $u = $t === '' ? null : one('SELECT id, verify_expires FROM users WHERE verify_token=?', [hash('sha256', $t)]);
        if (!$u || (int)$u['verify_expires'] < time()) throw new HttpError(400, 'El enlace no es válido o venció. Pedí uno nuevo desde Ajustes.', 'bad_token');
        q('UPDATE users SET email_verified=1, verify_token=NULL, verify_expires=NULL WHERE id=?', [$u['id']]);
        return ['ok' => true];
    }

    private static function resend(): array
    {
        $u = self::user();
        if (!Mailer::configured()) throw new HttpError(503, 'Correo pendiente de configurar', 'mail_off');
        if ($u['email_verified']) return ['ok' => true, 'already' => true];
        if (!rate_hit('resend:' . $u['id'], 5, 3600)) throw new HttpError(429, 'Ya pediste varios correos. Esperá un rato.', 'rate');
        $token = bin2hex(random_bytes(20));
        q('UPDATE users SET verify_token=?, verify_expires=? WHERE id=?', [hash('sha256', $token), time() + 172800, $u['id']]);
        self::sendVerification($u['email'], $u['name'], $token);
        $last = one('SELECT status,error FROM mail_log WHERE user_id=? AND kind=? ORDER BY id DESC LIMIT 1', [$u['id'], 'verify']);
        if (!$last || $last['status'] !== 'sent') throw new HttpError(502, 'No se pudo enviar: ' . ($last['error'] ?? 'error desconocido'), 'mail_fail');
        return ['ok' => true];
    }

    private static function forgot(): array
    {
        $b = self::body();
        $email = strtolower(self::str($b['email'] ?? '', 190));
        if (!rate_hit('forgot:' . client_ip(), 6, 3600)) throw new HttpError(429, 'Demasiados intentos', 'rate');
        $u = one('SELECT * FROM users WHERE email=?', [$email]);
        if ($u && Mailer::configured() && rate_hit('forgotu:' . $u['id'], 3, 3600)) {
            $token = bin2hex(random_bytes(20));
            q('UPDATE users SET reset_token=?, reset_expires=? WHERE id=?', [hash('sha256', $token), time() + 3600, $u['id']]);
            $url = self::appUrl() . '/app.php#/restablecer/' . $token;
            $html = Mailer::layout('Restablecer contraseña', '<p>Entrá al enlace para elegir una contraseña nueva. Vence en 1 hora.</p><p><a href="' . htmlspecialchars($url) . '">Elegir contraseña nueva</a></p><p style="font-size:12px;color:#6a7685">Si no lo pediste, ignorá este mensaje.</p>');
            [$ok, $err] = Mailer::send($u['email'], 'Restablecer contraseña', "Elegí una contraseña nueva entrando a:\n$url\n\nVence en 1 hora.", $html);
            q('INSERT INTO mail_log(user_id,to_email,kind,status,error,created_at) VALUES(?,?,?,?,?,?)', [$u['id'], $u['email'], 'reset', $ok ? 'sent' : 'failed', $ok ? null : $err, time()]);
        }
        // Misma respuesta exista o no la cuenta.
        return ['ok' => true, 'mail_configured' => Mailer::configured()];
    }

    private static function reset(): array
    {
        $b = self::body();
        $t = self::str($b['token'] ?? '', 80);
        $pass = (string)($b['password'] ?? '');
        if (mb_strlen($pass) < 8) throw new HttpError(422, 'La contraseña debe tener al menos 8 caracteres', 'password');
        if (!rate_hit('reset:' . client_ip(), 10, 900)) throw new HttpError(429, 'Demasiados intentos', 'rate');
        $u = $t === '' ? null : one('SELECT id, reset_expires FROM users WHERE reset_token=?', [hash('sha256', $t)]);
        if (!$u || (int)$u['reset_expires'] < time()) throw new HttpError(400, 'El enlace no es válido o venció', 'bad_token');
        q('UPDATE users SET pass_hash=?, reset_token=NULL, reset_expires=NULL WHERE id=?', [password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
        return ['ok' => true];
    }

    private static function changePassword(): array
    {
        $u = self::user();
        $b = self::body();
        if (!password_verify((string)($b['old'] ?? ''), $u['pass_hash'])) throw new HttpError(403, 'La contraseña actual no coincide', 'bad_login');
        $new = (string)($b['new'] ?? '');
        if (mb_strlen($new) < 8) throw new HttpError(422, 'La contraseña nueva debe tener al menos 8 caracteres', 'password');
        q('UPDATE users SET pass_hash=? WHERE id=?', [password_hash($new, PASSWORD_DEFAULT), $u['id']]);
        return ['ok' => true];
    }

    private static function deleteAccount(): array
    {
        $u = self::user();
        $m = self::$member;
        $b = self::body();
        if (!password_verify((string)($b['password'] ?? ''), $u['pass_hash'])) throw new HttpError(403, 'La contraseña no coincide', 'bad_login');
        if ($m && (int)$m['owner_id'] === (int)$u['id']) {
            $subs = all('SELECT preapproval_id FROM subscriptions WHERE user_id=? AND status IN ("authorized","paused","pending") AND preapproval_id NOT LIKE "manual-%"', [$u['id']]);
            foreach ($subs as $s) {
                try {
                    Billing::cancelPreapproval((string)$s['preapproval_id']);
                } catch (Throwable $e) {
                    error_log('borrar cuenta: no se pudo cancelar la suscripción: ' . $e->getMessage());
                    throw new HttpError(502, 'No pudimos cancelar tu suscripción en Mercado Pago, así que tu cuenta no se borró. Probá de nuevo en unos minutos.', 'mp');
                }
            }
        }
        $pdo = db();
        $pdo->beginTransaction();
        try {
            if ($m && (int)$m['owner_id'] === (int)$u['id']) {
                $fid = $m['family_id'];
                foreach (all('SELECT path FROM files WHERE family_id=?', [$fid]) as $f) @unlink(STORAGE . '/uploads/' . $f['path']);
                q('DELETE FROM reminders WHERE family_id=?', [$fid]);
                foreach (all('SELECT user_id FROM members WHERE family_id=? AND user_id<>?', [$fid, $u['id']]) as $o) {
                    q('DELETE FROM reminders WHERE user_id=?', [$o['user_id']]);
                }
                q('DELETE FROM families WHERE id=?', [$fid]);
            }
            q('DELETE FROM reminders WHERE user_id=?', [$u['id']]);
            q('DELETE FROM digests WHERE user_id=?', [$u['id']]);
            q('UPDATE subscriptions SET user_id=NULL WHERE user_id=?', [$u['id']]);
            q('DELETE FROM users WHERE id=?', [$u['id']]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
        return ['ok' => true, 'csrf' => $_SESSION['csrf']];
    }

    // ---------------------------------------------------------- ajustes
    private static function saveSettings(): array
    {
        $u = self::user();
        $b = self::body();
        $cur = jdec($u['settings']);
        foreach (self::SETTINGS_KEYS as $k) {
            if (!array_key_exists($k, $b)) continue;
            $v = $b[$k];
            switch ($k) {
                case 'theme': $v = in_array($v, ['ocean', 'plum'], true) ? $v : 'ocean'; break;
                case 'mode': $v = in_array($v, ['light', 'dark', 'auto'], true) ? $v : 'auto'; break;
                case 'textSize': $v = in_array($v, ['s', 'm', 'l', 'xl'], true) ? $v : 'm'; break;
                case 'hour12': $v = (bool)$v; break;
                case 'weekStart': $v = in_array((int)$v, [0, 1, 6], true) ? (int)$v : 1; break;
                case 'tz': $v = valid_tz((string)$v) ? $v : null; break;
                case 'activeStudent': $v = self::str($v, 40); break;
                case 'view': $v = self::str($v, 12); break;
                case 'notif':
                    if (!is_array($v)) $v = [];
                    $n = [
                        'inapp' => (bool)($v['inapp'] ?? true),
                        'email' => (bool)($v['email'] ?? false),
                        'browser' => (bool)($v['browser'] ?? false),
                        'leadMin' => max(0, min(60 * 24 * 14, (int)($v['leadMin'] ?? 1440))),
                        'digestHour' => preg_match('/^\d{2}:\d{2}$/', (string)($v['digestHour'] ?? '')) ? $v['digestHour'] : '07:00',
                        'daily' => (bool)($v['daily'] ?? true),
                        'weekly' => (bool)($v['weekly'] ?? false),
                        'quiet' => [
                            'enabled' => (bool)($v['quiet']['enabled'] ?? false),
                            'from' => preg_match('/^\d{2}:\d{2}$/', (string)($v['quiet']['from'] ?? '')) ? $v['quiet']['from'] : '22:00',
                            'to' => preg_match('/^\d{2}:\d{2}$/', (string)($v['quiet']['to'] ?? '')) ? $v['quiet']['to'] : '07:00',
                            'days' => array_values(array_unique(array_map('intval', array_filter((array)($v['quiet']['days'] ?? [0, 1, 2, 3, 4, 5, 6]), 'is_numeric')))),
                        ],
                        'cats' => [],
                        'students' => array_values(array_map(fn($s) => self::str($s, 40), (array)($v['students'] ?? []))),
                    ];
                    foreach (['tasks', 'exams', 'materials', 'events'] as $cat) $n['cats'][$cat] = (bool)($v['cats'][$cat] ?? true);
                    $v = $n;
                    break;
            }
            $cur[$k] = $v;
        }
        if (strlen(jenc($cur)) > 8000) throw new HttpError(413, 'Ajustes demasiado grandes', 'too_big');
        q('UPDATE users SET settings=? WHERE id=?', [jenc($cur), $u['id']]);
        if (isset($b['name'])) q('UPDATE users SET name=? WHERE id=?', [self::str($b['name'], 80) ?: $u['name'], $u['id']]);
        if (isset($b['notif']) && self::$member) Reminders::resyncUser((int)$u['id']);
        self::$user = null;
        self::user();
        return self::meOut();
    }

    // ---------------------------------------------------------- familia
    private static function familySetup(): array
    {
        $u = self::user();
        if (self::$member) throw new HttpError(409, 'Ya completaste la configuración', 'exists');
        $b = self::body();
        $mode = ($b['mode'] ?? '') === 'family' ? 'family' : 'self';
        $studs = is_array($b['students'] ?? null) ? $b['students'] : [];
        if (!$studs) throw new HttpError(422, 'Agregá al menos un estudiante', 'students');
        $tope = $mode === 'family' ? 3 : 12;
        if (count($studs) > $tope) throw new HttpError(422, $tope === 3 ? 'En modo familia podés agregar hasta 3 estudiantes.' : 'Demasiados estudiantes', 'students');
        $fid = uid(8);
        $pdo = db();
        $pdo->beginTransaction();
        try {
            q('INSERT INTO families(id,name,owner_id,mode,settings,created_at) VALUES(?,?,?,?,?,?)', [
                $fid, self::str($b['family_name'] ?? '', 80) ?: ('Familia de ' . $u['name']), $u['id'], $mode,
                jenc(['scale' => ['min' => 0, 'max' => 10, 'pass' => 6, 'decimals' => 1]]), time(),
            ]);
            $first = null;
            foreach ($studs as $s) {
                $id = self::saveStudentRow($fid, null, (array)$s);
                $first ??= $id;
            }
            q('INSERT INTO members(family_id,user_id,role,student_id,created_at) VALUES(?,?,?,?,?)', [$fid, $u['id'], 'guardian', null, time()]);
            if (!empty($b['settings']) && is_array($b['settings'])) {
                $_POST_SETTINGS = $b['settings'];
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        self::$user = null; self::$member = null;
        self::user();
        return self::meOut() + ['first_student' => $first];
    }

    private static function subscriptionCancel(): array
    {
        $u = self::user();
        $m = self::guardian();
        if ((int)$m['owner_id'] !== (int)$u['id']) throw new HttpError(403, 'Solo quien pagó la suscripción puede cancelarla.', 'forbidden');
        $sub = one('SELECT preapproval_id, status FROM subscriptions WHERE user_id=? ORDER BY (status="authorized") DESC, updated DESC LIMIT 1', [$u['id']]);
        if (!$sub || $sub['status'] !== 'authorized') throw new HttpError(422, 'No hay una suscripción activa para cancelar.', 'no_sub');
        try {
            Billing::cancelPreapproval((string)$sub['preapproval_id']);
        } catch (Throwable $e) {
            error_log('cancelar suscripción: ' . $e->getMessage());
            throw new HttpError(502, 'No pudimos cancelar la suscripción ahora. Probá de nuevo en unos minutos.', 'mp');
        }
        Billing::audit('app', 'suscripcion_cancelada', (string)$u['email']);
        return ['ok' => true];
    }

    private static function familyUpdate(): array
    {
        $m = self::guardian();
        $b = self::body();
        $f = one('SELECT * FROM families WHERE id=?', [$m['family_id']]);
        $s = jdec($f['settings']);
        if (isset($b['settings']['scale']) && is_array($b['settings']['scale'])) {
            $sc = $b['settings']['scale'];
            $min = (float)($sc['min'] ?? 0); $max = (float)($sc['max'] ?? 10);
            if ($max <= $min) throw new HttpError(422, 'La nota máxima debe ser mayor que la mínima', 'scale');
            $pass = (float)($sc['pass'] ?? 6);
            $pass = max($min, min($max, $pass));
            $s['scale'] = ['min' => $min, 'max' => $max, 'pass' => $pass, 'decimals' => max(0, min(2, (int)($sc['decimals'] ?? 1)))];
        }
        $name = isset($b['name']) ? (self::str($b['name'], 80) ?: $f['name']) : $f['name'];
        $mode = isset($b['mode']) && in_array($b['mode'], ['self', 'family'], true) ? $b['mode'] : $f['mode'];
        if ($mode === 'family' && $f['mode'] !== 'family' && self::activeStudentCount($m['family_id']) > 3) throw new HttpError(422, 'Tenés más de 3 estudiantes activos. Archivá o quitá alguno antes de pasar a modo familia.', 'limit');
        q('UPDATE families SET name=?, mode=?, settings=? WHERE id=?', [$name, $mode, jenc($s), $f['id']]);
        self::$member = null; self::$user = null; self::user();
        return self::meOut();
    }

    private static function saveStudentRow(string $fid, ?string $id, array $s): string
    {
        $name = self::str($s['name'] ?? '', 60);
        if ($name === '') throw new HttpError(422, 'Escribí el nombre o apodo del estudiante', 'name');
        $tz = valid_tz($s['tz'] ?? null) ? $s['tz'] : (string)cfg('default_tz', 'UTC');
        $vals = [$name, self::str($s['level'] ?? '', 30), self::str($s['institution'] ?? '', 100), self::str($s['grade'] ?? '', 40), self::str($s['division'] ?? '', 40), self::str($s['shift'] ?? '', 20), $tz];
        $t = now_ms();
        if ($id === null) {
            $id = uid(6);
            q('INSERT INTO students(id,family_id,name,level,institution,grade,division,shift,tz,settings,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', array_merge([$id, $fid], $vals, [jenc(is_array($s['settings'] ?? null) ? $s['settings'] : []), $t, $t]));
        } else {
            q('UPDATE students SET name=?,level=?,institution=?,grade=?,division=?,shift=?,tz=?,updated_at=? WHERE id=? AND family_id=?', array_merge($vals, [$t, $id, $fid]));
            Reminders::resyncStudent($id);
        }
        return $id;
    }

    private static function activeStudentCount(string $familyId, ?string $excluirId = null): int
    {
        $n = 0;
        foreach (all('SELECT id, settings FROM students WHERE family_id=? AND deleted_at IS NULL', [$familyId]) as $row) {
            if ($excluirId !== null && $row['id'] === $excluirId) continue;
            $st = jdec($row['settings']);
            if (empty($st['archived'])) $n++;
        }
        return $n;
    }

    private static function studentCap(array $m): int
    {
        return ($m['mode'] ?? 'self') === 'family' ? 3 : 12;
    }

    private static function studentSave(?string $id): array
    {
        $m = self::guardian();
        $b = self::body();
        $cap = self::studentCap($m);
        $capMsg = $cap === 3 ? 'En modo familia podés agregar hasta 3 estudiantes.' : 'Llegaste al máximo de estudiantes';
        if ($id !== null) {
            $st = one('SELECT id, settings FROM students WHERE id=? AND family_id=? AND deleted_at IS NULL', [$id, $m['family_id']]);
            if (!$st) throw new HttpError(404, 'Estudiante no encontrado', 'not_found');
            $reactiva = isset($b['archived']) && !(bool)$b['archived'] && !empty(jdec($st['settings'])['archived']);
            if ($reactiva && self::activeStudentCount($m['family_id']) >= $cap) throw new HttpError(422, $capMsg, 'limit');
        } elseif (self::activeStudentCount($m['family_id']) >= $cap) {
            throw new HttpError(422, $capMsg, 'limit');
        }
        $sid = self::saveStudentRow($m['family_id'], $id, $b);
        if (isset($b['archived'])) {
            $row = one('SELECT settings FROM students WHERE id=?', [$sid]);
            $st = jdec($row['settings']);
            $st['archived'] = (bool)$b['archived'];
            q('UPDATE students SET settings=?, updated_at=? WHERE id=?', [jenc($st), now_ms(), $sid]);
        }
        if (isset($b['minor'])) {
            $row = one('SELECT settings FROM students WHERE id=?', [$sid]);
            $st = jdec($row['settings']);
            $st['minor'] = (bool)$b['minor'];
            q('UPDATE students SET settings=?, updated_at=? WHERE id=?', [jenc($st), now_ms(), $sid]);
        }
        return ['student' => self::studentOut(one('SELECT * FROM students WHERE id=?', [$sid]))];
    }

    private static function studentOut(array $s): array
    {
        return [
            'id' => $s['id'], 'name' => $s['name'], 'level' => $s['level'], 'institution' => $s['institution'], 'grade' => $s['grade'],
            'division' => $s['division'], 'shift' => $s['shift'], 'tz' => $s['tz'], 'settings' => jdec($s['settings']),
            'updated_at' => (int)$s['updated_at'], 'deleted' => $s['deleted_at'] !== null,
        ];
    }

    private static function studentDelete(string $id): array
    {
        $m = self::guardian();
        $st = one('SELECT id FROM students WHERE id=? AND family_id=? AND deleted_at IS NULL', [$id, $m['family_id']]);
        if (!$st) throw new HttpError(404, 'Estudiante no encontrado', 'not_found');
        $n = (int)q('SELECT COUNT(*) FROM students WHERE family_id=? AND deleted_at IS NULL', [$m['family_id']])->fetchColumn();
        if ($n <= 1) throw new HttpError(422, 'Tiene que quedar al menos un estudiante', 'last');
        $t = now_ms();
        q('UPDATE students SET deleted_at=?, updated_at=? WHERE id=?', [$t, $t, $id]);
        q('UPDATE records SET deleted_at=?, updated_at=? WHERE student_id=? AND deleted_at IS NULL', [$t, $t, $id]);
        q('DELETE FROM reminders WHERE record_id IN (SELECT id FROM records WHERE student_id=?)', [$id]);
        // Si algún estudiante tenía acceso propio, lo dejamos sin acceso.
        q('DELETE FROM members WHERE student_id=? AND family_id=?', [$id, $m['family_id']]);
        return ['ok' => true];
    }

    // ---------------------------------------------------------- sync
    private static function visibleSql(array $m, int $uid): array
    {
        $where = ['r.family_id=?'];
        $args = [$m['family_id']];
        if ($m['role'] === 'student') {
            $where[] = '(r.student_id=? OR r.student_id IS NULL)';
            $args[] = $m['student_id'];
        }
        $where[] = "(r.visibility='family' OR r.created_by=?)";
        $args[] = $uid;
        return [implode(' AND ', $where), $args];
    }

    private static function sync(): array
    {
        $u = self::user();
        $m = self::member();
        $since = (int)($_GET['since'] ?? 0);
        [$w, $args] = self::visibleSql($m, (int)$u['id']);
        $sql = "SELECT r.* FROM records r WHERE $w";
        if ($since > 0) { $sql .= ' AND r.updated_at > ?'; $args[] = $since; } else { $sql .= ' AND r.deleted_at IS NULL'; }
        $sql .= ' ORDER BY r.updated_at ASC LIMIT 20000';
        $recs = array_map([self::class, 'recOut'], all($sql, $args));
        $studs = all('SELECT * FROM students WHERE family_id=? ORDER BY created_at', [$m['family_id']]);
        if ($m['role'] === 'student') $studs = array_values(array_filter($studs, fn($s) => $s['id'] === $m['student_id']));
        $out = self::meOut();
        $out['server_time'] = now_ms();
        $out['students'] = array_map([self::class, 'studentOut'], $studs);
        $out['records'] = $recs;
        $out['full'] = $since === 0;
        $members = all('SELECT m.user_id, m.role, m.student_id, u.name, u.email FROM members m JOIN users u ON u.id=m.user_id WHERE m.family_id=?', [$m['family_id']]);
        $out['members'] = array_map(fn($x) => [
            'user_id' => (int)$x['user_id'], 'role' => $x['role'], 'student_id' => $x['student_id'], 'name' => $x['name'],
            'email' => $m['role'] === 'guardian' ? $x['email'] : null,
        ], $members);
        if ($m['role'] === 'guardian') {
            $out['invites'] = all('SELECT code, role, student_id, expires_at, used_by FROM invites WHERE family_id=? AND revoked=0 AND used_by IS NULL AND expires_at>?', [$m['family_id'], time()]);
        }
        return $out;
    }

    private static function recOut(array $r): array
    {
        return [
            'id' => $r['id'], 'type' => $r['type'], 'student_id' => $r['student_id'], 'data' => jdec($r['data']),
            'visibility' => $r['visibility'], 'created_by' => $r['created_by'] === null ? null : (int)$r['created_by'],
            'updated_by' => $r['updated_by'] === null ? null : (int)$r['updated_by'],
            'created_at' => (int)$r['created_at'], 'updated_at' => (int)$r['updated_at'], 'deleted' => $r['deleted_at'] !== null,
        ];
    }

    // ---------------------------------------------------------- registros
    private static function checkStudentScope(array $m, ?string $sid, string $type): ?string
    {
        if ($sid === null || $sid === '') {
            if ($m['role'] === 'student') return null;
            return null;
        }
        $s = one('SELECT id FROM students WHERE id=? AND family_id=? AND deleted_at IS NULL', [$sid, $m['family_id']]);
        if (!$s) throw new HttpError(404, 'Estudiante no encontrado', 'not_found');
        if ($m['role'] === 'student' && $m['student_id'] !== $sid) throw new HttpError(403, 'No tenés acceso a ese estudiante', 'forbidden');
        return $sid;
    }

    private static function cleanData($d): array
    {
        if (!is_array($d)) throw new HttpError(422, 'Datos inválidos', 'data');
        $j = jenc($d);
        if (strlen($j) > 200_000) throw new HttpError(413, 'El contenido es demasiado grande', 'too_big');
        return $d;
    }

    private static function recordCreate(): array
    {
        $u = self::user();
        $m = self::member();
        $b = self::body();
        $type = (string)($b['type'] ?? '');
        if (!in_array($type, self::TYPES, true)) throw new HttpError(422, 'Tipo desconocido', 'type');
        if ($m['role'] === 'student' && !in_array($type, self::STUDENT_WRITE, true)) throw new HttpError(403, 'Este contenido lo administra tu familia', 'forbidden');
        $sid = self::checkStudentScope($m, isset($b['student_id']) ? (string)$b['student_id'] : null, $type);
        if ($m['role'] === 'student') $sid = $m['student_id'];
        $data = self::cleanData($b['data'] ?? []);
        $vis = ($b['visibility'] ?? 'family') === 'private' ? 'private' : 'family';
        if ($type === 'note' && $m['role'] === 'student' && !isset($b['visibility'])) $vis = 'private';
        $id = isset($b['id']) && preg_match('/^[a-z0-9]{8,24}$/', (string)$b['id']) ? (string)$b['id'] : uid(8);
        if (one('SELECT id FROM records WHERE id=?', [$id])) throw new HttpError(409, 'Ya existe', 'exists');
        $t = now_ms();
        q('INSERT INTO records(id,family_id,student_id,type,data,visibility,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [
            $id, $m['family_id'], $sid, $type, jenc($data), $vis, $u['id'], $u['id'], $t, $t,
        ]);
        $row = one('SELECT * FROM records WHERE id=?', [$id]);
        Reminders::syncRecord($row);
        return ['record' => self::recOut($row), 'server_time' => $t];
    }

    private static function loadRecord(string $id, array $m, int $uid): array
    {
        $r = one('SELECT * FROM records WHERE id=? AND family_id=?', [$id, $m['family_id']]);
        if (!$r || $r['deleted_at'] !== null) throw new HttpError(404, 'No encontrado', 'not_found');
        if ($r['visibility'] === 'private' && (int)$r['created_by'] !== $uid) throw new HttpError(404, 'No encontrado', 'not_found');
        if ($m['role'] === 'student' && $r['student_id'] !== null && $r['student_id'] !== $m['student_id']) throw new HttpError(404, 'No encontrado', 'not_found');
        return $r;
    }

    private static function recordUpdate(string $id, bool $patch): array
    {
        $u = self::user();
        $m = self::member();
        $b = self::body();
        $r = self::loadRecord($id, $m, (int)$u['id']);
        $old = jdec($r['data']);
        $new = $patch ? array_replace($old, self::cleanData($b['data'] ?? [])) : self::cleanData($b['data'] ?? $old);
        $vis = $r['visibility'];
        $sid = $r['student_id'];
        if ($m['role'] === 'student') {
            $own = (int)$r['created_by'] === (int)$u['id'];
            if ($own) {
                if (!in_array($r['type'], self::STUDENT_WRITE, true)) throw new HttpError(403, 'Este contenido lo administra tu familia', 'forbidden');
            } else {
                $allowed = self::STUDENT_PATCH[$r['type']] ?? null;
                if ($allowed === null || !$allowed) throw new HttpError(403, 'No podés editar este elemento', 'forbidden');
                foreach ($new as $k => $v) {
                    if (($old[$k] ?? null) !== $v && !in_array($k, $allowed, true)) throw new HttpError(403, 'Solo podés marcar tu avance en este elemento', 'forbidden');
                }
                foreach ($old as $k => $v) {
                    if (!array_key_exists($k, $new) && !in_array($k, $allowed, true)) throw new HttpError(403, 'Solo podés marcar tu avance en este elemento', 'forbidden');
                }
            }
        }
        if (isset($b['visibility']) && (int)$r['created_by'] === (int)$u['id']) $vis = $b['visibility'] === 'private' ? 'private' : 'family';
        if (array_key_exists('student_id', $b) && $m['role'] === 'guardian') {
            $sid = self::checkStudentScope($m, $b['student_id'] === null ? null : (string)$b['student_id'], $r['type']);
        }
        $t = now_ms();
        q('UPDATE records SET data=?, visibility=?, student_id=?, updated_by=?, updated_at=? WHERE id=?', [jenc($new), $vis, $sid, $u['id'], $t, $id]);
        $row = one('SELECT * FROM records WHERE id=?', [$id]);
        Reminders::syncRecord($row);
        return ['record' => self::recOut($row), 'server_time' => $t];
    }

    private static function recordDelete(string $id): array
    {
        $u = self::user();
        $m = self::member();
        $r = self::loadRecord($id, $m, (int)$u['id']);
        if ($m['role'] === 'student') {
            if ((int)$r['created_by'] !== (int)$u['id'] || !in_array($r['type'], self::STUDENT_WRITE, true)) throw new HttpError(403, 'No podés eliminar este elemento', 'forbidden');
        }
        $t = now_ms();
        q('UPDATE records SET deleted_at=?, updated_at=?, updated_by=? WHERE id=?', [$t, $t, $u['id'], $id]);
        Reminders::cancelRecord($id);
        // Si borra una materia/clase/examen, los avisos hijos se recalculan en el próximo cron.
        return ['ok' => true, 'server_time' => $t];
    }

    // ---------------------------------------------------------- invitaciones
    private static function inviteCreate(): array
    {
        $u = self::user();
        $m = self::guardian();
        if ((int)$m['owner_id'] !== (int)$u['id']) throw new HttpError(403, 'Solo quien creó la familia puede invitar.', 'forbidden');
        if (($m['mode'] ?? 'self') !== 'family') throw new HttpError(403, 'Las invitaciones son solo para el modo familia.', 'forbidden');
        $b = self::body();
        $role = ($b['role'] ?? '') === 'student' ? 'student' : 'guardian';
        $sid = null;
        if ($role === 'student') {
            $sid = (string)($b['student_id'] ?? '');
            if (!one('SELECT id FROM students WHERE id=? AND family_id=? AND deleted_at IS NULL', [$sid, $m['family_id']])) throw new HttpError(422, 'Elegí un estudiante', 'student');
            $stRow = one('SELECT settings FROM students WHERE id=?', [$sid]);
            $stSet = jdec($stRow['settings'] ?? null);
            if (empty($stSet['minor'])) throw new HttpError(422, 'Solo se puede dar acceso a un estudiante marcado como menor de 18. Si es mayor, tiene que crear su propia cuenta con suscripción.', 'minor');
            if (one('SELECT id FROM members WHERE student_id=? AND family_id=?', [$sid, $m['family_id']])) throw new HttpError(409, 'Ese estudiante ya tiene acceso propio. Quitalo primero para invitar de nuevo.', 'exists');
        }
        if (!rate_hit('invite:' . $u['id'], 20, 3600)) throw new HttpError(429, 'Demasiadas invitaciones', 'rate');
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $code = '';
        for ($i = 0; $i < 10; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        $exp = time() + 7 * 86400;
        q('INSERT INTO invites(code,family_id,role,student_id,created_by,expires_at) VALUES(?,?,?,?,?,?)', [$code, $m['family_id'], $role, $sid, $u['id'], $exp]);
        return ['code' => $code, 'role' => $role, 'student_id' => $sid, 'expires_at' => $exp, 'url' => self::appUrl() . '/app.php#/unirse/' . $code];
    }

    private static function inviteRevoke(string $code): array
    {
        $m = self::guardian();
        q('UPDATE invites SET revoked=1 WHERE code=? AND family_id=?', [strtoupper($code), $m['family_id']]);
        return ['ok' => true];
    }

    private static function inviteCheck(string $code): array
    {
        if (!rate_hit('invchk:' . client_ip(), 15, 900)) throw new HttpError(429, 'Demasiados intentos. Esperá unos minutos.', 'rate');
        $i = one('SELECT * FROM invites WHERE code=?', [$code]);
        if (!$i || $i['revoked'] || $i['used_by'] || (int)$i['expires_at'] < time()) throw new HttpError(400, 'La invitación no es válida o ya venció', 'bad_invite');
        if ($i['role'] === 'student' && one('SELECT id FROM members WHERE student_id=?', [$i['student_id']])) throw new HttpError(400, 'Ese acceso ya fue usado', 'bad_invite');
        return $i;
    }

    private static function inviteUse(array $i, int $uid): void
    {
        $pdo = db();
        if (one('SELECT id FROM members WHERE user_id=?', [$uid])) throw new HttpError(409, 'Esta cuenta ya pertenece a una familia', 'exists');
        q('INSERT INTO members(family_id,user_id,role,student_id,created_at) VALUES(?,?,?,?,?)', [$i['family_id'], $uid, $i['role'], $i['role'] === 'student' ? $i['student_id'] : null, time()]);
        q('UPDATE invites SET used_by=?, used_at=? WHERE code=?', [$uid, time(), $i['code']]);
    }

    private static function inviteAccept(): array
    {
        $u = self::user();
        $b = self::body();
        $i = self::inviteCheck(strtoupper(self::str($b['code'] ?? '', 20)));
        self::inviteUse($i, (int)$u['id']);
        self::$member = null; self::$user = null; self::user();
        return self::meOut();
    }

    private static function memberRemove(int $uid): array
    {
        $u = self::user();
        $m = self::guardian();
        $t = one('SELECT * FROM members WHERE user_id=? AND family_id=?', [$uid, $m['family_id']]);
        if (!$t) throw new HttpError(404, 'No encontrado', 'not_found');
        if ((int)$m['owner_id'] === $uid) throw new HttpError(422, 'No se puede quitar a quien creó la familia', 'owner');
        if ($t['role'] === 'guardian' && (int)$m['owner_id'] !== (int)$u['id']) throw new HttpError(403, 'Solo quien creó la familia puede quitar responsables', 'forbidden');
        q('DELETE FROM members WHERE user_id=?', [$uid]);
        q('DELETE FROM reminders WHERE user_id=?', [$uid]);
        return ['ok' => true];
    }

    // ---------------------------------------------------------- archivos
    private const MIMES = [
        'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/gif' => 'gif', 'image/webp' => 'webp',
        'application/pdf' => 'pdf', 'text/plain' => 'txt',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
    ];

    private static function fileUpload(): array
    {
        $u = self::user();
        $m = self::member();
        if (!rate_hit('upl:' . $u['id'], 60, 3600)) throw new HttpError(429, 'Demasiadas subidas. Esperá un rato.', 'rate');
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) throw new HttpError(422, 'No se pudo recibir el archivo', 'upload');
        $f = $_FILES['file'];
        if ($f['size'] > 5 * 1024 * 1024) throw new HttpError(413, 'El archivo supera los 5 MB', 'too_big');
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
        if ($mime === 'application/zip') {
            $ext0 = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
            $map = ['docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
            if (isset($map[$ext0])) $mime = $map[$ext0];
        }
        if (!isset(self::MIMES[$mime])) throw new HttpError(415, 'Tipo de archivo no permitido (imágenes, PDF, texto, Word, Excel o PowerPoint)', 'mime');
        $sid = self::checkStudentScope($m, isset($_POST['student_id']) ? (string)$_POST['student_id'] : null, 'file');
        if ($m['role'] === 'student') $sid = $m['student_id'];
        $id = uid(10);
        $dir = STORAGE . '/uploads/' . $m['family_id'];
        if (!is_dir($dir)) mkdir($dir, 0770, true);
        $rel = $m['family_id'] . '/' . $id . '.' . self::MIMES[$mime];
        if (!move_uploaded_file($f['tmp_name'], STORAGE . '/uploads/' . $rel)) {
            if (!@rename($f['tmp_name'], STORAGE . '/uploads/' . $rel)) throw new HttpError(500, 'No se pudo guardar el archivo', 'upload');
        }
        $name = preg_replace('/[^\p{L}\p{N}\-_. ()]/u', '_', mb_substr((string)$f['name'], 0, 120)) ?: 'archivo';
        q('INSERT INTO files(id,family_id,student_id,record_id,name,mime,size,path,uploaded_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [$id, $m['family_id'], $sid, null, $name, $mime, (int)$f['size'], $rel, $u['id'], time()]);
        return ['file' => ['id' => $id, 'name' => $name, 'mime' => $mime, 'size' => (int)$f['size']]];
    }

    private static function fileServe(string $id): void
    {
        $m = self::member();
        $f = one('SELECT * FROM files WHERE id=? AND family_id=?', [$id, $m['family_id']]);
        if (!$f) throw new HttpError(404, 'No encontrado', 'not_found');
        if ($m['role'] === 'student' && $f['student_id'] !== null && $f['student_id'] !== $m['student_id']) throw new HttpError(404, 'No encontrado', 'not_found');
        $path = STORAGE . '/uploads/' . $f['path'];
        if (!is_file($path)) throw new HttpError(404, 'No encontrado', 'not_found');
        header_remove('Content-Type');
        header('Content-Type: ' . $f['mime']);
        header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
        $inline = str_starts_with($f['mime'], 'image/') && $f['mime'] !== 'image/svg+xml' || $f['mime'] === 'application/pdf';
        header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . "; filename*=UTF-8''" . rawurlencode($f['name']));
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, max-age=3600');
        readfile($path);
    }

    // ---------------------------------------------------------- exportar / importar
    private static function import(): array
    {
        $u = self::user();
        $m = self::guardian();
        $b = self::body();
        if (!is_array($b['records'] ?? null) || !is_array($b['students'] ?? null)) throw new HttpError(422, 'El archivo no parece una copia de esta app', 'bad_file');
        $fid = $m['family_id'];
        if (self::studentCap($m) === 3) {
            // La importación no cambia el modo de la familia: el modo que queda es el actual.
            $known = all('SELECT id, name FROM students WHERE family_id=? AND deleted_at IS NULL', [$fid]);
            $nuevos = 0;
            foreach ($b['students'] as $s) {
                if (!is_array($s)) continue;
                $oid = (string)($s['id'] ?? ''); $nom = mb_strtolower((string)($s['name'] ?? ''));
                $hit = false;
                foreach ($known as $e) if ($e['id'] === $oid || mb_strtolower($e['name']) === $nom) { $hit = true; break; }
                if ($hit) continue;
                $known[] = ['id' => $oid, 'name' => (string)($s['name'] ?? '')];
                $stSet = is_array($s['settings'] ?? null) ? $s['settings'] : [];
                if (empty($stSet['archived'])) $nuevos++;
            }
            if ($nuevos > 0 && self::activeStudentCount($fid) + $nuevos > 3) throw new HttpError(422, 'La copia tiene más de 3 estudiantes activos para el modo familia.', 'limit');
        }
        $pdo = db();
        $pdo->beginTransaction();
        try {
            if (!empty($b['replace'])) {
                $t = now_ms();
                q('UPDATE records SET deleted_at=?, updated_at=? WHERE family_id=? AND deleted_at IS NULL', [$t, $t, $fid]);
                q('DELETE FROM reminders WHERE family_id=?', [$fid]);
            }
            $map = [];
            $existing = all('SELECT id,name FROM students WHERE family_id=? AND deleted_at IS NULL', [$fid]);
            foreach ($b['students'] as $s) {
                $oid = (string)($s['id'] ?? '');
                $hit = null;
                foreach ($existing as $e) if ($e['id'] === $oid) $hit = $e['id'];
                if (!$hit) foreach ($existing as $e) if (mb_strtolower($e['name']) === mb_strtolower((string)($s['name'] ?? ''))) $hit = $e['id'];
                $map[$oid] = $hit ?: self::saveStudentRow($fid, null, (array)$s);
                if (!$hit) $existing[] = ['id' => $map[$oid], 'name' => (string)$s['name']];
            }
            $n = 0;
            foreach ($b['records'] as $r) {
                if (!is_array($r) || !in_array($r['type'] ?? '', self::TYPES, true)) continue;
                $sid = $r['student_id'] ?? null;
                if ($sid !== null) { if (!isset($map[$sid])) continue; $sid = $map[$sid]; }
                $id = preg_match('/^[a-z0-9]{8,24}$/', (string)($r['id'] ?? '')) ? $r['id'] : uid(8);
                $ex = one('SELECT family_id FROM records WHERE id=?', [$id]);
                if ($ex && $ex['family_id'] !== $fid) $id = uid(8);
                $t = now_ms();
                $data = self::cleanData($r['data'] ?? []);
                if ($ex && $ex['family_id'] === $fid) {
                    q('UPDATE records SET data=?, student_id=?, deleted_at=NULL, updated_by=?, updated_at=? WHERE id=?', [jenc($data), $sid, $u['id'], $t, $id]);
                } else {
                    q('INSERT INTO records(id,family_id,student_id,type,data,visibility,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [$id, $fid, $sid, $r['type'], jenc($data), ($r['visibility'] ?? 'family') === 'private' ? 'private' : 'family', $u['id'], $u['id'], $t, $t]);
                }
                $n++;
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        Reminders::resyncFamily($fid);
        return ['ok' => true, 'imported' => $n];
    }

    // ---------------------------------------------------------- recordatorios (estado)
    private static function reminderStatus(): array
    {
        $u = self::user();
        $pending = (int)q("SELECT COUNT(*) FROM reminders WHERE user_id=? AND status='pending'", [$u['id']])->fetchColumn();
        $log = all('SELECT kind,status,error,created_at FROM mail_log WHERE user_id=? ORDER BY id DESC LIMIT 8', [$u['id']]);
        return [
            'mail_configured' => Mailer::configured(), 'verified' => (bool)$u['email_verified'],
            'pending' => $pending, 'log' => $log, 'cron_last' => (int)(one("SELECT v FROM meta WHERE k='cron_last'")['v'] ?? 0),
        ];
    }

    private static function reminderTest(): array
    {
        $u = self::user();
        if (!Mailer::configured()) throw new HttpError(503, 'Correo pendiente de configurar', 'mail_off');
        if (!rate_hit('mailtest:' . $u['id'], 5, 3600)) throw new HttpError(429, 'Ya hiciste varias pruebas. Esperá un rato.', 'rate');
        $html = Mailer::layout('Prueba de correo', '<p>Si ves este mensaje, los avisos por correo funcionan.</p>');
        [$ok, $err] = Mailer::send($u['email'], 'Prueba de correo', 'Si ves este mensaje, los avisos por correo funcionan.', $html);
        q('INSERT INTO mail_log(user_id,to_email,kind,status,error,created_at) VALUES(?,?,?,?,?,?)', [$u['id'], $u['email'], 'test', $ok ? 'sent' : 'failed', $ok ? null : $err, time()]);
        if (!$ok) throw new HttpError(502, 'No se pudo enviar: ' . $err, 'mail_fail');
        return ['ok' => true];
    }
}
