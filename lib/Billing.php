<?php
declare(strict_types=1);

class MpNotFound extends RuntimeException {}

/**
 * Cobros de Gaku: suscripción (Mercado Pago preapproval), pago único (licencia) y control de acceso.
 * Regla de oro: del webhook solo usamos el id; el estado real se le pide a la API de Mercado Pago.
 */
final class Billing
{
    // ------------------------------------------------------------------ utilidades
    public static function idOk(string $id): bool { return (bool)preg_match('/^[A-Za-z0-9_-]{1,80}$/', $id); }
    public static function cents($v): int { return (int)round(((float)$v) * 100); }
    public static function iso($s): ?int
    {
        if (!is_string($s) || $s === '') return null;
        $t = strtotime($s);
        return $t === false ? null : $t;
    }
    public static function audit(string $actor, string $action, string $detail = ''): void
    {
        try {
            q('INSERT INTO audit(ts,actor,action,detail,ip) VALUES(?,?,?,?,?)', [time(), mb_substr($actor, 0, 190), mb_substr($action, 0, 60), mb_substr($detail, 0, 250), client_ip()]);
        } catch (Throwable $e) { error_log('audit: ' . $e->getMessage()); }
    }
    public static function appUrl(): string
    {
        $u = rtrim((string)cfg('app_url'), '/');
        if ($u !== '') return $u;
        $scheme = (!empty($_SERVER['HTTPS']) || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')) ? 'https' : 'http';
        return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }

    // ------------------------------------------------------------------ Mercado Pago
    public static function mp(string $method, string $path, ?array $body = null): array
    {
        $tok = (string)cfg('mp.access_token');
        if ($tok === '') throw new RuntimeException('Falta mp.access_token en config.php');
        $ch = curl_init(rtrim((string)cfg('mp.api_base'), '/') . $path);
        $h = ['Authorization: Bearer ' . $tok, 'Accept: application/json'];
        $o = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CUSTOMREQUEST => $method];
        if ($body !== null) { $o[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE); $h[] = 'Content-Type: application/json'; $h[] = 'X-Idempotency-Key: ' . bin2hex(random_bytes(12)); }
        $o[CURLOPT_HTTPHEADER] = $h;
        curl_setopt_array($ch, $o);
        $r = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
        if ($r === false) throw new RuntimeException('No se pudo contactar a Mercado Pago: ' . $err);
        if ($code === 404) throw new MpNotFound($path);
        if ($code < 200 || $code >= 300) throw new RuntimeException("Mercado Pago respondió $code en $path");
        $j = json_decode($r, true);
        if (!is_array($j)) throw new RuntimeException('Respuesta de Mercado Pago ilegible');
        return $j;
    }

