<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';
/* Panel del dueño de Gaku: resumen, landing, suscriptores, licencias (pago único), pagos y sistema.
   NO muestra los datos de estudio de nadie: solo cuentas, pagos y licencias. */
session_name('gk_admin'); ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['path' => '/', 'httponly' => true, 'samesite' => 'Strict', 'secure' => !empty($_SERVER['HTTPS'])]);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
header('X-Robots-Tag: noindex');
$adminEmail = strtolower(trim((string)cfg('admin.email'))); $adminHash = (string)cfg('admin.password_hash');

function money(int $cent, string $m = 'ARS'): string { return ($m === 'ARS' ? '$ ' : $m . ' ') . number_format($cent / 100, 0, ',', '.'); }
function dt($t): string { return $t ? gk_esc(date('d/m/Y H:i', (int)$t)) : '—'; }
function dts($t): string { return $t ? gk_esc(date('d/m H:i', (int)$t)) : '—'; }
function n(int $x): string { return number_format($x, 0, ',', '.'); }
function pct(int $a, int $b): string { return $b > 0 ? number_format($a * 100 / $b, 1, ',', '.') . '%' : '—'; }
function redir(string $q = ''): void { header('Location: admin.php' . $q); exit; }
function flash(string $t, string $h): void { $_SESSION['flash'] = [$t, $h]; }
function csrf_in(string $a, string $back, array $x = []): string {
  $h = '<input type="hidden" name="csrf" value="' . gk_esc($_SESSION['csrf']) . '"><input type="hidden" name="a" value="' . gk_esc($a) . '"><input type="hidden" name="volver" value="' . gk_esc($back) . '">';
  foreach ($x as $k => $v) $h .= '<input type="hidden" name="' . gk_esc($k) . '" value="' . gk_esc((string)$v) . '">';
  return $h;
}
function csrf_ok(): bool { return hash_equals((string)$_SESSION['csrf'], (string)($_POST['csrf'] ?? '')); }
function fails(): int { return (int)one('SELECT COUNT(*) c FROM rate WHERE bucket=? AND ts>?', ['adminfail:' . client_ip(), time() - 900])['c']; }

if (($_GET['salir'] ?? '') === '1' && !empty($_SESSION['admin'])) { $_SESSION = []; session_destroy(); redir(); }

// ---------- login ----------
if (empty($_SESSION['admin']) || time() - (int)($_SESSION['admin_t'] ?? 0) > 8 * 3600) {
  unset($_SESSION['admin']); $err = '';
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $e = strtolower(trim((string)($_POST['email'] ?? ''))); $p = (string)($_POST['clave'] ?? '');
    if (!csrf_ok()) $err = 'La sesión venció. Recargá la página.';
    elseif (fails() >= 5) $err = 'Demasiados intentos. Esperá unos minutos.';
    elseif ($adminHash !== '' && $adminEmail !== '' && hash_equals($adminEmail, $e) && password_verify($p, $adminHash)) {
      session_regenerate_id(true); $_SESSION['admin'] = true; $_SESSION['admin_t'] = time(); $_SESSION['csrf'] = bin2hex(random_bytes(16));
      q('DELETE FROM rate WHERE bucket=?', ['adminfail:' . client_ip()]); Billing::audit($e, 'admin_login'); redir();
    } else { q('INSERT INTO rate(bucket,ts) VALUES(?,?)', ['adminfail:' . client_ip(), time()]); Billing::audit($e ?: '-', 'admin_login_fallido'); $err = 'Datos incorrectos.'; }
  }
  gk_page('Panel', '<h1>Panel del dueño</h1>' . ($err ? '<div class="e">' . gk_esc($err) . '</div>' : '') . '<form method="post" action="admin.php"><input type="hidden" name="csrf" value="' . gk_esc($_SESSION['csrf']) . '"><label for="e">Email</label><input id="e" name="email" type="email" required autocomplete="username"><label for="c">Clave</label><input id="c" name="clave" type="password" required autocomplete="current-password"><button type="submit">Entrar</button></form>');
}
$_SESSION['admin_t'] = time();

// ---------- descargas ----------
if (($_GET['descargar'] ?? '') === 'clientes') {
  Billing::audit($adminEmail, 'admin_exporta_clientes');
  header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="gaku-clientes-' . date('Y-m-d') . '.csv"'); header('Cache-Control: no-store');
  $o = fopen('php://output', 'w'); fwrite($o, "\xEF\xBB\xBF"); fputcsv($o, ['Nombre', 'Email', 'Acceso', 'Motivo', 'Vence/próximo cobro', 'Alta', 'Último ingreso']);
  foreach (all('SELECT * FROM users ORDER BY id DESC') as $u) { $a = Billing::accessForUser((int)$u['id']); fputcsv($o, [$u['name'], $u['email'], $a['state'], $a['reason'], $a['until'] ? date('Y-m-d H:i', (int)$a['until']) : '', date('Y-m-d H:i', (int)$u['created_at']), $u['last_login'] ? date('Y-m-d H:i', (int)$u['last_login']) : '']); }
  fclose($o); exit;
}
if (($_GET['descargar'] ?? '') === 'licencias') {
  Billing::audit($adminEmail, 'admin_exporta_licencias');
  header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="gaku-licencias-' . date('Y-m-d') . '.csv"'); header('Cache-Control: no-store');
  $o = fopen('php://output', 'w'); fwrite($o, "\xEF\xBB\xBF"); fputcsv($o, ['Clave', 'Email', 'Estado', 'Origen', 'Dispositivos', 'Alta']);
  foreach (all('SELECT * FROM licenses ORDER BY id DESC') as $l) fputcsv($o, [$l['license_key'], $l['email'], $l['status'], $l['origin'], count(Billing::devicesOf((int)$l['id'])) . '/' . $l['max_devices'], date('Y-m-d H:i', (int)$l['created'])]);
  fclose($o); exit;
}

