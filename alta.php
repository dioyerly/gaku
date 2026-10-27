<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';
/* Alta de la cuenta después de suscribirse. Mercado Pago vuelve acá (back_url) y además mandamos el link por mail.
   El pago SIEMPRE se verifica contra la API de Mercado Pago. */
session_name('gk_alta'); ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
$app = Billing::appUrl() . '/app.php';
$pid = (string)($_POST['pid'] ?? $_GET['pid'] ?? $_GET['preapproval_id'] ?? '');
function aviso(string $t, string $msg, string $cls = 'e', string $extra = ''): void { gk_page($t, '<h1>' . gk_esc($t) . '</h1><div class="' . $cls . '">' . gk_esc($msg) . '</div>' . $extra . gk_ayuda()); }
if ($pid === '' || !Billing::idOk($pid)) aviso('Revisá tu correo', 'Te enviamos un mail con el link para crear tu usuario y tu clave. Si no lo ves, mirá en spam.', 'o');
if (!rate_hit('alta:' . client_ip(), 30, 900)) aviso('Demasiados intentos', 'Esperá unos minutos y volvé a intentar.');
try { $sub = Billing::syncPreapproval($pid); }
catch (MpNotFound $e) { aviso('No encontramos tu suscripción', 'Revisá el link que te llegó por mail.'); }
catch (Throwable $e) { error_log('alta: ' . $e->getMessage()); aviso('Estamos verificando tu pago', 'No pudimos confirmarlo en este momento. Recargá esta página en un minuto.'); }
$ya = '<a class="b" href="' . gk_esc($app) . '">Entrar a Gaku</a>';
if (!empty($sub['user_id'])) aviso('Tu acceso ya está creado', 'Entrá con tu email y tu clave.', 'o', $ya);
if ($sub['status'] !== 'authorized') aviso('Esperando la confirmación del pago', 'Mercado Pago todavía no confirmó tu suscripción. Recargá esta página en un minuto.');
$err = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  $name = trim((string)($_POST['nombre'] ?? '')); $p1 = (string)($_POST['clave'] ?? ''); $p2 = (string)($_POST['clave2'] ?? '');
  $email = $sub['payer_email'] !== '' ? $sub['payer_email'] : strtolower(trim((string)($_POST['email'] ?? '')));
  if (!hash_equals((string)$_SESSION['csrf'], (string)($_POST['csrf'] ?? ''))) $err = 'La sesión venció. Recargá la página.';
  elseif ($name === '' || mb_strlen($name) > 80) $err = 'Escribí tu nombre.';
  elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $err = 'Escribí un email válido.';
  elseif ($p1 !== $p2) $err = 'Las dos claves no coinciden.';
  elseif (mb_strlen($p1) < 8) $err = 'La clave debe tener al menos 8 caracteres.';
  else {
    $pdo = db(); $pdo->beginTransaction();
    try {
      $cur = one('SELECT user_id FROM subscriptions WHERE preapproval_id=? FOR UPDATE', [$pid]);
      if ($cur && $cur['user_id'] !== null) { $pdo->rollBack(); aviso('Tu acceso ya está creado', 'Entrá con tu email y tu clave.', 'o', $ya); }
      if (one('SELECT id FROM users WHERE email=?', [$email])) { $pdo->rollBack(); $err = 'Ese email ya tiene una cuenta. Entrá a Gaku y usá "Olvidé mi contraseña".'; }
      else {
        q('INSERT INTO users(email,pass_hash,name,email_verified,settings,created_at) VALUES(?,?,?,1,?,?)', [$email, password_hash($p1, PASSWORD_DEFAULT), $name, '{}', time()]);
        $uid = (int)$pdo->lastInsertId();
        $u = q('UPDATE subscriptions SET user_id=? WHERE preapproval_id=? AND user_id IS NULL', [$uid, $pid]);
        if ($u->rowCount() !== 1) { $pdo->rollBack(); aviso('Tu acceso ya está creado', 'Entrá con tu email y tu clave.', 'o', $ya); }
        $pdo->commit();
        Billing::audit($email, 'alta_cuenta', 'preapproval ' . $pid);
        Billing::mailPublic($email, 'Tu cuenta de Gaku está lista', "Hola $name,\n\nTu cuenta quedó creada. Entrá desde:\n$app\n\nUsuario: $email\n", 'Tu cuenta está lista', '<p>Hola ' . gk_esc($name) . ', ya podés entrar a Gaku con tu correo y tu clave.</p><p><a href="' . gk_esc($app) . '" style="background:#0f5f73;color:#fff;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Entrar a Gaku</a></p>');
        aviso('¡Listo!', 'Tu cuenta quedó creada. Ya podés entrar con tu email y tu clave.', 'o', $ya);
      }
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); error_log('alta: ' . $e->getMessage()); $err = 'No pudimos crear la cuenta. Probá de nuevo.'; }
  }
}
$fixed = $sub['payer_email'] !== '';
gk_page('Creá tu acceso',
  '<h1>Creá tu acceso</h1><p>Tu suscripción está confirmada. Elegí la clave con la que vas a entrar.</p>' . ($err ? '<div class="e">' . gk_esc($err) . '</div>' : '')
  . '<form method="post" action="alta.php"><input type="hidden" name="csrf" value="' . gk_esc($_SESSION['csrf']) . '"><input type="hidden" name="pid" value="' . gk_esc($pid) . '">'
  . '<label for="n">Tu nombre</label><input id="n" name="nombre" required maxlength="80" autocomplete="name" value="' . gk_esc($_POST['nombre'] ?? '') . '">'
  . '<label for="e">Email</label><input id="e" name="email" type="email" required maxlength="190" autocomplete="email" value="' . gk_esc($fixed ? $sub['payer_email'] : ($_POST['email'] ?? '')) . '"' . ($fixed ? ' readonly' : '') . '>' . ($fixed ? '<small>Es el email de tu pago en Mercado Pago.</small>' : '')
  . '<label for="c">Clave (mínimo 8 caracteres)</label><input id="c" name="clave" type="password" required minlength="8" autocomplete="new-password">'
  . '<label for="c2">Repetí la clave</label><input id="c2" name="clave2" type="password" required minlength="8" autocomplete="new-password">'
  . '<button type="submit">Crear mi cuenta</button></form>');
