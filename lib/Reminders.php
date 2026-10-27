<?php
declare(strict_types=1);

/**
 * Avisos por correo: cola persistente (tabla reminders) + resúmenes diarios/semanales (tabla digests).
 * Nada se marca como enviado si el servidor SMTP no confirmó la entrega.
 */
final class Reminders
{
    private const DONE = [
        'task' => ['terminada', 'entregada', 'revisada'],
        'material' => ['mochila', 'llevado'],
    ];
    private const CATS = ['task' => 'tasks', 'exam' => 'exams', 'material' => 'materials', 'event' => 'events'];
    private const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    private const MAX_TRIES = 3;

    // ------------------------------------------------------------ planificación
    /** @return array{0:string,1:string}|null [fechaHoraLocal, título] */
    public static function whenOf(array $row): ?array
    {
        $d = jdec($row['data']);
        $type = $row['type'];
        if (!isset(self::CATS[$type])) return null;
        if (isset(self::DONE[$type]) && in_array($d['status'] ?? '', self::DONE[$type], true)) return null;
        $title = trim((string)($d['title'] ?? $d['name'] ?? ''));
        if ($title === '') return null;
        switch ($type) {
            case 'task': $w = (string)($d['due'] ?? ''); $def = '08:00'; break;
            case 'exam': $w = trim((string)($d['date'] ?? '')); if ($w !== '' && !empty($d['time'])) $w .= 'T' . $d['time']; $def = '08:00'; break;
            case 'material': $w = (string)($d['needDate'] ?? ''); $def = '07:00'; break;
            default: $w = trim((string)($d['date'] ?? '')); if ($w !== '' && !empty($d['time'])) $w .= 'T' . $d['time']; $def = '08:00';
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/', $w)) return null;
        if (strlen($w) === 10) $w .= 'T' . $def;
        return [$w, $title];
    }

    private static function recipients(string $fid): array
    {
        return all('SELECT m.user_id, m.role, m.student_id, u.settings, u.email, u.name, u.email_verified FROM members m JOIN users u ON u.id=m.user_id WHERE m.family_id=?', [$fid]);
    }

    private static function userTz(array $settings, ?string $studentTz): string
    {
        foreach ([$settings['tz'] ?? null, $studentTz, cfg('default_tz')] as $tz) if (valid_tz($tz)) return $tz;
        return 'UTC';
    }

    public static function cancelRecord(string $id): void
    {
        q("DELETE FROM reminders WHERE record_id=? AND status='pending'", [$id]);
    }

    public static function syncRecord(array $row): void
    {
        self::cancelRecord($row['id']);
        self::plan($row, null);
    }

    private static function plan(array $row, ?int $onlyUser): void
    {
        if ($row['deleted_at'] !== null) return;
        $info = self::whenOf($row);
        if (!$info) return;
        [$local, $title] = $info;
        $stud = $row['student_id'] ? one('SELECT tz FROM students WHERE id=? AND deleted_at IS NULL', [$row['student_id']]) : null;
        if ($row['student_id'] && !$stud) return;
        foreach (self::recipients($row['family_id']) as $m) {
            if ($onlyUser !== null && (int)$m['user_id'] !== $onlyUser) continue;
            if ($m['role'] === 'student' && $row['student_id'] !== null && $row['student_id'] !== $m['student_id']) continue;
            if ($row['visibility'] === 'private' && (int)$row['created_by'] !== (int)$m['user_id']) continue;
            $s = jdec($m['settings']);
            $n = $s['notif'] ?? [];
            if (empty($n['email'])) continue;
            if (isset($n['cats']) && ($n['cats'][self::CATS[$row['type']]] ?? true) === false) continue;
            if (!empty($n['students']) && $row['student_id'] !== null && !in_array($row['student_id'], $n['students'], true)) continue;
            $tz = self::userTz($s, $stud['tz'] ?? null);
            $at = local_to_epoch($local, $tz);
            if ($at === null || $at <= time()) continue;
            $lead = max(0, (int)($n['leadMin'] ?? 1440)) * 60;
            $send = max(time(), $at - $lead);
            q('INSERT IGNORE INTO reminders(family_id,record_id,user_id,rkey,category,send_at,payload,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)', [
                $row['family_id'], $row['id'], $m['user_id'], 'lead:' . $at, self::CATS[$row['type']], $send,
                jenc(['title' => $title, 'type' => $row['type'], 'when' => $local, 'student_id' => $row['student_id']]), 'pending', time(),
            ]);
        }
    }

    private static function eachRecord(string $where, array $args, callable $fn): void
    {
        foreach (all("SELECT * FROM records WHERE deleted_at IS NULL AND type IN ('task','exam','material','event') AND $where", $args) as $r) $fn($r);
    }

    public static function resyncUser(int $uid): void
    {
        $m = one('SELECT family_id FROM members WHERE user_id=?', [$uid]);
        if (!$m) return;
        q("DELETE FROM reminders WHERE user_id=? AND status='pending'", [$uid]);
        self::eachRecord('family_id=?', [$m['family_id']], fn($r) => self::plan($r, $uid));
    }

    public static function resyncStudent(string $sid): void
    {
        self::eachRecord('student_id=?', [$sid], fn($r) => self::syncRecord($r));
    }

    public static function resyncFamily(string $fid): void
    {
        q("DELETE FROM reminders WHERE family_id=? AND status='pending'", [$fid]);
        self::eachRecord('family_id=?', [$fid], fn($r) => self::plan($r, null));
    }

    // ------------------------------------------------------------ utilidades de hora
    private static function localParts(int $ts, string $tz): array
    {
        $d = (new DateTimeImmutable('@' . $ts))->setTimezone(new DateTimeZone($tz));
        return ['date' => $d->format('Y-m-d'), 'hm' => $d->format('H:i'), 'dow' => (int)$d->format('w'), 'dt' => $d];
    }

    private static function inQuiet(array $n, int $ts, string $tz): ?int
    {
        $q = $n['quiet'] ?? null;
        if (!$q || empty($q['enabled'])) return null;
        $p = self::localParts($ts, $tz);
        $from = $q['from'] ?? '22:00'; $to = $q['to'] ?? '07:00';
        $hm = $p['hm'];
        $inside = $from <= $to ? ($hm >= $from && $hm < $to) : ($hm >= $from || $hm < $to);
        if (!$inside) return null;
        $days = $q['days'] ?? [0, 1, 2, 3, 4, 5, 6];
        if ($days && !in_array($p['dow'], array_map('intval', $days), true)) return null;
        $end = local_to_epoch($p['date'] . 'T' . $to, $tz);
        if ($end === null) return null;
        if ($end <= $ts) $end += 86400;
        return $end;
    }

    private static function sentToday(int $uid, string $tz, int $now): int
    {
        $start = local_to_epoch(self::localParts($now, $tz)['date'] . 'T00:00', $tz) ?? ($now - 86400);
        return (int)q("SELECT COUNT(*) FROM mail_log WHERE user_id=? AND status='sent' AND kind IN ('reminder','digest') AND created_at>=?", [$uid, $start])->fetchColumn();
    }

    private static function fmtWhen(string $local): string
    {
        $t = strtotime(substr($local, 0, 10) . ' 12:00 UTC');
        $dow = self::DOW[(int)gmdate('w', $t)];
        $h = substr($local, 11, 5);
        return $dow . ' ' . substr($local, 8, 2) . '/' . substr($local, 5, 2) . ($h !== '' && $h !== '00:00' ? ' ' . $h : '');
    }

    // ------------------------------------------------------------ worker
    /** Ejecuta un ciclo. $now permite probar. */
    public static function run(?int $now = null): array
    {
        $now ??= time();
        $st = ['sent' => 0, 'failed' => 0, 'cancelled' => 0, 'postponed' => 0, 'digests' => 0, 'mail' => Mailer::configured()];
        q("REPLACE INTO meta(k,v) VALUES('cron_last',?)", [(string)$now]);
        if (!$st['mail']) return $st; // sin credenciales: nada se envía ni se marca
        self::runReminders($now, $st);
        self::runDigests($now, $st);
        return $st;
    }

    private static function runReminders(int $now, array &$st): void
    {
        $due = all("SELECT * FROM reminders WHERE status='pending' AND send_at<=? ORDER BY send_at LIMIT 500", [$now]);
        $byUser = [];
        foreach ($due as $r) {
            $rec = one('SELECT * FROM records WHERE id=?', [$r['record_id']]);
            $info = $rec ? self::whenOf($rec) : null;
            $ok = $info && $rec['deleted_at'] === null;
            if ($ok) {
                $stud = $rec['student_id'] ? one('SELECT tz FROM students WHERE id=? AND deleted_at IS NULL', [$rec['student_id']]) : null;
                $u = one('SELECT settings FROM users WHERE id=?', [$r['user_id']]);
                $tz = self::userTz(jdec($u['settings'] ?? '{}'), $stud['tz'] ?? null);
                $ok = local_to_epoch($info[0], $tz) === (int)substr($r['rkey'], 5);
            }
            if (!$ok) { q("UPDATE reminders SET status='cancelled' WHERE id=?", [$r['id']]); $st['cancelled']++; continue; }
            $r['info'] = $info; $r['tz'] = $tz;
            $byUser[$r['user_id']][] = $r;
        }
        foreach ($byUser as $uid => $items) {
            $u = one('SELECT * FROM users WHERE id=?', [$uid]);
            if (!$u) continue;
            $s = jdec($u['settings']);
            $n = $s['notif'] ?? [];
            $tz = $items[0]['tz'];
            if (empty($n['email']) || !$u['email_verified']) {
                foreach ($items as $r) q("UPDATE reminders SET last_error=? WHERE id=?", [$u['email_verified'] ? 'Avisos por correo desactivados' : 'Correo sin confirmar', $r['id']]);
                continue;
            }
            if (($end = self::inQuiet($n, $now, $tz)) !== null) {
                foreach ($items as $r) q('UPDATE reminders SET send_at=? WHERE id=?', [$end, $r['id']]);
                $st['postponed'] += count($items);
                continue;
            }
            if (self::sentToday((int)$uid, $tz, $now) >= (int)cfg('mail_daily_limit', 40)) {
                foreach ($items as $r) q('UPDATE reminders SET send_at=? WHERE id=?', [$now + 3600, $r['id']]);
                $st['postponed'] += count($items);
                continue;
            }
            $lines = []; $html = '';
            foreach ($items as $r) {
                $stud = !empty($r['payload']) ? (jdec($r['payload'])['student_id'] ?? null) : null;
                $name = $stud ? (one('SELECT name FROM students WHERE id=?', [$stud])['name'] ?? '') : '';
                $label = ['task' => 'Tarea', 'exam' => 'Examen', 'material' => 'Material', 'event' => 'Evento'][jdec($r['payload'])['type'] ?? ''] ?? 'Aviso';
                $line = $label . ': ' . $r['info'][1] . ' — ' . self::fmtWhen($r['info'][0]) . ($name ? " ($name)" : '');
                $lines[] = $line;
                $html .= '<li style="margin:6px 0">' . htmlspecialchars($line) . '</li>';
            }
            $subject = count($items) === 1 ? 'Aviso: ' . $items[0]['info'][1] : 'Tenés ' . count($items) . ' avisos próximos';
            $text = "Próximamente:\n- " . implode("\n- ", $lines) . "\n\nPodés cambiar los avisos en Ajustes > Avisos.";
            $body = '<ul style="padding-left:18px;margin:0">' . $html . '</ul>';
            [$sent, $err] = Mailer::send($u['email'], $subject, $text, Mailer::layout('Próximos avisos', $body, 'Podés cambiar los avisos en Ajustes.'));
            q('INSERT INTO mail_log(user_id,to_email,kind,status,error,created_at) VALUES(?,?,?,?,?,?)', [$uid, $u['email'], 'reminder', $sent ? 'sent' : 'failed', $sent ? null : $err, $now]);
            foreach ($items as $r) {
                if ($sent) { q("UPDATE reminders SET status='sent', sent_at=?, tries=tries+1, last_error=NULL WHERE id=?", [$now, $r['id']]); $st['sent']++; }
                else {
                    $tries = (int)$r['tries'] + 1;
                    if ($tries >= self::MAX_TRIES) { q("UPDATE reminders SET status='failed', tries=?, last_error=? WHERE id=?", [$tries, $err, $r['id']]); $st['failed']++; }
                    else { q('UPDATE reminders SET tries=?, last_error=?, send_at=? WHERE id=?', [$tries, $err, $now + 600 * $tries * $tries, $r['id']]); $st['postponed']++; }
                }
            }
        }
    }

    // ------------------------------------------------------------ resúmenes
    private static function runDigests(int $now, array &$st): void
    {
        foreach (all('SELECT u.*, m.family_id, m.role, m.student_id FROM users u JOIN members m ON m.user_id=u.id WHERE u.email_verified=1') as $u) {
            $s = jdec($u['settings']);
            $n = $s['notif'] ?? [];
            if (empty($n['email'])) continue;
            $tz = self::userTz($s, null);
            $p = self::localParts($now, $tz);
            if ($p['hm'] < ($n['digestHour'] ?? '07:00')) continue;
            if (self::inQuiet($n, $now, $tz) !== null) continue;
            $kinds = [];
            if ($n['daily'] ?? true) $kinds[] = ['d:' . $p['date'], 1];
            $ws = (int)($s['weekStart'] ?? 1);
            if (($n['weekly'] ?? false) && $p['dow'] === $ws) $kinds[] = ['w:' . $p['date'], 7];
            foreach ($kinds as [$key, $days]) {
                $dg = one('SELECT * FROM digests WHERE user_id=? AND dkey=?', [$u['id'], $key]);
                if ($dg && ($dg['status'] === 'sent' || $dg['status'] === 'empty' || (int)$dg['tries'] >= self::MAX_TRIES)) continue;
                if (self::sentToday((int)$u['id'], $tz, $now) >= (int)cfg('mail_daily_limit', 40)) continue;
                $dates = [];
                for ($i = 0; $i < $days; $i++) $dates[] = $p['dt']->modify("+$i day")->format('Y-m-d');
                [$text, $html, $empty] = self::buildDigest($u, $n, $dates, $days === 7);
                if ($empty) { q("REPLACE INTO digests(user_id,dkey,status,tries,sent_at) VALUES(?,?,'empty',0,?)", [$u['id'], $key, $now]); continue; }
                $subject = $days === 7 ? 'Tu semana de estudio' : 'Tu día de estudio';
                [$ok, $err] = Mailer::send($u['email'], $subject, $text, Mailer::layout($subject, $html, 'Resumen automático. Podés cambiarlo en Ajustes > Avisos.'));
                q('INSERT INTO mail_log(user_id,to_email,kind,status,error,created_at) VALUES(?,?,?,?,?,?)', [$u['id'], $u['email'], 'digest', $ok ? 'sent' : 'failed', $ok ? null : $err, $now]);
                $tries = (int)($dg['tries'] ?? 0) + 1;
                q('REPLACE INTO digests(user_id,dkey,status,tries,sent_at) VALUES(?,?,?,?,?)', [$u['id'], $key, $ok ? 'sent' : 'failed', $tries, $ok ? $now : null]);
                if ($ok) $st['digests']++; else $st['failed']++;
            }
        }
    }

    /** Ocurrencias de clases (recurrencia semanal/quincenal, desde/hasta y excepciones) para una fecha. */
    public static function classesOn(array $slots, array $exceptions, string $date): array
    {
        $dow = (int)date('w', strtotime($date . ' 12:00 UTC'));
        $out = [];
        foreach ($slots as $sl) {
            $d = $sl['data'];
            if ((int)($d['dow'] ?? -1) !== $dow) continue;
            if (!empty($d['from']) && $date < $d['from']) continue;
            if (!empty($d['to']) && $date > $d['to']) continue;
            if (($d['recur'] ?? 'weekly') === 'biweekly') {
                $a = strtotime(($d['from'] ?: $date) . ' 12:00 UTC');
                $weeks = (int)floor((strtotime($date . ' 12:00 UTC') - $a) / 604800);
                if ($weeks % 2 !== 0) continue;
            }
            $start = $d['start'] ?? ''; $end = $d['end'] ?? ''; $room = $d['room'] ?? '';
            $skip = false;
            foreach ($exceptions as $ex) {
                $e = $ex['data'];
                if (($e['slotId'] ?? '') !== $sl['id'] || ($e['date'] ?? '') !== $date) continue;
                if (($e['kind'] ?? 'cancel') === 'cancel') { $skip = true; break; }
                $start = $e['start'] ?? $start; $end = $e['end'] ?? $end; $room = $e['room'] ?? $room;
            }
            if (!$skip) $out[] = ['start' => $start, 'end' => $end, 'room' => $room, 'subjectId' => $d['subjectId'] ?? null];
        }
        usort($out, fn($a, $b) => strcmp($a['start'], $b['start']));
        return $out;
    }

    private static function buildDigest(array $u, array $n, array $dates, bool $week): array
    {
        $fid = $u['family_id'];
        $studs = all('SELECT * FROM students WHERE family_id=? AND deleted_at IS NULL ORDER BY created_at', [$fid]);
        $studs = array_values(array_filter($studs, function ($s) use ($u, $n) {
            if ($u['role'] === 'student') return $s['id'] === $u['student_id'];
            return empty($n['students']) || in_array($s['id'], $n['students'], true);
        }));
        $recs = all("SELECT * FROM records WHERE family_id=? AND deleted_at IS NULL AND (visibility='family' OR created_by=?)", [$fid, $u['id']]);
        $first = $dates[0]; $last = end($dates);
        $tomorrow = date('Y-m-d', strtotime($first . ' +1 day'));
        $text = ''; $html = ''; $any = false;
        $cat = $n['cats'] ?? [];
        foreach ($studs as $s) {
            $mine = array_values(array_filter($recs, fn($r) => $r['student_id'] === $s['id']));
            $by = fn(string $t) => array_values(array_map(fn($r) => ['id' => $r['id'], 'data' => jdec($r['data'])], array_filter($mine, fn($r) => $r['type'] === $t)));
            $subjects = []; foreach ($by('subject') as $x) $subjects[$x['id']] = $x['data']['name'] ?? '';
            $sections = [];
            $cl = [];
            foreach ($dates as $dt) {
                foreach (self::classesOn($by('slot'), $by('exception'), $dt) as $c) {
                    $cl[] = ($week ? self::fmtWhen($dt . 'T00:00') . ' ' : '') . $c['start'] . ($c['end'] ? '–' . $c['end'] : '') . ' ' . ($subjects[$c['subjectId']] ?? 'Clase') . ($c['room'] ? ' (' . $c['room'] . ')' : '');
                }
            }
            if ($cl) $sections[] = ['Clases', $cl];
            if ($cat['tasks'] ?? true) {
                $tl = [];
                foreach ($by('task') as $x) {
                    $d = $x['data'];
                    if (in_array($d['status'] ?? '', self::DONE['task'], true) || empty($d['due'])) continue;
                    $day = substr((string)$d['due'], 0, 10);
                    $limit = $week ? $last : $tomorrow;
                    if ($day <= $limit) $tl[] = ($d['title'] ?? 'Tarea') . ' — ' . ($day < $first ? 'atrasada, ' : '') . self::fmtWhen(strlen($d['due']) === 10 ? $d['due'] . 'T00:00' : $d['due']);
                }
                if ($tl) $sections[] = ['Tareas para entregar', $tl];
            }
            if ($cat['exams'] ?? true) {
                $el = [];
                $until = date('Y-m-d', strtotime($last . ' +' . ($week ? 7 : 6) . ' days'));
                foreach ($by('exam') as $x) {
                    $d = $x['data'];
                    $day = (string)($d['date'] ?? '');
                    if ($day >= $first && $day <= $until) $el[] = (($d['kind'] ?? '') === 'recup' ? 'Recuperatorio: ' : '') . ($d['title'] ?? 'Examen') . ' — ' . self::fmtWhen($day . 'T00:00') . (empty($d['time']) ? '' : ' ' . $d['time']);
                }
                if ($el) $sections[] = ['Exámenes próximos', $el];
            }
            if ($cat['materials'] ?? true) {
                $ml = [];
                foreach ($by('material') as $x) {
                    $d = $x['data'];
                    if (in_array($d['status'] ?? '', self::DONE['material'], true) || empty($d['needDate'])) continue;
                    $day = substr((string)$d['needDate'], 0, 10);
                    if ($day <= ($week ? $last : $tomorrow)) $ml[] = ($d['name'] ?? 'Material') . ' — ' . self::fmtWhen($day . 'T00:00') . ' (' . ($d['status'] ?? 'conseguir') . ')';
                }
                if ($ml) $sections[] = ['Qué llevar', $ml];
            }
            if (!$sections) continue;
            $any = true;
            $text .= ($u['role'] === 'guardian' && count($studs) > 1 ? "== {$s['name']} ==\n" : '');
            if (count($studs) > 1) $html .= '<h2 style="font-size:16px;margin:18px 0 6px">' . htmlspecialchars($s['name']) . '</h2>';
            foreach ($sections as [$title, $lines]) {
                $text .= "$title:\n- " . implode("\n- ", $lines) . "\n\n";
                $html .= '<h3 style="font-size:13px;letter-spacing:.05em;text-transform:uppercase;color:#0f5f73;margin:14px 0 4px">' . htmlspecialchars($title) . '</h3><ul style="padding-left:18px;margin:0">';
                foreach ($lines as $l) $html .= '<li style="margin:4px 0">' . htmlspecialchars($l) . '</li>';
                $html .= '</ul>';
            }
        }
        return [$text, $html, !$any];
    }
}
