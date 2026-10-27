<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/web.php';
/* Webhook de Mercado Pago. Tus integraciones → Webhooks → URL https://TU-DOMINIO/webhook.php
   Eventos: "Planes y suscripciones" (suscripciones y pagos recurrentes) y "Pagos" (pago único).
   Responde 200 solo si procesó (o si no corresponde); 5xx para que Mercado Pago reintente. */
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
function fin(int $c, array $d = []): void { http_response_code($c); echo json_encode($d); exit; }
function bitacora(string $topic, string $id, bool $sig, string $res, string $det = ''): void {
  try { q('INSERT INTO mp_events(received,topic,data_id,sig_ok,result,detail) VALUES(?,?,?,?,?,?)', [time(), mb_substr($topic, 0, 60), mb_substr($id, 0, 80), $sig ? 1 : 0, $res, mb_substr($det, 0, 250)]); }
  catch (Throwable $e) { error_log('mp_events: ' . $e->getMessage()); }
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fin(405, ['error' => 'POST']);
$raw = file_get_contents('php://input', false, null, 0, 65537);
if ($raw === false || strlen($raw) > 65536) fin(413, ['error' => 'grande']);
$j = json_decode($raw, true); if (!is_array($j)) $j = [];
$topic = (string)($_GET['type'] ?? $_GET['topic'] ?? $j['type'] ?? $j['topic'] ?? '');
$dataId = trim((string)($_GET['data_id'] ?? $_GET['data.id'] ?? ($j['data']['id'] ?? $j['id'] ?? '')));
$secret = (string)cfg('mp.webhook_secret');
if ($secret === '') { bitacora($topic, $dataId, false, 'error', 'Falta mp.webhook_secret'); fin(503, ['error' => 'sin configurar']); }
if (!Billing::sigOk($dataId, (string)($_SERVER['HTTP_X_SIGNATURE'] ?? ''), (string)($_SERVER['HTTP_X_REQUEST_ID'] ?? ''), $secret)) { bitacora($topic, $dataId, false, 'bad_sig'); fin(401, ['error' => 'firma']); }
if (!Billing::idOk($dataId)) { bitacora($topic, $dataId, true, 'ignored', 'id inválido'); fin(200, ['ok' => true]); }
try {
  if ($topic === 'subscription_preapproval') {
    $sub = Billing::syncPreapproval($dataId);
    if ($sub['_new'] || ($sub['_prev'] !== 'authorized' && $sub['status'] === 'authorized')) Billing::notifyAlta($sub);
    if ($sub['_prev'] !== null && $sub['_prev'] !== $sub['status']) Billing::audit('mercadopago', 'sub_' . $sub['status'], $dataId);
    bitacora($topic, $dataId, true, 'ok', $sub['status']);
  } elseif ($topic === 'subscription_authorized_payment') {
    $r = Billing::syncCuota($dataId); bitacora($topic, $dataId, true, 'ok', $r['status']);
  } elseif ($topic === 'payment') {
    $o = Billing::syncPayment($dataId);
    bitacora($topic, $dataId, true, $o ? 'ok' : 'ignored', $o ? ('pedido ' . $o['status']) : 'no es de Gaku');
  } else { bitacora($topic, $dataId, true, 'ignored', 'tema no manejado'); }
} catch (MpNotFound $e) { bitacora($topic, $dataId, true, 'ignored', 'MP no conoce ese id'); fin(200, ['ok' => true]); }
catch (Throwable $e) { bitacora($topic, $dataId, true, 'error', $e->getMessage()); error_log('webhook: ' . $e->getMessage()); fin(500, ['error' => 'reintentar']); }
fin(200, ['ok' => true]);