// ---------- acciones (POST + CSRF) -> siempre redirigen ----------
$V = ['resumen', 'landing', 'clientes', 'licencias', 'pagos', 'sistema'];
$vista = in_array($_GET['v'] ?? '', $V, true) ? (string)$_GET['v'] : 'resumen';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  $back = '?v=' . (in_array($_POST['volver'] ?? '', $V, true) ? $_POST['volver'] : 'clientes');
  if (!csrf_ok()) { flash('e', 'La sesión venció. Recargá la página e intentá de nuevo.'); redir($back); }
  $a = (string)($_POST['a'] ?? ''); $cid = (int)($_POST['cuenta'] ?? 0); $lid = (int)($_POST['lic'] ?? 0);
  $pdo = db();
  try {
    if ($a === 'crear_gracia') {
      $em = strtolower(trim((string)($_POST['email'] ?? ''))); $nom = trim((string)($_POST['nombre'] ?? '')); $cl = (string)($_POST['clave'] ?? '');
      $dias = max(1, min(3650, (int)($_POST['dias'] ?? 7))); $mot = mb_substr(trim((string)($_POST['motivo'] ?? '')), 0, 80) ?: 'Cuenta de gracia'; $gen = false;
      if ($cl === '') { $cl = substr(strtr(base64_encode(random_bytes(12)), '+/=', 'xyz'), 0, 12) . '7'; $gen = true; }
      if (!filter_var($em, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('El email no es válido.');
      if ($nom === '' || mb_strlen($nom) > 80) throw new RuntimeException('Escribí el nombre (hasta 80 caracteres).');
      if (!$gen && mb_strlen($cl) < 8) throw new RuntimeException('La clave debe tener al menos 8 caracteres.');
      if (one('SELECT id FROM users WHERE email=?', [$em])) throw new RuntimeException('Ese email ya tiene una cuenta. Buscala en Clientes y usá “Dar gracia”.');
      $pdo->beginTransaction(); $now = time(); $vence = $now + $dias * 86400;
      q('INSERT INTO users(email,pass_hash,name,email_verified,settings,created_at) VALUES(?,?,?,1,?,?)', [$em, password_hash($cl, PASSWORD_DEFAULT), $nom, '{}', $now]);
      $nid = (int)$pdo->lastInsertId();
      q('INSERT INTO subscriptions(preapproval_id,user_id,payer_email,status,reason,amount_cent,currency,period_days,next_charge,created,updated) VALUES(?,?,?,"authorized",?,0,"ARS",?,?,?,?)', ['manual-' . $nid . '-' . bin2hex(random_bytes(4)), $nid, $em, $mot, $dias, $vence, $now, $now]);
      $pdo->commit();
      Billing::audit($adminEmail, 'admin_crear_gracia', "$em · $dias días · $mot");
      flash('o', 'Cuenta de gracia creada para <b>' . gk_esc($em) . '</b> con acceso hasta el <b>' . gk_esc(date('d/m/Y', $vence)) . '</b>.' . ($gen ? '<br>Clave generada (se muestra una sola vez): <code>' . gk_esc($cl) . '</code>' : ''));
    } elseif ($a === 'dar_gracia' && $cid > 0) {
      $dias = max(1, min(3650, (int)($_POST['dias'] ?? 7)));
      $c = one('SELECT * FROM users WHERE id=?', [$cid]); if (!$c) throw new RuntimeException('No existe esa cuenta.');
      if ((int)one('SELECT COUNT(*) c FROM subscriptions WHERE user_id=? AND preapproval_id NOT LIKE "manual-%" AND status="authorized"', [$cid])['c'] > 0) throw new RuntimeException('Esa cuenta ya tiene una suscripción activa en Mercado Pago. Para regalar tiempo usá “Cortesía” en Acceso.');
      $man = one('SELECT * FROM subscriptions WHERE user_id=? AND preapproval_id LIKE "manual-%" ORDER BY id DESC LIMIT 1', [$cid]); $now = time();
      if ($man) { $vence = max($now, (int)$man['next_charge']) + $dias * 86400; q('UPDATE subscriptions SET status="authorized", next_charge=?, period_days=?, updated=? WHERE id=?', [$vence, $dias, $now, $man['id']]); }
      else { $vence = $now + $dias * 86400; q('INSERT INTO subscriptions(preapproval_id,user_id,payer_email,status,reason,amount_cent,currency,period_days,next_charge,created,updated) VALUES(?,?,?,"authorized","Cuenta de gracia",0,"ARS",?,?,?,?)', ['manual-' . $cid . '-' . bin2hex(random_bytes(4)), $cid, $c['email'], $dias, $vence, $now, $now]); }
      Billing::audit($adminEmail, 'admin_dar_gracia', $c['email'] . " · +$dias días");
      flash('o', 'Listo: <b>' . gk_esc($c['email']) . '</b> tiene acceso hasta el <b>' . gk_esc(date('d/m/Y', $vence)) . '</b>.');
    } elseif ($a === 'quitar_gracia' && $cid > 0) {
      q('UPDATE subscriptions SET status="cancelled", next_charge=?, updated=? WHERE user_id=? AND preapproval_id LIKE "manual-%"', [time() - 1, time(), $cid]);
      Billing::audit($adminEmail, 'admin_quitar_gracia', "cuenta $cid"); flash('o', 'Gracia retirada: la cuenta pasó a solo lectura.');
    } elseif ($a === 'override' && $cid > 0 && in_array($_POST['valor'] ?? '', ['auto', 'activo', 'bloqueado'], true)) {
      q('UPDATE users SET access_override=? WHERE id=?', [$_POST['valor'], $cid]); Billing::audit($adminEmail, 'admin_override', "cuenta $cid => " . $_POST['valor']); flash('o', 'Acceso actualizado.');
    } elseif ($a === 'link_clave' && $cid > 0) {
      $u = one('SELECT email FROM users WHERE id=?', [$cid]);
      if ($u) { $tok = bin2hex(random_bytes(20)); q('UPDATE users SET reset_token=?, reset_expires=? WHERE id=?', [hash('sha256', $tok), time() + 3600, $cid]); Billing::audit($adminEmail, 'admin_link_clave', "cuenta $cid");
        flash('o', 'Link de un solo uso (1 hora) para ' . gk_esc($u['email']) . ':<br><code style="word-break:break-all">' . gk_esc(Billing::appUrl() . '/app.php#/restablecer/' . $tok) . '</code>'); }
    } elseif ($a === 'resync') {
      $pre = (string)($_POST['pre'] ?? ''); $s = Billing::syncPreapproval($pre); Billing::audit($adminEmail, 'admin_resync', $pre); flash('o', 'Sincronizada con Mercado Pago (' . gk_esc($s['status']) . ').');
    } elseif ($a === 'pago_sync') {
      $pid = trim((string)($_POST['pago'] ?? '')); $o = Billing::syncPayment($pid); Billing::audit($adminEmail, 'admin_pago_sync', $pid);
      flash($o ? 'o' : 'e', $o ? 'Pago verificado. Pedido: ' . gk_esc($o['status']) : 'Ese pago no corresponde a Gaku.');
    } elseif ($a === 'lic_crear') {
      $em = strtolower(trim((string)($_POST['email'] ?? ''))); $note = mb_substr(trim((string)($_POST['nota'] ?? '')), 0, 120);
      if ($em !== '' && !filter_var($em, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('El email no es válido.');
      $l = Billing::newLicense($em, null, 'regalo', $note); Billing::audit($adminEmail, 'admin_lic_crear', $l['license_key'] . ' ' . $em);
      $mailed = ($em !== '' && Billing::mailLicense((int)$l['id']));
      flash('o', 'Licencia creada: <code>' . gk_esc($l['license_key']) . '</code><br>Link de descarga: <code style="word-break:break-all">' . gk_esc(Billing::appUrl() . '/descarga.php?k=' . $l['license_key']) . '</code>' . ($mailed ? '<br>Se la enviamos por mail.' : ''));
    } elseif ($a === 'lic_estado' && $lid > 0 && in_array($_POST['valor'] ?? '', ['active', 'revoked'], true)) {
      q('UPDATE licenses SET status=? WHERE id=?', [$_POST['valor'], $lid]); Billing::audit($adminEmail, 'admin_lic_' . $_POST['valor'], "lic $lid"); flash('o', $_POST['valor'] === 'revoked' ? 'Licencia dada de baja. Deja de abrir en la próxima validación.' : 'Licencia reactivada.');
    } elseif ($a === 'lic_reset' && $lid > 0) {
      q('UPDATE devices SET active=0 WHERE license_id=?', [$lid]); Billing::audit($adminEmail, 'admin_lic_reset', "lic $lid"); flash('o', 'Dispositivos liberados: puede activar hasta ' . (int)cfg('once.max_devices', 3) . ' de nuevo.');
    } elseif ($a === 'lic_liberar' && $lid > 0) {
      q('UPDATE devices SET active=0 WHERE id=? AND license_id=?', [(int)($_POST['disp'] ?? 0), $lid]); Billing::audit($adminEmail, 'admin_lic_liberar', "lic $lid"); flash('o', 'Dispositivo liberado.');
    } elseif ($a === 'lic_reenviar' && $lid > 0) {
      $ok = Billing::mailLicense($lid); flash($ok ? 'o' : 'e', $ok ? 'Licencia reenviada por mail.' : 'No se pudo enviar (¿falta el correo configurado o la licencia no tiene email?).');
    } elseif ($a === 'centro_token') {
      $tok = bin2hex(random_bytes(32));
      q('REPLACE INTO meta(k,v) VALUES(?,?)', ['centro_token_hash', hash('sha256', $tok)]);
      Billing::audit($adminEmail, 'admin_token_centro', '');
      flash('o', 'Token generado: <code style="word-break:break-all">' . gk_esc($tok) . '</code><br><small>Copialo ahora. Se muestra una sola vez. Si generás otro, el anterior deja de funcionar.</small>');
    }
  } catch (Throwable $e) {
    if (db()->inTransaction()) db()->rollBack();
    if (!$e instanceof RuntimeException) error_log('admin: ' . $e->getMessage());
    flash('e', $e instanceof RuntimeException ? gk_esc($e->getMessage()) : 'No se pudo completar la acción: ' . gk_esc($e->getMessage()));
  }
  redir($back);
}
$flash = $_SESSION['flash'] ?? null; unset($_SESSION['flash']);

// ---------- datos ----------
$rango = (int)($_GET['d'] ?? 30); if (!in_array($rango, [7, 30, 90], true)) $rango = 30;
$desde = date('Y-m-d', time() - ($rango - 1) * 86400); $desdeTs = strtotime($desde . ' 00:00:00'); $hoyD = date('Y-m-d');
$users = all('SELECT * FROM users ORDER BY id DESC LIMIT 1000');
$info = []; $cnt = ['pago' => 0, 'prueba' => 0, 'manual' => 0, 'cortesia' => 0, 'solo_lectura' => 0, 'bloqueado' => 0, 'invitado' => 0, 'activos' => 0]; $mrr = 0; $porVencer = [];
foreach ($users as $u) {
  $x = Billing::accessForUser((int)$u['id']);
  $kmap = ['paid' => 'pago', 'trial' => 'prueba', 'courtesy' => 'cortesia', 'manual' => 'manual'];
  $x['cat'] = $x['state'] === 'blocked' ? 'bloqueado' : (!$x['owner'] ? 'invitado' : ($x['state'] === 'readonly' ? 'solo_lectura' : ($kmap[$x['kind']] ?? 'solo_lectura')));
  if (!isset($cnt[$x['cat']])) $x['cat'] = 'solo_lectura';
  $info[$u['id']] = $x; $cnt[$x['cat']]++;
  if ($x['state'] === 'active') $cnt['activos']++;
  $s = $x['sub'] ?? null;
  if ($x['owner'] && $s && $s['status'] === 'authorized' && $x['cat'] === 'pago') $mrr += (int)round($s['amount_cent'] * 30 / max(1, (int)$s['period_days']));
  if ($x['owner'] && $x['state'] === 'active' && !empty($x['until']) && in_array($x['cat'], ['prueba', 'manual'], true) && $x['until'] - time() <= 3 * 86400) $porVencer[] = [$u, $x];
}
$sinCuenta = all('SELECT * FROM subscriptions WHERE user_id IS NULL AND preapproval_id NOT LIKE "manual-%" ORDER BY id DESC LIMIT 50');
$sinCuentaPagaron = array_values(array_filter($sinCuenta, fn($s) => $s['status'] === 'authorized'));
$evMal = (int)one('SELECT COUNT(*) c FROM mp_events WHERE received>? AND result IN ("bad_sig","error")', [time() - 86400])['c'];
$cuotasMal = (int)one('SELECT COUNT(*) c FROM payments WHERE status="recycling" AND updated>?', [time() - 14 * 86400])['c'];
$pedidosRaros = (int)one('SELECT COUNT(*) c FROM orders WHERE status="mismatch" OR (status="pending" AND created<? AND created>?)', [time() - 7200, time() - 3 * 86400])['c'];
$ventas = one('SELECT COUNT(*) c, COALESCE(SUM(amount_cent),0) m FROM orders WHERE status="approved"');
$licActivas = (int)one('SELECT COUNT(*) c FROM licenses WHERE status="active"')['c'];
$dispUsados = (int)one('SELECT COUNT(*) c FROM devices WHERE active=1')['c'];

$L = ['v' => 0, 'c' => 0, 'b' => 0, 'w' => 0, 'p' => 0, 'dm' => 0, 's9' => 0, 'app' => 0, 'dias' => [], 'origen' => [], 'disp' => [], 'boton' => [], 'hoyV' => 0, 'ultimo' => null];
for ($i = $rango - 1; $i >= 0; $i--) $L['dias'][date('Y-m-d', time() - $i * 86400)] = ['v' => 0, 'c' => 0, 'b' => 0];
foreach (all('SELECT day, COUNT(DISTINCT IF(type="visita",visitor,NULL)) v, COUNT(DISTINCT IF(type="click_sub",visitor,NULL)) c, COUNT(DISTINCT IF(type="click_buy",visitor,NULL)) b, COUNT(DISTINCT IF(type="click_wa",visitor,NULL)) w, COUNT(DISTINCT IF(type="precio",visitor,NULL)) p, COUNT(DISTINCT IF(type="demo",visitor,NULL)) dm, COUNT(DISTINCT IF(type="scroll90",visitor,NULL)) s9, COUNT(DISTINCT IF(type="click_app",visitor,NULL)) a FROM landing_events WHERE day>=? GROUP BY day', [$desde]) as $r) {
  $r['day'] = (string)$r['day']; $L['dias'][$r['day']] = ['v' => (int)$r['v'], 'c' => (int)$r['c'], 'b' => (int)$r['b']];
  foreach (['v', 'c', 'b', 'w', 'p', 'dm', 's9'] as $k) $L[$k] += (int)$r[$k]; $L['app'] += (int)$r['a'];
  if ($r['day'] === $hoyD) $L['hoyV'] = (int)$r['v'];
}
$L['origen'] = all('SELECT IF(source="","directo / sin dato",source) o, COUNT(DISTINCT IF(type="visita",CONCAT(day,visitor),NULL)) v, COUNT(DISTINCT IF(type IN ("click_sub","click_buy"),CONCAT(day,visitor),NULL)) c FROM landing_events WHERE day>=? GROUP BY o ORDER BY v DESC, c DESC LIMIT 12', [$desde]);
$L['disp'] = all('SELECT device d, COUNT(DISTINCT IF(type="visita",CONCAT(day,visitor),NULL)) v, COUNT(DISTINCT IF(type IN ("click_sub","click_buy"),CONCAT(day,visitor),NULL)) c FROM landing_events WHERE day>=? AND device<>"" GROUP BY d ORDER BY v DESC', [$desde]);
$L['boton'] = all('SELECT type t, IF(detail="","—",detail) b, COUNT(*) c FROM landing_events WHERE day>=? AND type IN ("click_sub","click_buy") GROUP BY t, b ORDER BY c DESC', [$desde]);
$r = one('SELECT MAX(ts) m FROM landing_events'); $L['ultimo'] = $r && $r['m'] ? (int)$r['m'] : null;
$subsIni = (int)one('SELECT COUNT(*) c FROM subscriptions WHERE preapproval_id NOT LIKE "manual-%" AND created>=?', [$desdeTs])['c'];
$subsAut = (int)one('SELECT COUNT(*) c FROM subscriptions WHERE preapproval_id NOT LIKE "manual-%" AND status="authorized" AND created>=?', [$desdeTs])['c'];
$conCuenta = (int)one('SELECT COUNT(*) c FROM subscriptions WHERE preapproval_id NOT LIKE "manual-%" AND user_id IS NOT NULL AND created>=?', [$desdeTs])['c'];
$conPago = (int)one('SELECT COUNT(DISTINCT p.preapproval_id) c FROM payments p JOIN subscriptions s ON s.preapproval_id=p.preapproval_id WHERE p.status="processed" AND s.created>=?', [$desdeTs])['c'];
$pedIni = (int)one('SELECT COUNT(*) c FROM orders WHERE created>=?', [$desdeTs])['c'];
$pedOk = (int)one('SELECT COUNT(*) c FROM orders WHERE status="approved" AND created>=?', [$desdeTs])['c'];

function barras(array $dias, string $k, string $k2 = ''): string {
  $max = 1; foreach ($dias as $d) $max = max($max, $d[$k]);
  $h = '<div class="bars">';
  foreach ($dias as $f => $d) { $a1 = $d[$k] > 0 ? max(4, (int)round($d[$k] * 100 / $max)) : 1; $a2 = ($k2 && $d[$k2] > 0) ? max(4, (int)round($d[$k2] * 100 / $max)) : 0;
    $h .= '<div class="b" title="' . gk_esc(date('d/m', strtotime($f))) . ': ' . $d[$k] . ($k2 ? ' · clicks ' . $d[$k2] : '') . '"><i style="height:' . $a1 . '%"></i>' . ($a2 ? '<u style="height:' . $a2 . '%"></u>' : '') . '</div>'; }
  return $h . '</div>';
}
function embudo(array $pasos): string {
  $top = max(1, (int)($pasos[0][1] ?? 1)); $h = '<div class="emb">';
  foreach ($pasos as $i => $p) { $w = max(2, (int)round($p[1] * 100 / $top)); $prev = $i > 0 ? (int)$pasos[$i - 1][1] : 0;
    $h .= '<div class="e1"><div class="el"><b>' . gk_esc($p[0]) . '</b><small>' . gk_esc($p[2] ?? '') . '</small></div><div class="eb"><i style="width:' . min(100, $w) . '%"></i></div><div class="ev"><b>' . n((int)$p[1]) . '</b>' . ($i > 0 ? '<small>' . pct((int)$p[1], $prev) . ' del paso anterior</small>' : '') . '</div></div>'; }
  return $h . '</div>';
}
$TABS = ['resumen' => 'Resumen', 'landing' => 'Landing', 'clientes' => 'Suscriptores', 'licencias' => 'Licencias', 'pagos' => 'Pagos', 'sistema' => 'Sistema'];
$hayLand = $L['ultimo'] !== null;

header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Frame-Options: DENY'); header('X-Content-Type-Options: nosniff');
?><!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Panel · Gaku</title><style>
:root{--bg:#f4f7f8;--ink:#14232b;--mut:#55676f;--ac:#0f6b7d;--ver:#3f8f6b;--card:#fff;--line:#d3dfe3;--ok:#1f5b3b;--bad:#8d2416;--warn:#7a5a10;--soft:#eaf0f2}
@media(prefers-color-scheme:dark){:root{--bg:#0e171c;--ink:#e8f1f4;--ac:#5cc0d2;--ver:#6cc79a;--mut:#9db1ba;--card:#15232a;--line:#29414c;--ok:#7fd3a8;--bad:#ff9486;--warn:#f0c060;--soft:#1c2d36}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px 16px 60px}
.w{max-width:1240px;margin:0 auto}h1{margin:0;font:700 1.4rem Georgia,serif}h2{margin:26px 0 10px;font:700 1.05rem Georgia,serif}h3{margin:0 0 10px;font-size:.95rem}
.top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}.top .t{display:flex;align-items:center;gap:10px}
.nav{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin-bottom:18px}.nav a{padding:10px 16px;text-decoration:none;color:var(--mut);font-weight:600;border-bottom:3px solid transparent;margin-bottom:-1px}.nav a.on{color:var(--ink);border-color:var(--ver)}
.k{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}.k div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}.k b{display:block;font-size:1.6rem;line-height:1.2}.k span{color:var(--mut);font-size:.82rem}.k small{display:block;color:var(--mut);margin-top:2px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:860px){.g2{grid-template-columns:1fr}}
.tw{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:14px}table{width:100%;border-collapse:collapse;min-width:680px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}th{font-size:.74rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);background:var(--soft)}
small,.mut{color:var(--mut)}.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:.75rem;font-weight:700;background:var(--soft)}.pill.ok{background:#e1f2e6;color:#1f5b3b}.pill.warn{background:#f6ebc6;color:#7a5a10}.pill.bad{background:#fbe0dd;color:#8d2416}.pill.ac{background:#d8edf1;color:#0f5f73}
@media(prefers-color-scheme:dark){.pill.ok{background:#1f3a27;color:#8fe0a6}.pill.warn{background:#41361a;color:#f0c060}.pill.bad{background:#472320;color:#ff9a8f}.pill.ac{background:#17353d;color:#8fdcea}}
.o,.e,.al{padding:11px 14px;border-radius:12px;margin:0 0 12px}.o{background:#e1f2e6;color:#1f5b3b}.e{background:#fbe0dd;color:#8d2416}.al{background:#f6ebc6;color:#6a4d0c}
@media(prefers-color-scheme:dark){.o{background:#1f3a27;color:#8fe0a6}.e{background:#472320;color:#ff9a8f}.al{background:#41361a;color:#f0c060}}
form.in{display:flex;gap:4px;margin:0 0 4px;flex-wrap:wrap}select,input,button{font:inherit;padding:6px 9px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}input{width:100%}form.in input{width:auto}
button{background:var(--ac);color:#fff;border:0;cursor:pointer;font-weight:600;margin:0}@media(prefers-color-scheme:dark){button{color:#14161f}}button.g{background:var(--bg);color:var(--ink);border:1px solid var(--line)}button.r{background:transparent;color:var(--bad);border:1px solid var(--line)}
a.btn{background:var(--ac);color:#fff;padding:8px 14px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block}a.btn.g{background:var(--card);color:var(--ink);border:1px solid var(--line)}a{color:var(--ac)}
label{display:block;font-size:.82rem;font-weight:600;margin:10px 0 3px;color:var(--mut)}code{background:var(--soft);padding:2px 6px;border-radius:6px}
.bars{display:flex;align-items:flex-end;gap:3px;height:120px;padding-top:6px}.bars .b{flex:1;height:100%;position:relative;min-width:3px}.bars i,.bars u{display:block;width:100%;border-radius:3px 3px 0 0;position:absolute;bottom:0;background:var(--ver)}.bars i{opacity:.3}
.emb .e1{display:grid;grid-template-columns:200px 1fr 150px;gap:12px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--line)}.emb .e1:last-child{border:0}.el small,.ev small{display:block;font-size:.76rem}.eb{background:var(--soft);border-radius:8px;height:22px;overflow:hidden}.eb i{display:block;height:100%;background:var(--ver);border-radius:8px}.ev b{font-size:1.15rem}@media(max-width:700px){.emb .e1{grid-template-columns:1fr}}
.rng a{padding:5px 12px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--ink);font-size:.85rem;margin-right:4px}.rng a.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
details.card>summary{cursor:pointer;font-weight:700;list-style:none}details.card>summary::before{content:'+ ';color:var(--ver)}details[open].card>summary::before{content:'– '}
</style></head><body><div class="w">
<div class="top"><div class="t"><h1>Gaku · Panel</h1></div><div><a class="btn g" href="admin.php?descargar=clientes">Suscriptores (CSV)</a> <a class="btn g" href="admin.php?descargar=licencias">Licencias (CSV)</a> &nbsp; <a href="admin.php?salir=1">Salir</a></div></div>
<div class="nav"><?php foreach ($TABS as $k => $t): ?><a class="<?= $vista === $k ? 'on' : '' ?>" href="admin.php?v=<?= $k ?>"><?= gk_esc($t) ?><?php if ($k === 'resumen' && ($sinCuentaPagaron || $evMal || $pedidosRaros)): ?> <span class="pill bad">!</span><?php endif; ?></a><?php endforeach; ?></div>
<?php if ($flash): ?><div class="<?= gk_esc($flash[0]) ?>"><?= $flash[1] ?></div><?php endif; ?>

<?php if ($vista === 'resumen'):
  $al = [];
  if ($sinCuentaPagaron) $al[] = '<b>' . count($sinCuentaPagaron) . ' persona(s) se suscribieron pero no crearon su acceso.</b> Mirá Pagos y reenviales el link de alta.';
  if ($pedidosRaros) $al[] = '<b>' . $pedidosRaros . ' pedido(s) de pago único sin resolver</b> (pendientes hace más de 2 horas o con monto distinto). Revisalos en Licencias.';
  if ($evMal) $al[] = '<b>' . $evMal . ' notificación(es) de Mercado Pago con error o firma inválida en las últimas 24 h.</b> Revisá Sistema.';
  if ($cuotasMal) $al[] = '<b>' . $cuotasMal . ' cobro(s) rechazados en reintento</b> en los últimos 14 días.';
  if ($porVencer) $al[] = '<b>' . count($porVencer) . ' cuenta(s) de prueba/gracia vencen en 3 días o menos.</b>';
  if (!$hayLand) $al[] = 'Todavía no llegó ninguna visita de la landing. Falta la línea <code>&lt;script src="track.js" defer&gt;&lt;/script&gt;</code> en tu index.html.';
  elseif (time() - $L['ultimo'] > 3 * 86400) $al[] = 'La landing no registra visitas desde hace más de 3 días (última: ' . dt($L['ultimo']) . ').';
  foreach ($al as $m): ?><div class="al"><?= $m ?></div><?php endforeach; if (!$al): ?><div class="o">Todo en orden: sin alertas.</div><?php endif; ?>
  <div class="k">
    <div><span>Visitantes hoy</span><b><?= n($L['hoyV']) ?></b><small>últimos <?= $rango ?> d: <?= n($L['v']) ?></small></div>
    <div><span>Clicks en comprar (<?= $rango ?> d)</span><b><?= n($L['c'] + $L['b']) ?></b><small><?= n($L['c']) ?> suscripción · <?= n($L['b']) ?> pago único</small></div>
    <div><span>Suscriptores con acceso</span><b><?= n($cnt['activos']) ?></b><small><?= n($cnt['pago']) ?> pagando · <?= n($cnt['prueba']) ?> prueba · <?= n($cnt['manual']) ?> gracia</small></div>
    <div><span>Ingreso mensual (suscripción)</span><b><?= gk_esc(money($mrr)) ?></b><small><?= n($cnt['solo_lectura']) ?> solo lectura · <?= n($cnt['bloqueado']) ?> bloqueados</small></div>
    <div><span>Pagos únicos vendidos</span><b><?= n((int)$ventas['c']) ?></b><small><?= gk_esc(money((int)$ventas['m'])) ?> · <?= n($licActivas) ?> licencias activas</small></div>
  </div>
  <div class="g2">
    <div class="card"><h3>Embudo · suscripción (<?= $rango ?> días)</h3><?= embudo([['Visitaron la landing', $L['v'], 'visitantes únicos por día'], ['Vieron los precios', $L['p'], 'llegaron a la sección de precios'], ['Tocaron “Suscribirme”', $L['c'], 'click en cualquier botón'], ['Iniciaron suscripción', $subsIni, 'checkout de Mercado Pago'], ['Crearon su cuenta', $conCuenta, 'usuario y clave'], ['Ya les cobraron', $conPago, 'primer pago aprobado']]) ?></div>
    <div class="card"><h3>Embudo · pago único (<?= $rango ?> días)</h3><?= embudo([['Visitaron la landing', $L['v'], 'visitantes únicos por día'], ['Vieron los precios', $L['p'], 'llegaron a la sección de precios'], ['Tocaron “Comprar el archivo”', $L['b'], 'click en cualquier botón'], ['Pedidos iniciados', $pedIni, 'fueron a Mercado Pago'], ['Pagos aprobados', $pedOk, 'licencia entregada']]) ?></div>
  </div>
  <div class="g2">
    <div class="card"><h3>Visitantes por día <span class="mut">(clara = visitantes, oscura = clicks de compra)</span></h3><?= barras($L['dias'], 'v', 'c') ?></div>
    <div class="card"><h3>Cuentas que vencen pronto</h3><?php if (!$porVencer): ?><p class="mut">Ninguna en los próximos 3 días.</p><?php else: ?><table style="min-width:0"><?php foreach ($porVencer as [$u, $x]): ?><tr><td><?= gk_esc($u['name']) ?><br><small><?= gk_esc($u['email']) ?></small></td><td><span class="pill warn"><?= $x['cat'] === 'prueba' ? 'prueba' : 'gracia' ?></span></td><td><?= dts($x['until']) ?></td></tr><?php endforeach; ?></table><?php endif; ?></div>
  </div>
  <div class="card"><h3>¿Qué me dicen estos números?</h3><ul style="margin:0;padding-left:18px">
    <?php if ($L['v'] >= 20 && ($L['c'] + $L['b']) === 0): ?><li><b>Hay visitas pero nadie toca los botones de compra.</b> Probá desde tu celular que abran Mercado Pago.</li><?php endif; ?>
    <?php if ($L['c'] >= 5 && $subsIni === 0): ?><li><b>Tocan “Suscribirme” pero no se inicia ninguna suscripción.</b> Abrí el link del plan en una ventana privada y revisá que el webhook llegue (Sistema).</li><?php endif; ?>
    <?php if ($L['b'] >= 5 && $pedIni === 0): ?><li><b>Tocan “Comprar” pero no se crea ningún pedido.</b> Probá <code>comprar.php</code> y mirá el error en Sistema.</li><?php endif; ?>
    <?php if ($pedIni > 0 && $pedOk < $pedIni / 2): ?><li>Menos de la mitad de los pedidos se pagan: puede ser normal, o Mercado Pago está rechazando.</li><?php endif; ?>
    <?php if ($subsIni > 0 && $conCuenta < $subsIni): ?><li><b>Hay <?= $subsIni - $conCuenta ?> suscripción(es) sin cuenta creada.</b></li><?php endif; ?>
    <?php if ($L['v'] > 0 && $L['dm'] * 100 < $L['v'] * 20): ?><li>Pocos llegan a la demo: probá que la invitación a “Probar la app” se vea mejor arriba.</li><?php endif; ?>
    <?php if ($L['v'] < 20 && ($L['c'] + $L['b']) < 5 && $subsIni < 1 && $pedIni < 1): ?><li>Todavía hay pocos datos para sacar conclusiones.</li><?php endif; ?>
  </ul></div>

<?php elseif ($vista === 'landing'): ?>
  <div class="rng" style="margin-bottom:12px">Período: <?php foreach ([7, 30, 90] as $d): ?><a class="<?= $rango === $d ? 'on' : '' ?>" href="admin.php?v=landing&d=<?= $d ?>"><?= $d ?> días</a><?php endforeach; ?></div>
  <?php if (!$hayLand): ?><div class="card"><h3>Todavía no hay datos de la landing</h3><p>Para empezar a contar visitas y clicks la landing debe tener esta línea antes de <code>&lt;/body&gt;</code>: <code>&lt;script src="track.js" defer&gt;&lt;/script&gt;</code> (y <code>track.js</code> + <code>track.php</code> subidos junto a <code>index.html</code>).</p><p class="mut">No usa cookies ni guarda tu IP.</p></div>
  <?php else: ?>
  <div class="k">
    <div><span>Visitantes (únicos por día)</span><b><?= n($L['v']) ?></b><small>hoy: <?= n($L['hoyV']) ?></small></div>
    <div><span>Llegaron a los precios</span><b><?= n($L['p']) ?></b><small><?= pct($L['p'], $L['v']) ?></small></div>
    <div><span>Vieron la demo</span><b><?= n($L['dm']) ?></b><small><?= pct($L['dm'], $L['v']) ?></small></div>
    <div><span>Click “Suscribirme”</span><b><?= n($L['c']) ?></b><small><?= pct($L['c'], $L['v']) ?></small></div>
    <div><span>Click “Comprar el archivo”</span><b><?= n($L['b']) ?></b><small><?= pct($L['b'], $L['v']) ?></small></div>
    <div><span>Click WhatsApp</span><b><?= n($L['w']) ?></b><small><?= pct($L['w'], $L['v']) ?></small></div>
    <div><span>Scroll hasta 90%</span><b><?= n($L['s9']) ?></b><small><?= pct($L['s9'], $L['v']) ?></small></div>
  </div>
  <div class="card"><h3>Visitantes y clicks por día</h3><?= barras($L['dias'], 'v', 'c') ?><p class="mut" style="margin:6px 0 0;font-size:.82rem">Último evento: <?= dt($L['ultimo']) ?></p></div>
  <div class="g2">
    <div class="card"><h3>De dónde llegan</h3><table style="min-width:0"><tr><th>Origen</th><th>Visitas</th><th>Clicks compra</th><th>Conv.</th></tr><?php foreach ($L['origen'] as $r): ?><tr><td><?= gk_esc($r['o']) ?></td><td><?= n((int)$r['v']) ?></td><td><?= n((int)$r['c']) ?></td><td><?= pct((int)$r['c'], (int)$r['v']) ?></td></tr><?php endforeach; ?></table><p class="mut" style="margin:8px 0 0;font-size:.82rem">Tip: en tu bio usá <code>?utm_source=instagram_bio</code> y en cada Reel <code>?utm_source=reel</code>.</p></div>
    <div class="card"><h3>Dispositivo</h3><table style="min-width:0"><tr><th></th><th>Visitas</th><th>Clicks</th><th>Conv.</th></tr><?php $nm = ['movil' => 'Celular', 'tablet' => 'Tablet', 'pc' => 'Computadora']; foreach ($L['disp'] as $r): ?><tr><td><?= gk_esc($nm[$r['d']] ?? $r['d']) ?></td><td><?= n((int)$r['v']) ?></td><td><?= n((int)$r['c']) ?></td><td><?= pct((int)$r['c'], (int)$r['v']) ?></td></tr><?php endforeach; ?></table>
      <h3 style="margin-top:18px">Qué botón tocan</h3><table style="min-width:0"><?php foreach ($L['boton'] as $r): ?><tr><td><?= $r['t'] === 'click_buy' ? 'Archivo' : 'Suscripción' ?> · <?= gk_esc($r['b']) ?></td><td><?= n((int)$r['c']) ?></td></tr><?php endforeach; if (!$L['boton']) echo '<tr><td class="mut">Todavía ninguno.</td></tr>'; ?></table></div>
  </div>
  <div class="card"><h3>Detalle por día</h3><div class="tw" style="border:0"><table style="min-width:0"><tr><th>Día</th><th>Visitantes</th><th>Clicks suscripción</th><th>Clicks archivo</th></tr><?php foreach (array_reverse($L['dias'], true) as $f => $d): ?><tr><td><?= gk_esc(date('d/m (D)', strtotime($f))) ?></td><td><?= n($d['v']) ?></td><td><?= n($d['c']) ?></td><td><?= n($d['b']) ?></td></tr><?php endforeach; ?></table></div></div>
  <?php endif; ?>

<?php elseif ($vista === 'clientes'): $q = trim((string)($_GET['q'] ?? '')); $f = (string)($_GET['f'] ?? 'todos'); ?>
  <details class="card"><summary>Crear cuenta de gracia (prueba o regalo)</summary>
    <form method="post" action="admin.php" style="max-width:560px;margin-top:6px"><?= csrf_in('crear_gracia', 'clientes') ?>
      <div class="g2" style="gap:10px"><div><label for="n1">Nombre</label><input id="n1" name="nombre" required maxlength="80"></div><div><label for="e1">Email</label><input id="e1" name="email" type="email" required maxlength="190"></div></div>
      <div class="g2" style="gap:10px"><div><label for="d1">Días de acceso</label><input id="d1" name="dias" type="number" value="7" min="1" max="3650" required></div><div><label for="m1">Motivo (solo para vos)</label><input id="m1" name="motivo" maxlength="80" placeholder="Regalo, prueba, influencer…"></div></div>
      <label for="c1">Clave (opcional)</label><input id="c1" name="clave" type="text" autocomplete="off" placeholder="Vacío = se genera una segura y te la muestro"><small>Mínimo 8 caracteres si la escribís vos.</small>
      <div style="margin-top:12px"><button type="submit">Activar cuenta</button></div></form></details>
  <form method="get" action="admin.php" class="in" style="margin:6px 0 12px"><input type="hidden" name="v" value="clientes"><input name="q" value="<?= gk_esc($q) ?>" placeholder="Buscar por nombre o email" style="min-width:240px"><select name="f"><?php foreach (['todos' => 'Todos', 'pago' => 'Pagando', 'prueba' => 'En prueba (MP)', 'manual' => 'Gracia', 'cortesia' => 'Cortesía', 'invitado' => 'Invitados de una familia', 'solo_lectura' => 'Solo lectura', 'bloqueado' => 'Bloqueados'] as $k => $l): ?><option value="<?= $k ?>" <?= $f === $k ? 'selected' : '' ?>><?= $l ?></option><?php endforeach; ?></select><button class="g">Filtrar</button></form>
  <div class="tw"><table><tr><th>Cliente</th><th>Estado</th><th>Vence / próximo cobro</th><th>Alta · ingreso</th><th>Acciones</th></tr>
  <?php $mostradas = 0; foreach ($users as $c): $x = $info[$c['id']]; $s = $x['sub'] ?? null;
    if ($q !== '' && stripos($c['name'] . ' ' . $c['email'], $q) === false) continue; if ($f !== 'todos' && $x['cat'] !== $f) continue; $mostradas++;
    $pill = ['pago' => ['ok', 'Pagando'], 'prueba' => ['ac', 'Prueba MP'], 'manual' => ['ac', 'Gracia'], 'cortesia' => ['ac', 'Cortesía'], 'invitado' => ['', 'Invitado'], 'solo_lectura' => ['warn', 'Solo lectura'], 'bloqueado' => ['bad', 'Bloqueado']][$x['cat']];
    $opts = ''; foreach (['auto' => 'Automático', 'activo' => 'Cortesía (siempre activo)', 'bloqueado' => 'Bloqueado'] as $k => $l) $opts .= '<option value="' . $k . '"' . ($c['access_override'] === $k ? ' selected' : '') . '>' . $l . '</option>'; ?>
    <tr><td><b><?= gk_esc($c['name']) ?></b><br><small><?= gk_esc($c['email']) ?></small></td>
      <td><span class="pill <?= $pill[0] ?>"><?= $pill[1] ?></span><?= $c['access_override'] !== 'auto' ? ' <span class="pill">' . gk_esc($c['access_override']) . '</span>' : '' ?><br><small><?= gk_esc($x['reason']) ?></small></td>
      <td><?php if (!empty($x['until'])): ?><?= dt($x['until']) ?><?php if ($x['state'] === 'active'): ?><br><small>faltan <?= (int)ceil(($x['until'] - time()) / 86400) ?> día(s)</small><?php endif; else: ?>—<?php endif; ?><?php if ($s && $x['cat'] === 'pago'): ?><br><small><?= gk_esc(money((int)$s['amount_cent'], $s['currency'])) ?> · próx. <?= dts($s['next_charge']) ?></small><?php endif; ?></td>
      <td><?= dts($c['created_at']) ?><br><small>ingresó <?= dts($c['last_login']) ?></small></td>
      <td><form method="post" action="admin.php" class="in"><?= csrf_in('dar_gracia', 'clientes', ['cuenta' => $c['id']]) ?><input name="dias" type="number" value="7" min="1" max="3650" style="width:70px" aria-label="Días"><button class="g">Dar / extender gracia</button></form>
        <form method="post" action="admin.php" class="in"><?= csrf_in('override', 'clientes', ['cuenta' => $c['id']]) ?><select name="valor"><?= $opts ?></select><button class="g">Guardar</button></form>
        <form method="post" action="admin.php" class="in"><?= csrf_in('link_clave', 'clientes', ['cuenta' => $c['id']]) ?><button class="g">Link de clave</button></form>
        <?php if ($s && strpos((string)$s['preapproval_id'], 'manual-') !== 0): ?><form method="post" action="admin.php" class="in"><?= csrf_in('resync', 'clientes', ['pre' => $s['preapproval_id']]) ?><button class="g">Sincronizar con MP</button></form>
        <?php elseif ($s && $x['cat'] === 'manual'): ?><form method="post" action="admin.php" class="in"><?= csrf_in('quitar_gracia', 'clientes', ['cuenta' => $c['id']]) ?><button class="r">Quitar gracia</button></form><?php endif; ?></td></tr>
  <?php endforeach; if (!$mostradas) echo '<tr><td colspan="5" class="mut">' . ($users ? 'Ningún cliente coincide con el filtro.' : 'Todavía no hay clientes.') . '</td></tr>'; ?></table></div>

<?php elseif ($vista === 'licencias'): ?>
  <div class="k"><div><span>Pagos únicos aprobados</span><b><?= n((int)$ventas['c']) ?></b><small><?= gk_esc(money((int)$ventas['m'])) ?></small></div><div><span>Licencias activas</span><b><?= n($licActivas) ?></b></div><div><span>Dispositivos en uso</span><b><?= n($dispUsados) ?></b></div></div>
  <details class="card"><summary>Crear licencia (regalo o cobro por fuera)</summary>
    <form method="post" action="admin.php" style="max-width:520px;margin-top:6px"><?= csrf_in('lic_crear', 'licencias') ?>
      <label for="le">Email (opcional: se la mandamos si hay correo configurado)</label><input id="le" name="email" type="email" maxlength="190">
      <label for="ln">Nota (solo para vos)</label><input id="ln" name="nota" maxlength="120" placeholder="Regalo, sorteo, amigo…"><div style="margin-top:12px"><button type="submit">Crear licencia</button></div></form></details>
  <div class="tw"><table><tr><th>Licencia</th><th>Email</th><th>Estado</th><th>Dispositivos</th><th>Alta</th><th>Acciones</th></tr>
  <?php foreach (all('SELECT * FROM licenses ORDER BY id DESC LIMIT 200') as $l): $dv = Billing::devicesOf((int)$l['id']); ?>
    <tr><td><code><?= gk_esc($l['license_key']) ?></code><br><small><?= gk_esc($l['origin']) ?><?= $l['note'] ? ' · ' . gk_esc($l['note']) : '' ?></small></td><td><?= gk_esc($l['email'] ?: '—') ?></td>
      <td><span class="pill <?= $l['status'] === 'active' ? 'ok' : 'bad' ?>"><?= $l['status'] === 'active' ? 'Activa' : 'Dada de baja' ?></span></td>
      <td><b><?= count($dv) ?>/<?= (int)$l['max_devices'] ?></b><?php foreach ($dv as $d): ?><form method="post" action="admin.php" class="in" style="margin-top:4px"><?= csrf_in('lic_liberar', 'licencias', ['lic' => $l['id'], 'disp' => $d['id']]) ?><small><?= gk_esc($d['label'] ?: 'Dispositivo') ?> · <?= dts($d['last_seen']) ?></small><button class="r" style="padding:2px 8px">Liberar</button></form><?php endforeach; ?></td>
      <td><?= dts($l['created']) ?></td>
      <td><?php if ($dv): ?><form method="post" action="admin.php" class="in"><?= csrf_in('lic_reset', 'licencias', ['lic' => $l['id']]) ?><button class="g">Liberar todos</button></form><?php endif; ?>
        <?php if ($l['email']): ?><form method="post" action="admin.php" class="in"><?= csrf_in('lic_reenviar', 'licencias', ['lic' => $l['id']]) ?><button class="g">Reenviar por mail</button></form><?php endif; ?>
        <form method="post" action="admin.php" class="in"><?= csrf_in('lic_estado', 'licencias', ['lic' => $l['id'], 'valor' => $l['status'] === 'active' ? 'revoked' : 'active']) ?><button class="<?= $l['status'] === 'active' ? 'r' : 'g' ?>"><?= $l['status'] === 'active' ? 'Dar de baja' : 'Reactivar' ?></button></form></td></tr>
  <?php endforeach; ?></table></div>
  <h2>Pedidos de pago único</h2><div class="tw"><table><tr><th>Pedido</th><th>Estado</th><th>Email del pago</th><th>Monto</th><th>Fecha</th></tr>
  <?php foreach (all('SELECT * FROM orders ORDER BY created DESC LIMIT 60') as $o): ?><tr><td><code><?= gk_esc($o['id']) ?></code><br><small>pago MP: <?= gk_esc($o['mp_payment_id'] ?: '—') ?></small></td><td><span class="pill <?= $o['status'] === 'approved' ? 'ok' : (in_array($o['status'], ['mismatch', 'rejected', 'refunded'], true) ? 'bad' : 'warn') ?>"><?= gk_esc($o['status']) ?></span></td><td><?= gk_esc($o['payer_email'] ?: '—') ?></td><td><?= gk_esc(money((int)$o['amount_cent'])) ?></td><td><?= dts($o['created']) ?></td></tr><?php endforeach; ?></table></div>
  <details class="card" style="margin-top:12px"><summary>¿Pagó y no le llegó la licencia? Verificar un pago</summary><form method="post" action="admin.php" class="in" style="margin-top:8px"><?= csrf_in('pago_sync', 'licencias') ?><input name="pago" placeholder="Número de pago de Mercado Pago" required style="min-width:260px"><button>Verificar y entregar</button></form></details>

<?php elseif ($vista === 'pagos'): ?>
  <?php if ($sinCuenta): ?><h2>Se suscribieron pero no crearon su acceso</h2><div class="tw"><table><tr><th>Email del pago</th><th>Estado</th><th>Fecha</th><th>Link de alta para reenviarle</th></tr>
    <?php foreach ($sinCuenta as $s): ?><tr><td><?= gk_esc($s['payer_email'] ?: '—') ?></td><td><span class="pill <?= $s['status'] === 'authorized' ? 'warn' : '' ?>"><?= gk_esc($s['status']) ?></span></td><td><?= dts($s['created']) ?></td><td><?php if ($s['status'] === 'authorized'): ?><code style="word-break:break-all"><?= gk_esc(Billing::appUrl() . '/alta.php?pid=' . $s['preapproval_id']) ?></code><?php else: ?><small>sin autorizar</small><?php endif; ?></td></tr><?php endforeach; ?></table></div><?php endif; ?>
  <h2>Cuotas de suscripción</h2><div class="tw"><table><tr><th>Fecha</th><th>Cliente</th><th>Estado</th><th>Monto</th></tr>
  <?php $pagos = all('SELECT p.*, u.email FROM payments p LEFT JOIN subscriptions s ON s.preapproval_id=p.preapproval_id LEFT JOIN users u ON u.id=s.user_id ORDER BY p.id DESC LIMIT 100'); foreach ($pagos as $p): ?>
    <tr><td><?= dts($p['debit_date'] ?: $p['created']) ?></td><td><?= gk_esc((string)$p['email']) ?></td><td><span class="pill <?= $p['status'] === 'processed' ? 'ok' : ($p['status'] === 'recycling' ? 'bad' : '') ?>"><?= gk_esc($p['status']) ?></span><?= $p['retry'] ? ' (reintento ' . (int)$p['retry'] . ')' : '' ?><br><small><?= gk_esc($p['detail']) ?></small></td><td><?= gk_esc(money((int)$p['amount_cent'], $p['currency'])) ?></td></tr>
  <?php endforeach; if (!$pagos) echo '<tr><td colspan="4" class="mut">Sin cuotas todavía.</td></tr>'; ?></table></div>

<?php else: $ult = one('SELECT MAX(received) m FROM mp_events')['m'] ?? null; $okc = fn(bool $b, string $si, string $no) => '<span class="pill ' . ($b ? 'ok' : 'bad') . '">' . gk_esc($b ? $si : $no) . '</span>';
  $kf = STORAGE . '/keys/gaku-ec.pem'; ?>
  <div class="card"><h3>Conectar al Centro de operaciones</h3><form method="post" action="admin.php" class="in"><?= csrf_in('centro_token', 'sistema') ?><button class="p">Generar token para Centro</button></form></div>
  <div class="card"><h3>Diagnóstico</h3><table style="min-width:0">
    <tr><td>Credencial de Mercado Pago (access token)</td><td><?= $okc((string)cfg('mp.access_token') !== '', 'cargada', 'falta') ?></td></tr>
    <tr><td>Clave secreta del webhook</td><td><?= $okc((string)cfg('mp.webhook_secret') !== '', 'cargada', 'falta') ?></td></tr>
    <tr><td>Link del plan de suscripción</td><td><?= $okc((string)cfg('mp.plan_url') !== '', 'configurado', 'sin completar') ?></td></tr>
    <tr><td>Sitio con HTTPS</td><td><?= $okc(strpos(Billing::appUrl(), 'https://') === 0, 'sí', 'no') ?></td></tr>
    <tr><td>Envío de mails</td><td><?= $okc(Mailer::configured(), 'configurado', 'sin configurar (los datos se muestran en pantalla)') ?></td></tr>
    <tr><td>Clave de firma de licencias</td><td><?= is_file($kf) ? $okc(true, 'creada (hacé copia de storage/keys)', '') : '<span class="pill warn">se crea con la primera descarga</span>' ?></td></tr>
    <tr><td>Archivo base de la versión HTML</td><td><?= $okc(is_file(ROOT . '/lib/local-template.html'), 'presente', 'falta lib/local-template.html') ?></td></tr>
    <tr><td>Última notificación de Mercado Pago</td><td><?= $ult ? dt($ult) : '<span class="pill warn">ninguna todavía</span>' ?></td></tr>
    <tr><td>Notificaciones con error (24 h)</td><td><?= $evMal ? '<span class="pill bad">' . $evMal . '</span>' : '<span class="pill ok">0</span>' ?></td></tr>
    <tr><td>Contador de landing</td><td><?= $hayLand ? $okc(true, 'recibiendo (último ' . date('d/m H:i', $L['ultimo']) . ')', '') : '<span class="pill warn">sin datos: falta track.js en la landing</span>' ?></td></tr>
  </table></div>
  <h2>Notificaciones de Mercado Pago</h2><div class="tw"><table><tr><th>Recibido</th><th>Tema</th><th>ID</th><th>Firma</th><th>Resultado</th></tr>
  <?php foreach (all('SELECT * FROM mp_events ORDER BY id DESC LIMIT 40') as $e): ?><tr><td><?= dts($e['received']) ?></td><td><?= gk_esc($e['topic']) ?></td><td><?= gk_esc($e['data_id']) ?></td><td><?= $e['sig_ok'] ? 'ok' : '<b class="bad">no</b>' ?></td><td><span class="pill <?= $e['result'] === 'ok' ? 'ok' : (in_array($e['result'], ['error', 'bad_sig'], true) ? 'bad' : '') ?>"><?= gk_esc($e['result']) ?></span><br><small><?= gk_esc($e['detail']) ?></small></td></tr><?php endforeach; ?></table></div>
  <h2>Auditoría</h2><div class="tw"><table><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr>
  <?php foreach (all('SELECT * FROM audit ORDER BY id DESC LIMIT 60') as $e): ?><tr><td><?= dts($e['ts']) ?></td><td><?= gk_esc($e['actor']) ?></td><td><?= gk_esc($e['action']) ?></td><td><small><?= gk_esc($e['detail']) ?></small></td></tr><?php endforeach; ?></table></div>
<?php endif; ?>
</div></body></html>
