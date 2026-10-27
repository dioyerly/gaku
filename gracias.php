<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';
/* A donde vuelve el comprador después de pagar (back_url). No confiamos en lo que trae la URL: se verifica con la API. */
$ref = (string)($_GET['external_reference'] ?? $_GET['o'] ?? '');
$pay = (string)($_GET['payment_id'] ?? $_GET['collection_id'] ?? '');
if ($pay !== '' && Billing::idOk($pay) && $pay !== 'null' && rate_hit('thx:' . client_ip(), 30, 900)) {
  try { $o = Billing::syncPayment($pay); if ($o && $ref === '') $ref = $o['id']; } catch (Throwable $e) { error_log('gracias: ' . $e->getMessage()); }
}
$o = preg_match('/^GK[A-F0-9]{16}$/', $ref) ? one('SELECT * FROM orders WHERE id=?', [$ref]) : null;
if (!$o) gk_page('Gracias', '<h1>Revisá tu correo</h1><p>Si ya pagaste, en unos minutos te llega tu clave de licencia y el link de descarga.</p><p class="m">¿Perdiste el mail? <a href="licencia.php">Recuperar mi licencia</a>.</p>' . gk_ayuda());
if ($o['status'] === 'approved' && $o['license_id']) {
  $l = one('SELECT * FROM licenses WHERE id=?', [$o['license_id']]);
  $dl = 'descarga.php?k=' . rawurlencode($l['license_key']);
  gk_page('¡Gracias por tu compra!', '<h1>¡Gracias por tu compra!</h1><div class="o">Tu pago está aprobado.</div><p>Esta es tu <b>clave de licencia</b>. Guardala bien:</p><div class="key">' . gk_esc($l['license_key']) . '</div>'
    . '<a class="b" href="' . gk_esc($dl) . '">Abrir Gaku</a>'
    . '<ol><li>Tocá Abrir Gaku. Se abre en esta misma pestaña.</li><li>Escribí tu clave y elegí una contraseña.</li></ol>'
    . '<p class="m">Podés usarlo en hasta ' . (int)$l['max_devices'] . ' dispositivos. También te lo mandamos por mail' . (Mailer::configured() ? '' : ' (si está disponible)') . '.</p>' . gk_ayuda());
}
if ($o['status'] === 'refunded') gk_page('Pago devuelto', '<h1>Pago devuelto</h1><div class="n">Este pago fue devuelto, por eso la licencia no está activa.</div>' . gk_ayuda());
if (in_array($o['status'], ['rejected', 'mismatch'], true)) gk_page('Pago no aprobado', '<h1>El pago no se aprobó</h1><div class="e">Mercado Pago no aprobó este pago.</div><a class="b" href="index.html#precio">Volver a intentar</a>' . gk_ayuda());
gk_page('Confirmando tu pago', '<h1>Confirmando tu pago…</h1><div class="n">Mercado Pago todavía no lo confirmó. Puede tardar un minuto.</div><a class="b" href="gracias.php?o=' . gk_esc($o['id']) . '">Actualizar</a>' . gk_ayuda());
