<?php
declare(strict_types=1);

/**
 * Cliente SMTP mínimo (sin dependencias). Devuelve [true, ''] solo cuando el
 * servidor confirma la entrega con 250 después de DATA.
 */
final class Mailer
{
    public static function configured(): bool
    {
        return (string)cfg('mail.host') !== '' && (string)cfg('mail.from') !== '';
    }

    /** @return array{0:bool,1:string} */
    public static function send(string $to, string $subject, string $text, ?string $html = null): array
    {
        if (!self::configured()) return [false, 'Correo pendiente de configurar'];
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return [false, 'Dirección inválida'];
        $host = (string)cfg('mail.host');
        $port = (int)cfg('mail.port', 587);
        $secure = (string)cfg('mail.secure', 'tls');
        $user = (string)cfg('mail.user');
        $pass = (string)cfg('mail.pass');
        $from = (string)cfg('mail.from');
        $fromName = (string)cfg('mail.from_name', 'Gaku');

        $ctx = stream_context_create(['ssl' => [
            'verify_peer' => (bool)cfg('mail.verify_peer', true),
            'verify_peer_name' => (bool)cfg('mail.verify_peer', true),
            'SNI_enabled' => true,
        ]]);
        $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
        $errno = 0; $errstr = '';
        $fp = @stream_socket_client($remote, $errno, $errstr, 12, STREAM_CLIENT_CONNECT, $ctx);
        if (!$fp) return [false, "No se pudo conectar al servidor de correo ($errstr)"];
        stream_set_timeout($fp, 15);

        $read = function () use ($fp): array {
            $code = 0; $msg = '';
            while (($line = fgets($fp, 1024)) !== false) {
                $msg .= $line;
                $code = (int)substr($line, 0, 3);
                if (strlen($line) < 4 || $line[3] !== '-') break;
            }
            return [$code, trim($msg)];
        };
        $cmd = function (string $c, array $ok) use ($fp, $read): array {
            fwrite($fp, $c . "\r\n");
            [$code, $msg] = $read();
            return [in_array($code, $ok, true), $code . ' ' . $msg];
        };
        $fail = function (string $why) use ($fp): array {
            @fwrite($fp, "QUIT\r\n");
            @fclose($fp);
            return [false, $why];
        };

        [$code, $msg] = $read();
        if ($code !== 220) return $fail("Saludo inesperado: $msg");
        $ehloHost = parse_url((string)cfg('app_url'), PHP_URL_HOST) ?: 'localhost';
        [$ok, $m] = $cmd('EHLO ' . $ehloHost, [250]);
        if (!$ok) return $fail($m);
        if ($secure === 'tls') {
            [$ok, $m] = $cmd('STARTTLS', [220]);
            if (!$ok) return $fail($m);
            $crypto = STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) $crypto |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
            if (!@stream_socket_enable_crypto($fp, true, $crypto)) return $fail('No se pudo cifrar la conexión (STARTTLS)');
            [$ok, $m] = $cmd('EHLO ' . $ehloHost, [250]);
            if (!$ok) return $fail($m);
        }
        if ($user !== '') {
            [$ok, $m] = $cmd('AUTH LOGIN', [334]);
            if (!$ok) return $fail($m);
            [$ok, $m] = $cmd(base64_encode($user), [334]);
            if (!$ok) return $fail($m);
            [$ok, $m] = $cmd(base64_encode($pass), [235]);
            if (!$ok) return $fail('Credenciales de correo rechazadas');
        }
        [$ok, $m] = $cmd('MAIL FROM:<' . $from . '>', [250]);
        if (!$ok) return $fail($m);
        [$ok, $m] = $cmd('RCPT TO:<' . $to . '>', [250, 251]);
        if (!$ok) return $fail($m);
        [$ok, $m] = $cmd('DATA', [354]);
        if (!$ok) return $fail($m);

        $boundary = 'b' . bin2hex(random_bytes(8));
        $h = [];
        $h[] = 'Date: ' . date('r');
        $h[] = 'From: ' . self::enc($fromName) . ' <' . $from . '>';
        $h[] = 'To: <' . $to . '>';
        $h[] = 'Subject: ' . self::enc($subject);
        $h[] = 'Message-ID: <' . bin2hex(random_bytes(10)) . '@' . $ehloHost . '>';
        $h[] = 'MIME-Version: 1.0';
        $h[] = 'Auto-Submitted: auto-generated';
        if ($html !== null) {
            $h[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
            $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
                . chunk_split(base64_encode($text)) . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
                . chunk_split(base64_encode($html)) . "--$boundary--\r\n";
        } else {
            $h[] = 'Content-Type: text/plain; charset=UTF-8';
            $h[] = 'Content-Transfer-Encoding: base64';
            $body = chunk_split(base64_encode($text));
        }
        $data = implode("\r\n", $h) . "\r\n\r\n" . $body;
        $data = preg_replace('/^\./m', '..', $data);
        fwrite($fp, $data . "\r\n.\r\n");
        [$code, $msg] = $read();
        if ($code !== 250) return $fail("El servidor no aceptó el mensaje: $code $msg");
        @fwrite($fp, "QUIT\r\n");
        @fclose($fp);
        return [true, ''];
    }

    private static function enc(string $s): string
    {
        return preg_match('/^[\x20-\x7e]*$/', $s) ? $s : '=?UTF-8?B?' . base64_encode($s) . '?=';
    }

    public static function layout(string $title, string $bodyHtml, string $footer = ''): string
    {
        $brand = htmlspecialchars((string)cfg('brand.name'), ENT_QUOTES, 'UTF-8');
        $t = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        return '<!doctype html><html lang="es"><body style="margin:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#1d2733">'
            . '<div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:14px;padding:24px;border:1px solid #e3e8ef">'
            . '<div style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#0f5f73;font-weight:bold">' . $brand . '</div>'
            . '<h1 style="font-size:20px;margin:10px 0 14px">' . $t . '</h1>' . $bodyHtml . '</div>'
            . '<p style="font-size:12px;color:#6a7685;margin:14px 6px">' . $footer . '</p></div></body></html>';
    }
}