    /** x-signature: "ts=...,v1=..."; manifest "id:{data.id};request-id:{x-request-id};ts:{ts};" */
    public static function sigOk(string $dataId, string $xSig, string $reqId, string $secret): bool
    {
        if ($secret === '' || $xSig === '') return false;
        $ts = $v1 = '';
        foreach (explode(',', $xSig) as $p) {
            $kv = explode('=', trim($p), 2);
            if (count($kv) !== 2) continue;
            if ($kv[0] === 'ts') $ts = $kv[1]; elseif ($kv[0] === 'v1') $v1 = $kv[1];
        }
        if ($ts === '' || $v1 === '') return false;
        foreach (array_unique([$dataId, strtolower($dataId)]) as $id) {
            if (hash_equals(hash_hmac('sha256', "id:$id;request-id:$reqId;ts:$ts;", $secret), strtolower($v1))) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ suscripciones
    public static function syncPreapproval(string $id): array
    {
        if (!self::idOk($id)) throw new InvalidArgumentException('id inválido');
        $p = self::mp('GET', '/preapproval/' . rawurlencode($id));
        if ((string)($p['id'] ?? '') !== $id) throw new RuntimeException('La API devolvió otra suscripción');
        $ar = is_array($p['auto_recurring'] ?? null) ? $p['auto_recurring'] : [];
        $n = max(1, (int)($ar['frequency'] ?? 1));
        $days = (($ar['frequency_type'] ?? 'months') === 'days') ? $n : $n * 30;
        $email = strtolower(trim((string)($p['payer_email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';
        $status = in_array(($p['status'] ?? ''), ['pending', 'authorized', 'paused', 'cancelled'], true) ? (string)$p['status'] : 'pending';
        $now = time();
        $vals = [$email, $status, mb_substr((string)($p['reason'] ?? ''), 0, 255), self::cents($ar['transaction_amount'] ?? 0), mb_substr((string)($ar['currency_id'] ?? 'ARS'), 0, 8), $days, self::iso($p['next_payment_date'] ?? null)];
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $cur = one('SELECT * FROM subscriptions WHERE preapproval_id=? FOR UPDATE', [$id]);
            if ($cur) {
                if ($vals[0] === '') $vals[0] = (string)$cur['payer_email'];
                if ($vals[6] === null) $vals[6] = $cur['next_charge'] !== null ? (int)$cur['next_charge'] : null;
                q('UPDATE subscriptions SET payer_email=?,status=?,reason=?,amount_cent=?,currency=?,period_days=?,next_charge=?,updated=? WHERE preapproval_id=?', array_merge($vals, [$now, $id]));
            } else {
                q('INSERT INTO subscriptions(payer_email,status,reason,amount_cent,currency,period_days,next_charge,created,updated,preapproval_id) VALUES(?,?,?,?,?,?,?,?,?,?)', array_merge($vals, [$now, $now, $id]));
            }
            $row = one('SELECT * FROM subscriptions WHERE preapproval_id=?', [$id]);
            if ($row['user_id'] === null && $row['payer_email'] !== '') {   // re-suscripción de alguien que ya tiene cuenta
                $u = one('SELECT id FROM users WHERE email=?', [$row['payer_email']]);
                if ($u) { q('UPDATE subscriptions SET user_id=? WHERE id=? AND user_id IS NULL', [$u['id'], $row['id']]); $row['user_id'] = (int)$u['id']; }
            }
            $pdo->commit();
        } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
        $row['_new'] = !$cur;
        $row['_prev'] = $cur['status'] ?? null;
        return $row;
    }

    public static function syncCuota(string $id): array
    {
        if (!self::idOk($id)) throw new InvalidArgumentException('id inválido');
        $c = self::mp('GET', '/authorized_payments/' . rawurlencode($id));
        if ((string)($c['id'] ?? '') !== $id) throw new RuntimeException('La API devolvió otra cuota');
        $pre = (string)($c['preapproval_id'] ?? '');
        if (!self::idOk($pre)) throw new RuntimeException('La cuota no informa su suscripción');
        $pay = is_array($c['payment'] ?? null) ? $c['payment'] : [];
        $st = (string)($c['status'] ?? '');
        if (($pay['status'] ?? '') === 'approved') $st = 'processed';
        if (!in_array($st, ['scheduled', 'processed', 'recycling', 'cancelled'], true)) $st = 'scheduled';
        $sub = self::syncPreapproval($pre);
        $now = time();
        $v = [$pre, $st, mb_substr((string)($pay['status_detail'] ?? $pay['status'] ?? ''), 0, 120), self::cents($c['transaction_amount'] ?? 0), mb_substr((string)($c['currency_id'] ?? 'ARS'), 0, 8), (int)($c['retry_attempt'] ?? 0), self::iso($c['debit_date'] ?? null)];
        if (one('SELECT id FROM payments WHERE mp_id=?', [$id])) {
            q('UPDATE payments SET preapproval_id=?,status=?,detail=?,amount_cent=?,currency=?,retry=?,debit_date=?,updated=? WHERE mp_id=?', array_merge($v, [$now, $id]));
        } else {
            q('INSERT INTO payments(preapproval_id,status,detail,amount_cent,currency,retry,debit_date,created,updated,mp_id) VALUES(?,?,?,?,?,?,?,?,?,?)', array_merge($v, [$now, $now, $id]));
        }
        return ['sub' => $sub, 'status' => $st];
    }

    public static function cancelPreapproval(string $id): array
    {
        if (!self::idOk($id)) throw new InvalidArgumentException('id inválido');
        if (strpos($id, 'manual-') === 0) {
            q('UPDATE subscriptions SET status="cancelled", next_charge=?, updated=? WHERE preapproval_id=?', [time(), time(), $id]);
            return one('SELECT * FROM subscriptions WHERE preapproval_id=?', [$id]) ?: [];
        }
        self::mp('PUT', '/preapproval/' . rawurlencode($id), ['status' => 'cancelled']);
        return self::syncPreapproval($id);
    }

    // ------------------------------------------------------------------ acceso
    /** state: active | readonly | blocked · kind: paid | trial | manual | courtesy | none */
    public static function calc(array $owner, ?array $sub, ?int $lastPaid, ?int $now = null, ?int $grace = null): array
    {
        $now ??= time(); $grace ??= (int)cfg('mp.grace_days', 5);
        $ov = $owner['access_override'] ?? 'auto';
        if ($ov === 'bloqueado') return ['state' => 'blocked', 'kind' => 'none', 'reason' => 'Cuenta bloqueada por el administrador', 'until' => null];
        if ($ov === 'activo') return ['state' => 'active', 'kind' => 'courtesy', 'reason' => 'Acceso de cortesía', 'until' => null];
        if (!$sub) return ['state' => 'readonly', 'kind' => 'none', 'reason' => 'Sin suscripción', 'until' => null];
        $period = max(1, (int)$sub['period_days']) * 86400; $g = $grace * 86400;
        $base = $lastPaid ?: (int)$sub['created'];
        $paidUntil = $base + ($lastPaid ? $period : 0) + $g;
        $st = (string)$sub['status'];
        $next = (int)($sub['next_charge'] ?? 0);
        if (strpos((string)$sub['preapproval_id'], 'manual-') === 0) {
            $ok = $next > 0 && $now <= $next && in_array($st, ['authorized', 'cancelled'], true);
            return ['state' => $ok ? 'active' : 'readonly', 'kind' => 'manual', 'reason' => ($ok ? 'Acceso manual: ' : 'Acceso manual vencido: ') . ($sub['reason'] ?: 'prueba o regalo'), 'until' => $next ?: null];
        }
        if ($st === 'authorized') {
            if (!$lastPaid && $next > $now) return ['state' => 'active', 'kind' => 'trial', 'reason' => 'Prueba gratis', 'until' => $next];
            $until = max($paidUntil, $next ? $next + $g : 0);
            return $now <= $until ? ['state' => 'active', 'kind' => 'paid', 'reason' => 'Suscripción al día', 'until' => $until]
                                  : ['state' => 'readonly', 'kind' => 'paid', 'reason' => 'Cobro pendiente: la suscripción no registra pagos recientes', 'until' => $until];
        }
        if ($st === 'cancelled' && !$lastPaid && $next > 0 && $now <= $next) return ['state' => 'active', 'kind' => 'trial', 'reason' => 'Prueba gratis (baja pedida, sin cobros)', 'until' => $next];
        if ($lastPaid && $now <= $paidUntil - $g) return ['state' => 'active', 'kind' => 'paid', 'reason' => 'Período pagado vigente (suscripción ' . $st . ')', 'until' => $paidUntil - $g];
        return ['state' => 'readonly', 'kind' => 'paid', 'reason' => 'Suscripción ' . $st, 'until' => $lastPaid ? $paidUntil - $g : null];
    }

    public static function ownerOf(int $uid): int
    {
        $r = one('SELECT f.owner_id FROM members m JOIN families f ON f.id=m.family_id WHERE m.user_id=?', [$uid]);
        return $r ? (int)$r['owner_id'] : $uid;
    }

    public static function accessOfOwner(int $ownerId): array
    {
        $o = one('SELECT * FROM users WHERE id=?', [$ownerId]);
        if (!$o) return ['state' => 'readonly', 'kind' => 'none', 'reason' => 'Sin cuenta', 'until' => null, 'sub' => null];
        $sub = one('SELECT * FROM subscriptions WHERE user_id=? ORDER BY (status="authorized") DESC, updated DESC LIMIT 1', [$ownerId]);
        $last = null;
        if ($sub) {
            $r = one('SELECT MAX(COALESCE(debit_date, updated)) m FROM payments WHERE preapproval_id=? AND status="processed"', [$sub['preapproval_id']]);
            $last = $r && $r['m'] !== null ? (int)$r['m'] : null;
        }
        $a = self::calc($o, $sub, $last);
        $a['sub'] = $sub; $a['last_paid'] = $last;
        return $a;
    }

    public static function accessForUser(int $uid): array
    {
        $own = self::ownerOf($uid);
        $a = self::accessOfOwner($own);
        $self = one('SELECT access_override FROM users WHERE id=?', [$uid]);
        if ($self && $self['access_override'] === 'bloqueado') { $a['state'] = 'blocked'; $a['reason'] = 'Cuenta bloqueada por el administrador'; }
        $a['owner'] = $own === $uid;
        return $a;
    }

    public static function mailPublic(string $to, string $subject, string $text, string $title, string $bodyHtml): bool
    {
        if (!Mailer::configured()) return false;
        [$ok, $err] = Mailer::send($to, $subject, $text, Mailer::layout($title, $bodyHtml));
        q('INSERT INTO mail_log(user_id,to_email,kind,status,error,created_at) VALUES(NULL,?,?,?,?,?)', [$to, 'billing', $ok ? 'sent' : 'failed', $ok ? null : mb_substr($err, 0, 250), time()]);
        return $ok;
    }

    public static function notifyAlta(array $sub): void
    {
        if (!empty($sub['user_id']) || ($sub['status'] ?? '') !== 'authorized' || empty($sub['payer_email'])) return;
        $url = self::appUrl() . '/alta.php?pid=' . rawurlencode($sub['preapproval_id']);
        self::mailPublic($sub['payer_email'], 'Bienvenido a Gaku: creá tu acceso', "¡Gracias por suscribirte!\n\nPara crear tu usuario y tu clave entrá acá:\n$url\n\nSi ya lo hiciste, ignorá este mensaje.\n",
            '¡Gracias por suscribirte!', '<p>Para crear tu usuario y tu clave entrá acá:</p><p><a href="' . htmlspecialchars($url) . '" style="background:#0f5f73;color:#fff;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Crear mi acceso</a></p><p style="font-size:13px;color:#6a7685">Si ya lo hiciste, ignorá este mensaje.</p>');
    }

    // ------------------------------------------------------------------ pago único
    public static function onceCents(): int { return (int)round(((float)cfg('once.price', 12500)) * 100); }

    public static function createOrder(): array
    {
        $id = 'GK' . strtoupper(bin2hex(random_bytes(8)));
        $now = time();
        q('INSERT INTO orders(id,status,amount_cent,created,updated) VALUES(?,?,?,?,?)', [$id, 'pending', self::onceCents(), $now, $now]);
        $base = self::appUrl();
        $pref = [
            'items' => [['title' => (string)cfg('once.title'), 'quantity' => 1, 'currency_id' => 'ARS', 'unit_price' => self::onceCents() / 100]],
            'external_reference' => $id,
            'notification_url' => $base . '/webhook.php',
            'back_urls' => ['success' => $base . '/gracias.php', 'pending' => $base . '/gracias.php', 'failure' => $base . '/index.html#precio'],
            'statement_descriptor' => 'GAKU',
        ];
        if (strpos($base, 'https://') === 0) $pref['auto_return'] = 'approved';
        $r = self::mp('POST', '/checkout/preferences', $pref);
        $url = (string)($r['init_point'] ?? '');
        if ($url === '') throw new RuntimeException('Mercado Pago no devolvió el link de pago');
        q('UPDATE orders SET preference_id=?, updated=? WHERE id=?', [mb_substr((string)($r['id'] ?? ''), 0, 120), time(), $id]);
        return ['order' => $id, 'url' => $url];
    }

    /** Verifica un pago contra la API de MP y actualiza su pedido y licencia. Devuelve el pedido o null. */
    public static function syncPayment(string $payId): ?array
    {
        if (!self::idOk($payId)) throw new InvalidArgumentException('id inválido');
        $p = self::mp('GET', '/v1/payments/' . rawurlencode($payId));
        if ((string)($p['id'] ?? '') !== $payId) throw new RuntimeException('La API devolvió otro pago');
        $ref = (string)($p['external_reference'] ?? '');
        if (!preg_match('/^GK[A-F0-9]{16}$/', $ref)) return null;       // no es un pago de Gaku
        $status = (string)($p['status'] ?? '');
        $amount = self::cents($p['transaction_amount'] ?? 0);
        $email = strtolower(trim((string)($p['payer']['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $o = one('SELECT * FROM orders WHERE id=? FOR UPDATE', [$ref]);
            if (!$o) { $pdo->rollBack(); return null; }
            $now = time();
            $newStatus = $o['status'];
            if ($status === 'approved') {
                if ($amount < (int)$o['amount_cent'] || ($p['currency_id'] ?? 'ARS') !== 'ARS') $newStatus = 'mismatch';
                elseif ($o['status'] !== 'refunded') $newStatus = 'approved';
            } elseif (in_array($status, ['refunded', 'charged_back'], true)) $newStatus = 'refunded';
            elseif (in_array($status, ['rejected', 'cancelled'], true) && $o['status'] === 'pending') $newStatus = 'rejected';
            q('UPDATE orders SET status=?, mp_payment_id=?, payer_email=?, updated=? WHERE id=?', [$newStatus, $payId, $email !== '' ? $email : $o['payer_email'], $now, $ref]);
            $o = one('SELECT * FROM orders WHERE id=?', [$ref]);
            $newLicense = false;
            if ($newStatus === 'approved' && !$o['license_id']) {
                $lic = self::newLicense((string)$o['payer_email'], $ref, 'compra', '');
                q('UPDATE orders SET license_id=? WHERE id=?', [$lic['id'], $ref]);
                $o['license_id'] = $lic['id']; $newLicense = true;
            }
            if ($newStatus === 'refunded' && $o['license_id']) q('UPDATE licenses SET status="revoked" WHERE id=?', [$o['license_id']]);
            $pdo->commit();
        } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
        if ($newLicense) self::mailLicense((int)$o['license_id']);
        return $o;
    }

    // ------------------------------------------------------------------ licencias y dispositivos
    public static function newKey(): string
    {
        $al = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $g = fn() => implode('', array_map(fn($i) => $al[random_int(0, strlen($al) - 1)], range(1, 4)));
        return 'GAKU-' . $g() . '-' . $g() . '-' . $g();
    }

    public static function newLicense(string $email, ?string $orderId, string $origin, string $note): array
    {
        for ($i = 0; $i < 5; $i++) {
            $k = self::newKey();
            if (!one('SELECT id FROM licenses WHERE license_key=?', [$k])) break;
        }
        q('INSERT INTO licenses(license_key,email,order_id,status,max_devices,origin,note,created) VALUES(?,?,?,?,?,?,?,?)', [$k, $email, $orderId, 'active', (int)cfg('once.max_devices', 3), $origin, mb_substr($note, 0, 120), time()]);
        return one('SELECT * FROM licenses WHERE id=?', [db()->lastInsertId()]);
    }

    public static function licenseByKey(string $k): ?array
    {
        $k = strtoupper(trim($k));
        if (!preg_match('/^GAKU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/', $k)) return null;
        return one('SELECT * FROM licenses WHERE license_key=?', [$k]);
    }

    public static function mailLicense(int $licId): bool
    {
        $l = one('SELECT * FROM licenses WHERE id=?', [$licId]);
        if (!$l || $l['email'] === '') return false;
        $dl = self::appUrl() . '/descarga.php?k=' . rawurlencode($l['license_key']);
        $max = (int)$l['max_devices'];
        return self::mailPublic($l['email'], 'Tu licencia de Gaku', "¡Gracias por tu compra!\n\nTu clave de licencia: {$l['license_key']}\n\nDescargá tu archivo de Gaku acá:\n$dl\n\nPodés usarlo en hasta $max dispositivos. Guardá este mensaje.\n",
            '¡Gracias por tu compra!', '<p>Tu clave de licencia:</p><p style="font-size:22px;font-weight:bold;letter-spacing:.06em">' . htmlspecialchars($l['license_key']) . '</p><p><a href="' . htmlspecialchars($dl) . '" style="background:#0f5f73;color:#fff;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Descargar Gaku</a></p><p style="font-size:13px;color:#6a7685">Podés usarlo en hasta ' . $max . ' dispositivos. Guardá este mensaje.</p>');
    }

    public static function devicesOf(int $licId): array
    {
        return all('SELECT * FROM devices WHERE license_id=? AND active=1 ORDER BY first_seen', [$licId]);
    }

    // ---- firma de tokens (ECDSA P-256) -------------------------------------------------
    private static function privKey()
    {
        $dir = STORAGE . '/keys';
        if (!is_dir($dir)) @mkdir($dir, 0700, true);
        $f = $dir . '/gaku-ec.pem';
        if (!is_file($f)) {
            $k = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
            if (!$k) throw new RuntimeException('No se pudo generar la clave de licencias (openssl)');
            openssl_pkey_export($k, $pem);
            file_put_contents($f, $pem, LOCK_EX); @chmod($f, 0600);
        }
        $k = openssl_pkey_get_private(file_get_contents($f));
        if (!$k) throw new RuntimeException('Clave de licencias ilegible');
        return $k;
    }
    private static function b64u(string $b): string { return rtrim(strtr(base64_encode($b), '+/', '-_'), '='); }
    public static function publicJwk(): array
    {
        $d = openssl_pkey_get_details(self::privKey());
        return ['kty' => 'EC', 'crv' => 'P-256', 'x' => self::b64u($d['ec']['x']), 'y' => self::b64u($d['ec']['y'])];
    }
    private static function derToRaw(string $der): string
    {
        $o = 2; if (ord($der[1]) & 0x80) $o += ord($der[1]) & 0x7f;
        $parts = [];
        for ($i = 0; $i < 2; $i++) {
            $len = ord($der[$o + 1]); $int = substr($der, $o + 2, $len); $o += 2 + $len;
            $int = ltrim($int, "\x00"); $parts[] = str_pad($int, 32, "\x00", STR_PAD_LEFT);
        }
        return $parts[0] . $parts[1];
    }
    public static function signToken(array $payload): string
    {
        $data = self::b64u(json_encode($payload, JSON_UNESCAPED_SLASHES));
        openssl_sign($data, $der, self::privKey(), OPENSSL_ALGO_SHA256);
        return $data . '.' . self::b64u(self::derToRaw($der));
    }

    /** Activa o revalida un dispositivo. Devuelve [ok, datos|error]. */
    public static function activate(string $key, string $dev, string $label, bool $register = true): array
    {
        $l = self::licenseByKey($key);
        if (!$l) return [false, ['error' => 'bad_key', 'message' => 'La clave no es válida. Revisala y probá de nuevo.']];
        if ($l['status'] !== 'active') return [false, ['error' => 'revoked', 'message' => 'Esta licencia fue dada de baja. Escribinos si creés que es un error.']];
        if (!preg_match('/^[A-Za-z0-9_-]{16,64}$/', $dev)) return [false, ['error' => 'bad_device', 'message' => 'Dispositivo no válido']];
        $now = time(); $lid = (int)$l['id'];
        $pdo = db(); $pdo->beginTransaction();
        try {
            one('SELECT id FROM licenses WHERE id=? FOR UPDATE', [$lid]);
            $d = one('SELECT * FROM devices WHERE license_id=? AND device_id=?', [$lid, $dev]);
            if ($d && (int)$d['active'] === 1) {
                q('UPDATE devices SET last_seen=?, label=? WHERE id=?', [$now, mb_substr($label, 0, 120) ?: $d['label'], $d['id']]);
            } else {
                if (!$register) { $pdo->rollBack(); return [false, ['error' => 'not_registered', 'message' => 'Este dispositivo ya no está activado. Volvé a activarlo con tu clave.']]; }
                $used = (int)one('SELECT COUNT(*) c FROM devices WHERE license_id=? AND active=1', [$lid])['c'];
                if ($used >= (int)$l['max_devices']) {
                    $pdo->rollBack();
                    return [false, ['error' => 'limit', 'message' => 'Esta licencia ya está en ' . (int)$l['max_devices'] . ' dispositivos. Liberá uno desde Gaku (Ajustes → Desactivar este dispositivo) o escribinos.', 'devices' => array_map(fn($x) => ['label' => $x['label'], 'last_seen' => (int)$x['last_seen']], self::devicesOf($lid))]];
                }
                if ($d) q('UPDATE devices SET active=1, last_seen=?, label=? WHERE id=?', [$now, mb_substr($label, 0, 120), $d['id']]);
                else q('INSERT INTO devices(license_id,device_id,label,active,first_seen,last_seen) VALUES(?,?,?,1,?,?)', [$lid, $dev, mb_substr($label, 0, 120), $now, $now]);
            }
            $pdo->commit();
        } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
        $exp = $now + (int)cfg('once.offline_days', 35) * 86400;
        $tok = self::signToken(['k' => $l['license_key'], 'd' => $dev, 'iat' => $now, 'exp' => $exp]);
        return [true, ['ok' => true, 'token' => $tok, 'exp' => $exp, 'recheck' => (int)cfg('once.recheck_days', 7) * 86400]];
    }

    public static function release(string $key, string $dev): bool
    {
        $l = self::licenseByKey($key);
        if (!$l) return false;
        q('UPDATE devices SET active=0 WHERE license_id=? AND device_id=?', [$l['id'], $dev]);
        return true;
    }
}
