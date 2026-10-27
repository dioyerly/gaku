'use strict';
/* ===== Núcleo: utilidades, DOM, iconos, fechas, estado, API ===== */
const BRAND = window.MRE_BRAND || (() => { try { return JSON.parse(document.querySelector('meta[name=mre-brand]').content); } catch (e) { return { name: 'Gaku', short: 'Gaku' }; } })();
const DEMO = !!window.MRE_DEMO;
const LOCAL = !!window.GAKU_LOCAL;   // versión de un solo archivo (pago único)
const NOSRV = DEMO || LOCAL;        // sin servidor propio: sin correo, sin adjuntos, sin cuentas
const $ = (s, r = document) => r.querySelector(s);
/* append tolerante: aplana listas e ignora null/false */
(() => { const o = Element.prototype.append; Element.prototype.append = function (...a) { return o.apply(this, a.flat(Infinity).filter((x) => x != null && x !== false)); }; })();

function h(tag, a, ...kids) {
  const el = document.createElement(tag);
  if (a) for (const k in a) {
    const v = a[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) sk.startsWith('--') ? el.style.setProperty(sk, v[sk]) : (el.style[sk] = v[sk]); }
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  add(el, kids);
  return el;
}
function add(el, kids) { for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); } return el; }
const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => { const a = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; const r = crypto.getRandomValues(new Uint8Array(12)); for (const b of r) s += a[b % 36]; return s; };
const debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.flush = (...a) => { clearTimeout(t); fn(...a); }; f.cancel = () => clearTimeout(t); return f; };
const by = (f, dir = 1) => (a, b) => { const x = f(a), y = f(b); return x < y ? -dir : x > y ? dir : 0; };
const plural = (n, a, b) => n === 1 ? `${n} ${a}` : `${n} ${b}`;
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- iconos ---------- */
const IC = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M16 2v4 M8 2v4 M3 10h18',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  note: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  more: 'M3 6h18 M3 12h18 M3 18h18',
  plus: 'M12 5v14 M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18 M6 6l12 12',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  bag: 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  trash: 'M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6 M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  edit: 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  chevL: 'M15 18l-6-6 6-6', chevR: 'M9 18l6-6-6-6', chevD: 'M6 9l6 6 6-6',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  clip: 'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
  alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7',
  play: 'M5 3l14 9-14 9z', pause: 'M6 4h4v16H6z M14 4h4v16h-4z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  cap: 'M22 10L12 5 2 10l10 5 10-5z M6 12v5c3 3 9 3 12 0v-5',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  repeat: 'M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3',
  bold: 'M6 4h8a4 4 0 0 1 0 8H6z M6 12h9a4 4 0 0 1 0 8H6z',
  italic: 'M19 4h-9 M14 20H5 M15 4L9 20',
  box: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
};
/* sin logo: la marca es solo el nombre */
function logoMark() { return null; }
function icon(name, size = 20, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  for (const d of (IC[name] || '').split(' M')) { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', (d.startsWith('M') ? '' : 'M') + d); s.append(p); }
  return s;
}

/* ---------- fechas (cadenas locales YYYY-MM-DD / HH:mm) ---------- */
const DOWN = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DOWS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DOWL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MON = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const p2 = (n) => String(n).padStart(2, '0');
const D = {
  parse: (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); },
  str: (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`,
  add: (s, n) => { const d = D.parse(s); d.setDate(d.getDate() + n); return D.str(d); },
  dow: (s) => D.parse(s).getDay(),
  diff: (a, b) => Math.round((D.parse(b) - D.parse(a)) / 864e5),
  weekStart: (s, ws) => D.add(s, -((D.dow(s) - ws + 7) % 7)),
  monthStart: (s) => s.slice(0, 8) + '01',
  addMonths: (s, n) => { const d = D.parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return D.str(d); },
  daysIn: (s) => { const d = D.parse(s); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); },
  long: (s) => { const d = D.parse(s); return `${DOWN[d.getDay()]} ${d.getDate()} de ${MON[d.getMonth()]}`; },
  short: (s) => { const d = D.parse(s); return `${DOWS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; },
  month: (s) => { const d = D.parse(s); return `${MON[d.getMonth()]} ${d.getFullYear()}`; },
  rel: (s, today) => { const n = D.diff(today, s); return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : n > 1 && n < 7 ? 'el ' + DOWN[D.dow(s)] : D.short(s); },
};
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const mins = (t) => { const [a, b] = String(t || '0:0').split(':').map(Number); return a * 60 + (b || 0); };
const hm = (m) => `${p2(Math.floor(m / 60) % 24)}:${p2(m % 60)}`;
function fmtTime(t) {
  if (!t) return '';
  if (!S.me?.settings?.hour12) return t;
  const [a, b] = t.split(':').map(Number);
  return `${a % 12 || 12}:${p2(b)} ${a < 12 ? 'a. m.' : 'p. m.'}`;
}
function nowIn(tz) {
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const o = {}; for (const p of f.formatToParts(new Date())) o[p.type] = p.value;
    return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}` };
  } catch (e) { const d = new Date(); return { date: D.str(d), time: `${p2(d.getHours())}:${p2(d.getMinutes())}` }; }
}
function clock() { const st = curStudent(); return nowIn(S.me?.settings?.tz || st?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone); }
const today = () => clock().date;

/* ---------- estado ---------- */
const S = {
  me: null, member: null, family: null, students: [], recs: new Map(), members: [], invites: [],
  since: 0, csrf: '', meta: null, ver: 0, sid: null, online: true, lastSync: 0,
};
const isGuardian = () => S.member?.role === 'guardian';
const isFamily = () => S.family?.mode === 'family';
const liveStudents = () => S.students.filter((s) => !s.deleted);
const activeStudents = () => liveStudents().filter((s) => !s.settings?.archived);
function curStudent() {
  const l = liveStudents();
  if (S.member?.role === 'student') return l.find((s) => s.id === S.member.student_id) || l[0];
  return l.find((s) => s.id === S.sid) || activeStudents()[0] || l[0];
}
function flat(r) { return { ...r.data, id: r.id, _type: r.type, _sid: r.student_id, _vis: r.visibility, _by: r.created_by, _upd: r.updated_at }; }
const META = ['id', '_type', '_sid', '_vis', '_by', '_upd'];
const stripMeta = (o) => { const x = { ...o }; for (const k of META) delete x[k]; return x; };
let _rc = { ver: -1, sid: null, map: {} };
function R(type, sid) {
  const st = sid === undefined ? curStudent() : { id: sid };
  const key = type + '|' + (st?.id || '');
  if (_rc.ver !== S.ver) _rc = { ver: S.ver, map: {} };
  if (_rc.map[key]) return _rc.map[key];
  const out = [];
  for (const r of S.recs.values()) if (r.type === type && !r.deleted && (r.student_id === null || r.student_id === st?.id)) out.push(flat(r));
  return (_rc.map[key] = out);
}
const get = (id) => { const r = S.recs.get(id); return r && !r.deleted ? flat(r) : null; };
const subjectOf = (id) => id ? get(id) : null;
const teacherOf = (id) => id ? get(id) : null;
const colorOf = (sub) => `var(--s${(sub?.color ?? 0) % 8})`;
const myUid = () => S.me?.id;
const canWrite = (type) => isGuardian() || ['task', 'material', 'note', 'quiz', 'question', 'help', 'bag', 'session', 'plan'].includes(type);
const canEditRec = (o) => isGuardian() || (o._by === myUid() && canWrite(o._type));

/* ---------- eventos de cambio ---------- */
const listeners = new Set();
function bump() { S.ver++; for (const f of listeners) f(); }

/* ---------- API ---------- */
class ApiError extends Error { constructor(m, status, code) { super(m); this.status = status; this.code = code; } }
const Remote = {
  async call(method, path, body, params) {
    const url = 'api.php?r=' + path + (params ? '&' + new URLSearchParams(params) : '');
    const opt = { method, headers: { 'X-CSRF': S.csrf }, credentials: 'same-origin' };
    if (body instanceof FormData) opt.body = body; else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(url, opt); } catch (e) { S.online = false; throw new ApiError('Sin conexión con el servidor. Reintentamos solos.', 0, 'offline'); }
    S.online = true;
    let j = null; try { j = await res.json(); } catch (e) { }
    if (j && j.csrf) S.csrf = j.csrf;
    if (!res.ok) {
      if (res.status === 402 && j?.access) { S.access = j.access; setTimeout(updateChrome, 0); }
      if (j?.error === 'csrf' && !opt._retry) { await Remote.call('GET', 'meta'); return Remote.call(method, path, body, params); }
      throw new ApiError(j?.message || 'Error del servidor', res.status, j?.error);
    }
    return j;
  },
};
let Backend = Remote;
const api = (m, p, b, q) => Backend.call(m, p, b, q);

/* ---------- aplicar respuesta de sync ---------- */
function applySync(j) {
  if (j.user || j.member !== undefined) {
    if (j.user) S.me = j.user; S.member = j.member; S.family = j.family;
  }
  if (j.csrf) S.csrf = j.csrf;
  if (j.access !== undefined) S.access = j.access;
  if (j.students) S.students = j.students;
  if (j.members) S.members = j.members;
  if (j.invites) S.invites = j.invites;
  if (j.full) S.recs = new Map();
  for (const r of j.records || []) { if (r.deleted) S.recs.delete(r.id); else S.recs.set(r.id, r); }
  if (j.server_time) S.since = Math.max(S.since, ...(j.records || []).map((r) => r.updated_at), 0);
  if (j.full && !(j.records || []).length) S.since = Math.max(S.since, 1);
  S.lastSync = Date.now();
  bump();
}
async function syncNow(full) {
  const j = await api('GET', 'sync', undefined, full || !S.since ? undefined : { since: S.since });
  applySync(j);
  return j;
}

/* ---------- mutaciones optimistas ---------- */
const saving = { n: 0, err: null };
const saveListeners = new Set();
function saveState(delta, err) { saving.n += delta; if (err !== undefined) saving.err = err; for (const f of saveListeners) f(); }
async function mutate(opt, fn, rollback) {
  saveState(1);
  try { const r = await fn(); saveState(-1, null); return r; }
  catch (e) { rollback && rollback(); bump(); saveState(-1, e.message); toast(e.message || 'No se pudo guardar', 'bad'); throw e; }
}
/** Crea o modifica un registro. obj puede traer id (modifica) o no (crea). */
function put(type, obj, opts = {}) {
  const cur = obj.id ? S.recs.get(obj.id) : null;
  const sid = opts.sid !== undefined ? opts.sid : (cur ? cur.student_id : (opts.family ? null : curStudent()?.id ?? null));
  const data = stripMeta(obj);
  if (cur) {
    const old = cur.data; const patch = {};
    for (const k of new Set([...Object.keys(old), ...Object.keys(data)])) if (JSON.stringify(old[k]) !== JSON.stringify(data[k])) patch[k] = data[k] === undefined ? null : data[k];
    if (!Object.keys(patch).length && !opts.vis) return Promise.resolve(obj);
    const prev = cur; const next = { ...cur, data: { ...old, ...data }, updated_at: Date.now() };
    if (opts.vis) next.visibility = opts.vis;
    S.recs.set(cur.id, next); bump();
    return mutate(opts, async () => {
      const r = await api('PATCH', 'records/' + cur.id, { data: patch, ...(opts.vis ? { visibility: opts.vis } : {}) });
      S.recs.set(cur.id, r.record); S.since = Math.max(S.since, r.record.updated_at); bump(); return flat(r.record);
    }, () => S.recs.set(prev.id, prev));
  }
  const id = uid();
  const rec = { id, type, student_id: sid, data, visibility: opts.vis || 'family', created_by: myUid(), updated_by: myUid(), created_at: Date.now(), updated_at: Date.now(), deleted: false };
  S.recs.set(id, rec); bump();
  return mutate(opts, async () => {
    const r = await api('POST', 'records', { id, type, student_id: sid, data, visibility: opts.vis || 'family' });
    S.recs.set(id, r.record); S.since = Math.max(S.since, r.record.updated_at); bump(); return flat(r.record);
  }, () => S.recs.delete(id));
}
function del(id) {
  const prev = S.recs.get(id); if (!prev) return Promise.resolve();
  S.recs.delete(id); bump();
  return mutate({}, async () => { await api('DELETE', 'records/' + id); }, () => S.recs.set(id, prev));
}
async function delMany(ids) { for (const id of ids) await del(id); }

/* ---------- toasts, diálogos, hojas ---------- */
function toast(msg, kind = '') {
  let box = $('#toasts'); if (!box) { box = h('div', { id: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast ' + kind }, msg); box.append(t);
  setTimeout(() => t.classList.add('out'), 3600); setTimeout(() => t.remove(), 4000);
}
let sheetStack = [];
function sheet(title, build, opts = {}) {
  const prevFocus = document.activeElement;
  const body = h('div', { class: 'sheet-body' });
  const close = () => { ov.remove(); sheetStack = sheetStack.filter((x) => x !== ov); document.body.classList.toggle('noscroll', sheetStack.length > 0); if (opts.onClose) opts.onClose(); if (!sheetStack.length && typeof refresh === 'function') refresh(); prevFocus && prevFocus.focus && prevFocus.focus(); };
  const ov = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === ov) close(); } },
    h('div', { class: 'sheet' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'sheet-head' }, h('h2', null, title), h('button', { class: 'ib', 'aria-label': 'Cerrar', onclick: close }, icon('x'))), body));
  ov.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const f = [...ov.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"]),[contenteditable=true]')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return; const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.body.append(ov); sheetStack.push(ov); document.body.classList.add('noscroll');
  add(body, build(close));
  setTimeout(() => { const f = body.querySelector('input:not([type=hidden]),select,textarea,button.primary'); f && f.focus(); }, 30);
  return close;
}
const sheetOpen = () => sheetStack.length > 0;
function confirmDlg(msg, okLabel = 'Confirmar', danger = false, detail = '') {
  return new Promise((res) => {
    let done = false;
    const close = sheet('Confirmar', (cl) => [
      h('p', { class: 'cf-msg' }, msg), detail && h('p', { class: 'muted' }, detail),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: () => { done = true; cl(); res(false); } }, 'Cancelar'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { done = true; cl(); res(true); } }, okLabel)),
    ], { onClose: () => { if (!done) res(false); } });
  });
}

/* ---------- formularios dirigidos por esquema ---------- */
/** field: {k,label,type,options,required,hint,placeholder,min,max,rows,show:(v)=>bool} */
function buildForm(fields, value, onChange) {
  const v = { ...value };
  const wrap = h('div', { class: 'form' });
  const els = {};
  const paint = () => {
    clear(wrap);
    for (const f of fields) {
      if (f.show && !f.show(v)) continue;
      const id = 'f_' + f.k;
      let inp;
      const ch = (val) => { v[f.k] = val; onChange && onChange(v, f.k); if (f.reactive) paint(); };
      switch (f.type) {
        case 'textarea': inp = h('textarea', { id, rows: f.rows || 3, placeholder: f.placeholder || '', value: v[f.k] ?? '', oninput: (e) => { v[f.k] = e.target.value; } }); break;
        case 'select': inp = h('select', { id, onchange: (e) => ch(e.target.value) }, (typeof f.options === 'function' ? f.options(v) : f.options).map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return h('option', { value: val, selected: String(v[f.k] ?? '') === String(val) }, lab); })); break;
        case 'checkbox': inp = h('label', { class: 'chk', for: id }, h('input', { type: 'checkbox', id, checked: !!v[f.k], onchange: (e) => ch(e.target.checked) }), h('span', null, f.text || f.label)); break;
        case 'number': inp = h('input', { id, type: 'number', inputmode: 'decimal', step: f.step || 'any', min: f.min, max: f.max, value: v[f.k] ?? '', placeholder: f.placeholder || '', oninput: (e) => { v[f.k] = e.target.value === '' ? null : Number(e.target.value); } }); break;
        case 'date': inp = h('input', { id, type: 'date', value: v[f.k] ?? '', oninput: (e) => ch(e.target.value) }); break;
        case 'time': inp = h('input', { id, type: 'time', value: v[f.k] ?? '', oninput: (e) => ch(e.target.value) }); break;
        case 'datetime': {
          const [dd, tt] = String(v[f.k] || '').split('T');
          const upd = () => { const d = $('#' + id + '_d', wrap).value, t = $('#' + id + '_t', wrap).value; v[f.k] = d ? (t ? d + 'T' + t : d) : ''; };
          inp = h('div', { class: 'dt' }, h('input', { id: id + '_d', type: 'date', value: dd || '', 'aria-label': f.label + ' (fecha)', oninput: upd }), h('input', { id: id + '_t', type: 'time', value: tt || '', 'aria-label': f.label + ' (hora)', oninput: upd }));
          break;
        }
        case 'chips': inp = h('div', { class: 'chips', role: 'group', 'aria-label': f.label }, f.options.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; const on = f.multi ? (v[f.k] || []).includes(val) : v[f.k] === val; return h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on, onclick: () => { if (f.multi) { const a = new Set(v[f.k] || []); a.has(val) ? a.delete(val) : a.add(val); ch([...a]); } else ch(val); paint(); } }, on && icon('check', 14), lab); })); break;
        case 'color': inp = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Color' }, [0, 1, 2, 3, 4, 5, 6, 7].map((i) => h('button', { type: 'button', role: 'radio', 'aria-checked': (v[f.k] ?? 0) === i, 'aria-label': 'Color ' + (i + 1), class: 'sw' + ((v[f.k] ?? 0) === i ? ' on' : ''), style: { background: `var(--s${i})` }, onclick: () => { ch(i); paint(); } }, (v[f.k] ?? 0) === i && icon('check', 14)))); break;
        case 'custom': inp = f.render(v, paint); break;
        default: inp = h('input', { id, type: f.type || 'text', value: v[f.k] ?? '', placeholder: f.placeholder || '', autocomplete: f.autocomplete || 'off', maxlength: f.max || 200, oninput: (e) => { v[f.k] = e.target.value; onChange && onChange(v, f.k); } });
      }
      els[f.k] = inp;
      wrap.append(h('div', { class: 'field' + (f.half ? ' half' : '') }, f.type !== 'checkbox' && h('label', { for: id }, f.label, f.required && h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')), inp, f.hint && h('p', { class: 'hint' }, f.hint)));
    }
  };
  paint();
  return {
    el: wrap, v,
    validate() { for (const f of fields) { if (f.show && !f.show(v)) continue; if (f.required && (v[f.k] == null || String(v[f.k]).trim() === '')) { const e = els[f.k]; e && e.focus && e.focus(); toast(`Completá: ${f.label}`, 'bad'); return false; } } return true; },
  };
}
/** Hoja de edición estándar con guardar/eliminar. */
function editSheet(title, fields, value, { onSave, onDelete, extra, saveLabel = 'Guardar', wide } = {}) {
  return sheet(title, (close) => {
    const form = buildForm(fields, value);
    let busy = false;
    return [form.el, extra && extra(form, close), h('div', { class: 'btnrow' },
      onDelete && h('button', { class: 'btn danger-o', onclick: async () => { if (await confirmDlg('¿Eliminar este elemento?', 'Eliminar', true, 'Esta acción no se puede deshacer.')) { close(); onDelete(); } } }, icon('trash', 16), 'Eliminar'),
      h('span', { class: 'sp' }),
      h('button', { class: 'btn', onclick: close }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async () => { if (busy || !form.validate()) return; busy = true; try { const r = await onSave(form.v, close); if (r !== false) close(); } catch (e) { busy = false; } } }, saveLabel))];
  }, { wide });
}

/* ---------- componentes chicos ---------- */
const ib = (name, label, fn, cls = '') => h('button', { class: 'ib ' + cls, 'aria-label': label, title: label, onclick: fn }, icon(name));
function empty(msg, label, fn, ic = 'check') { return h('div', { class: 'empty' }, icon(ic, 28), h('p', null, msg), label && h('button', { class: 'btn', onclick: fn }, icon('plus', 16), label)); }
const pill = (txt, cls = '', ic) => h('span', { class: 'pill ' + cls }, ic && icon(ic, 12), txt);
function subjTag(sub) { return sub ? h('span', { class: 'stag' }, h('i', { style: { background: colorOf(sub) } }), sub.name) : null; }
function copyText(txt) { return (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => toast('Copiado'), () => { prompt1(txt); }); }
function prompt1(txt) { sheet('Copiá este texto', () => [h('textarea', { rows: 3, readonly: true, onfocus: (e) => e.target.select() }, txt)]); }
function download(name, text, mime = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name }); document.body.append(a); a.click(); a.remove();
}

'use strict';
/* ===== Lógica: clases (recurrencia, excepciones, solapes), notas, promedios, planificador ===== */
const DONE_TASK = ['terminada', 'entregada', 'revisada'];
const TASK_ST = ['pendiente', 'en proceso', 'terminada', 'entregada', 'revisada'];
const MAT_ST = ['conseguir', 'tenemos', 'mochila', 'llevado'];
const MAT_LABEL = { conseguir: 'Hay que conseguirlo', tenemos: 'Lo tenemos', mochila: 'En la mochila', llevado: 'Llevado' };
const isDoneTask = (t) => DONE_TASK.includes(t.status);
const isReadyMat = (m) => m.status === 'mochila' || m.status === 'llevado';
const PRI = { alta: 0, media: 1, baja: 2 };
const taskDueDate = (t) => (t.due || '').slice(0, 10);
const taskDueTime = (t) => (t.due || '').length > 10 ? t.due.slice(11, 16) : '';

/* ---------- períodos / no-lectivos ---------- */
function offPeriod(date) {
  for (const p of R('period')) if (!p.archived && (p.kind === 'vacaciones' || p.kind === 'feriado') && p.from && date >= p.from && date <= (p.to || p.from)) return p;
  return null;
}
function termOf(date) { return R('period').find((p) => p.kind === 'periodo' && p.from <= date && date <= (p.to || p.from)) || null; }

/* ---------- clases ---------- */
function slotRuns(sl, date) {
  if (D.dow(date) !== Number(sl.dow)) return false;
  if (sl.from && date < sl.from) return false;
  if (sl.to && date > sl.to) return false;
  if (sl.recur === 'biweekly') {
    const a = sl.from || '2000-01-03';
    const w = Math.floor(D.diff(a, date) / 7);
    if (((w % 2) + 2) % 2 !== 0) return false;
  }
  return true;
}
/** Ocurrencias de clase de una fecha (incluye canceladas marcadas). */
function classesOn(date, sid) {
  const sl = R('slot', sid), ex = R('exception', sid);
  const off = offPeriod(date);
  const out = [];
  for (const s of sl) {
    if (!slotRuns(s, date)) continue;
    const o = { slot: s, sub: subjectOf(s.subjectId), start: s.start, end: s.end, room: s.room || '', date, cancelled: false, moved: false, note: '' };
    const e = ex.find((x) => x.slotId === s.id && x.date === date);
    if (e) { if (e.kind === 'cancel') { o.cancelled = true; o.note = e.note || ''; } else { o.moved = true; o.start = e.start || o.start; o.end = e.end || o.end; o.room = e.room ?? o.room; o.note = e.note || ''; } o.exc = e; }
    if (off) o.cancelled = true, o.off = off;
    out.push(o);
  }
  // clases sueltas por excepción 'add'
  for (const e of ex) if (e.kind === 'add' && e.date === date) out.push({ slot: null, sub: subjectOf(e.subjectId), start: e.start, end: e.end, room: e.room || '', date, cancelled: false, moved: false, extra: true, exc: e, note: e.note || '' });
  return out.sort(by((o) => o.start));
}
const classesActive = (date, sid) => classesOn(date, sid).filter((c) => !c.cancelled);
const overlapT = (a1, a2, b1, b2) => mins(a1) < mins(b2) && mins(b1) < mins(a2);
/** Busca choques de horario con otras clases del estudiante (hasta 20 semanas). */
function findOverlaps(draft, ignoreId, sid) {
  const out = [];
  if (!draft.start || !draft.end || draft.dow == null || draft.dow === '') return out;
  if (mins(draft.end) <= mins(draft.start)) return out;
  const from = draft.from || today();
  const limit = draft.to && draft.to < D.add(from, 7 * 20) ? draft.to : D.add(from, 7 * 20);
  let d = from; while (D.dow(d) !== Number(draft.dow)) d = D.add(d, 1);
  const me = { ...draft, id: '__draft', from: draft.from || '2000-01-03' };
  if (draft.recur === 'biweekly' && !draft.from) me.from = d;
  for (; d <= limit; d = D.add(d, 7)) {
    if (!slotRuns(me, d)) continue;
    for (const o of classesOn(d, sid)) {
      if (o.cancelled || (o.slot && o.slot.id === ignoreId)) continue;
      if (overlapT(draft.start, draft.end, o.start, o.end)) { out.push({ date: d, other: o }); break; }
    }
    if (out.length >= 3) break;
  }
  return out;
}
/** Aplica un cambio sobre una ocurrencia: scope = 'this' | 'following' | 'all'. changes=null → eliminar. */
async function applySlotScope(sl, date, scope, changes) {
  const sid = sl._sid;
  const exs = R('exception', sid).filter((x) => x.slotId === sl.id);
  if (scope === 'all') {
    if (changes === null) { await del(sl.id); await delMany(exs.map((x) => x.id)); return; }
    await put('slot', { ...sl, ...changes }, { sid }); return;
  }
  if (scope === 'following') {
    const atStart = !sl.from || date <= sl.from;
    if (atStart) return applySlotScope(sl, date, 'all', changes);
    const oldTo = sl.to || '';
    await put('slot', { ...sl, to: D.add(date, -1) }, { sid });
    if (changes !== null) {
      const ns = { ...stripMeta(sl), ...changes, from: date, to: oldTo };
      delete ns.id;
      const created = await put('slot', ns, { sid });
      for (const x of exs.filter((x) => x.date >= date)) await put('exception', { ...x, slotId: created.id }, { sid });
    } else await delMany(exs.filter((x) => x.date >= date).map((x) => x.id));
    return;
  }
  // solo esta
  const prev = exs.find((x) => x.date === date);
  const e = changes === null ? { slotId: sl.id, date, kind: 'cancel' } : { slotId: sl.id, date, kind: 'move', start: changes.start ?? sl.start, end: changes.end ?? sl.end, room: changes.room ?? sl.room ?? '', note: changes.note || '' };
  await put('exception', prev ? { ...prev, ...e } : e, { sid });
}

/* ---------- agenda: eventos del día ---------- */
function dayItems(date, sid) {
  const items = [];
  for (const c of classesOn(date, sid)) items.push({ kind: 'class', time: c.start, c, date });
  for (const t of R('task', sid)) if (taskDueDate(t) === date) items.push({ kind: 'task', time: taskDueTime(t), t, date });
  for (const e of R('exam', sid)) if (e.date === date) items.push({ kind: 'exam', time: e.time || '', e, date });
  for (const m of R('material', sid)) if (m.needDate === date) items.push({ kind: 'material', time: '', m, date });
  for (const v of R('event', sid)) if (v.date === date) items.push({ kind: 'event', time: v.time || '', v, date });
  for (const s of R('session', sid)) if (s.date === date) items.push({ kind: 'session', time: s.start, s, date });
  return items.sort(by((x) => x.time || '99:99'));
}

/* ---------- materiales ---------- */
/** Materiales recurrentes (ej. "todos los miércoles") se evalúan por fecha. */
function materialsFor(date, sid) {
  const out = [];
  for (const m of R('material', sid)) {
    if (m.recur === 'weekly') { if (Number(m.dow) === D.dow(date)) out.push({ m, date, recurring: true, status: (m.log || []).find((l) => l.date === date)?.s || 'conseguir' }); }
    else if (m.needDate === date) out.push({ m, date, recurring: false, status: m.status });
  }
  return out;
}
async function setMaterialStatus(m, date, s) {
  const log = (m.log || []).filter((l) => l.date !== date);
  if (m.recur === 'weekly') { log.push({ date, s, at: Date.now() }); return put('material', { ...m, log: log.slice(-60) }); }
  return put('material', { ...m, status: s, log: [...(m.log || []).slice(-20), { date, s, at: Date.now() }] });
}

/* ---------- apuntes: saneado de HTML ---------- */
const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'H3', 'H4', 'P', 'DIV', 'BR', 'SPAN', 'A', 'MARK']);
const OK_CLASS = new Set(['ck', 'done']);
function sanitize(html) {
  const doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
  const walk = (node) => {
    for (const c of [...node.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1) { c.remove(); continue; }
      if (!OK_TAGS.has(c.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE'].includes(c.tagName.toUpperCase())) { c.remove(); continue; }
        walk(c); c.replaceWith(...c.childNodes); continue;
      }
      for (const a of [...c.attributes]) {
        if (a.name === 'class') { const k = a.value.split(/\s+/).filter((x) => OK_CLASS.has(x)).join(' '); k ? c.setAttribute('class', k) : c.removeAttribute('class'); }
        else if (a.name === 'href' && c.tagName === 'A' && /^https?:\/\//i.test(a.value)) { c.setAttribute('rel', 'noopener noreferrer'); c.setAttribute('target', '_blank'); }
        else c.removeAttribute(a.name);
      }
      if (c.tagName === 'A' && !c.getAttribute('href')) { walk(c); c.replaceWith(...c.childNodes); continue; }
      walk(c);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
const htmlText = (html) => { const d = new DOMParser().parseFromString('<body>' + (html || '').replace(/<\/(li|p|div|h[1-6])>|<br\s*\/?>/gi, ' ') + '</body>', 'text/html'); return (d.body.textContent || '').replace(/\s+/g, ' ').trim(); };

/* ---------- notas y promedios ---------- */
const scale = () => ({ min: 0, max: 10, pass: 6, decimals: 1, ...(S.family?.settings?.scale || {}) });
const fmtGrade = (g) => g == null || g === '' ? '—' : Number(g).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: scale().decimals });
function examGradeEff(e, sub) {
  // Si tiene recuperatorios vinculados con nota, aplica la política de la materia.
  const recs = R('exam').filter((x) => x.kind === 'recup' && x.parentId === e.id && x.grade != null);
  if (e.grade == null && !recs.length) return null;
  const best = recs.length ? recs.sort(by((x) => x.date)).slice(-1)[0] : null;
  if (!best) return { g: e.grade, note: '' };
  if (e.grade == null) return { g: best.grade, note: 'recuperatorio' };
  const pol = sub?.recup || 'replace';
  if (pol === 'avg') return { g: (Number(e.grade) + Number(best.grade)) / 2, note: 'promedio con recuperatorio' };
  if (pol === 'max') return { g: Math.max(e.grade, best.grade), note: 'la mejor de las dos' };
  return { g: best.grade, note: 'reemplazada por recuperatorio' };
}
function subjectAverage(subjectId, termId) {
  const sub = subjectOf(subjectId); const items = [];
  const term = termId ? get(termId) : null;
  const inTerm = (d) => !term || (d && d >= term.from && d <= (term.to || term.from));
  for (const e of R('exam')) {
    if (e.subjectId !== subjectId || e.kind === 'recup' || !inTerm(e.date)) continue;
    const eg = examGradeEff(e, sub); if (!eg) continue;
    items.push({ label: e.title, g: Number(eg.g), w: Number(e.weight || 1), note: eg.note, id: e.id });
  }
  for (const t of R('task')) if (t.subjectId === subjectId && t.grade != null && t.grade !== '' && inTerm(taskDueDate(t))) items.push({ label: t.title, g: Number(t.grade), w: Number(t.weight || 1), note: '', id: t.id });
  if (!items.length) return null;
  const sw = items.reduce((a, b) => a + b.w, 0);
  const avg = items.reduce((a, b) => a + b.g * b.w, 0) / (sw || 1);
  const sc = scale();
  const expl = items.length === 1 ? `Una sola nota: ${fmtGrade(items[0].g)}.` : `Promedio ponderado = (${items.map((i) => `${fmtGrade(i.g)}×${i.w}`).join(' + ')}) ÷ ${sw} = ${fmtGrade(avg)}`;
  return { avg, items, expl, pass: avg >= sc.pass, sc };
}

/* ---------- planificador de estudio (reglas, sin IA externa) ---------- */
const planCfg = () => {
  const p = R('plan')[0];
  return { days: [1, 2, 3, 4, 5], from: '17:00', to: '20:00', sessionMin: 40, breakMin: 10, ...(p || {}), _rec: p || null };
};
function freeBlocks(date, cfg, busy) {
  if (!cfg.days.includes(D.dow(date))) return [];
  if (offPeriod(date)) return [];
  let free = [[mins(cfg.from), mins(cfg.to)]];
  const cut = (a, b) => { const n = []; for (const [x, y] of free) { if (b <= x || a >= y) n.push([x, y]); else { if (a > x) n.push([x, a]); if (b < y) n.push([b, y]); } } free = n; };
  for (const c of classesActive(date)) cut(mins(c.start) - 15, mins(c.end) + 15);
  for (const b of busy) if (b.date === date) cut(mins(b.start), mins(b.end) + cfg.breakMin);
  const out = [];
  for (const [x, y] of free) { let t = x; while (t + cfg.sessionMin <= y) { out.push({ date, start: hm(t), end: hm(t + cfg.sessionMin) }); t += cfg.sessionMin + cfg.breakMin; } }
  return out;
}
/** Genera sesiones para todos los exámenes próximos. No toca sesiones hechas ni manuales. */
function buildPlan(opts = {}) {
  const cfg = planCfg(); const t0 = today();
  const exams = R('exam').filter((e) => e.date >= t0 && !e.skipPlan).sort(by((e) => e.date));
  const keep = R('session').filter((s) => s.done || !s.auto || s.date < t0);
  const busy = keep.map((s) => ({ date: s.date, start: s.start, end: s.end }));
  const out = []; const warns = [];
  for (const e of exams) {
    const last = D.add(e.date, -1); const startFrom = D.diff(t0, last) > 14 ? D.add(last, -13) : t0;
    const topics = (e.topics || []).filter((x) => !x.done);
    const need = [];
    if (!(e.topics || []).length) { need.push({ topic: e.title || 'Estudiar', w: 2 }); need.push({ topic: 'Repaso', w: 1 }); }
    else { for (const tp of topics) for (let i = 0; i < Math.max(1, Math.min(3, Number(tp.diff) || 1)); i++) need.push({ topic: tp.t, w: 1 }); if (topics.length) need.push({ topic: 'Repaso general', w: 1 }, { topic: 'Autoevaluación', w: 1 }); }
    const doneN = keep.filter((s) => s.examId === e.id && s.done).length;
    if (!need.length) continue;
    const slots = [];
    for (let d = startFrom; d <= last; d = D.add(d, 1)) for (const b of freeBlocks(d, cfg, [...busy, ...out])) slots.push(b);
    const cap = slots.length; const n = need.length;
    // distribuir parejo: tomar n slots repartidos; los últimos dos quedan para repaso
    let pick = [];
    if (cap >= n) { for (let i = 0; i < n; i++) pick.push(slots[Math.floor(i * cap / n)]); } else pick = slots.slice();
    if (cap < n) { const miss = (n - cap) * cfg.sessionMin; warns.push({ examId: e.id, title: e.title, missingMin: miss, sessions: n - cap }); }
    // ordenar: temas por dificultad primero
    pick.forEach((s, i) => { const nd = need[i]; if (nd) out.push({ examId: e.id, topic: nd.topic, date: s.date, start: s.start, end: s.end, auto: true, done: false, subjectId: e.subjectId }); });
    if (cap < n) { for (let i = cap; i < n; i++) { /* quedan sin lugar */ } }
    if (doneN) { /* sesiones hechas se mantienen */ }
  }
  return { sessions: out, warns, cfg };
}
async function applyPlan() {
  const { sessions, warns } = buildPlan();
  const t0 = today();
  const old = R('session').filter((s) => s.auto && !s.done && s.date >= t0);
  const missed = R('session').filter((s) => s.auto && !s.done && s.date < t0);
  await delMany([...old, ...missed].map((s) => s.id));
  for (const s of sessions) await put('session', s);
  return { count: sessions.length, warns, missed: missed.length };
}
function examProgress(e) {
  const ss = R('session').filter((s) => s.examId === e.id);
  const done = ss.filter((s) => s.done).length;
  const tp = e.topics || []; const tdone = tp.filter((x) => x.done).length;
  const parts = []; if (ss.length) parts.push(done / ss.length); if (tp.length) parts.push(tdone / tp.length);
  return { sessions: ss.length, done, topics: tp.length, tdone, pct: parts.length ? Math.round(100 * parts.reduce((a, b) => a + b, 0) / parts.length) : 0 };
}

/* ---------- Hoy: próxima acción y alertas ---------- */
function nextAction(sid) {
  const c = clock(); const t0 = c.date;
  const tasks = R('task', sid).filter((t) => !isDoneTask(t) && taskDueDate(t));
  const od = tasks.filter((t) => taskDueDate(t) < t0).sort(by((t) => t.due));
  if (od.length) return { tone: 'bad', ic: 'alert', title: od[0].title, why: `Estaba para ${D.rel(taskDueDate(od[0]), t0)}. Pasó la fecha, conviene resolverla primero.`, rec: od[0] };
  const ex = R('exam', sid).filter((e) => e.date >= t0 && D.diff(t0, e.date) <= 3).sort(by((e) => e.date + (e.time || '')));
  if (ex.length) { const p = examProgress(ex[0]); return { tone: 'warn', ic: 'flag', title: `${ex[0].kind === 'recup' ? 'Recuperatorio' : 'Examen'}: ${ex[0].title}`, why: `${cap1(D.rel(ex[0].date, t0))}${ex[0].time ? ' a las ' + fmtTime(ex[0].time) : ''}. Progreso de estudio: ${p.pct}%.`, rec: ex[0] }; }
  const soon = tasks.filter((t) => D.diff(t0, taskDueDate(t)) <= 1).sort(by((t) => (PRI[t.priority] ?? 1) * 1e6 + (t.due.length)));
  if (soon.length) return { tone: 'warn', ic: 'clock', title: soon[0].title, why: `Para ${D.rel(taskDueDate(soon[0]), t0)}${taskDueTime(soon[0]) ? ' a las ' + fmtTime(taskDueTime(soon[0])) : ''}.`, rec: soon[0] };
  const tm = D.add(t0, 1);
  const mat = materialsFor(tm, sid).filter((x) => !isReadyMat({ status: x.status }));
  if (mat.length) return { tone: 'warn', ic: 'bag', title: `Preparar: ${mat[0].m.name}`, why: `Se necesita mañana y todavía figura como “${MAT_LABEL[mat[0].status].toLowerCase()}”.`, rec: mat[0].m };
  const sess = R('session', sid).filter((s) => s.date === t0 && !s.done).sort(by((s) => s.start));
  if (sess.length) return { tone: 'ok', ic: 'target', title: `Estudiar: ${sess[0].topic}`, why: `Sesión planificada a las ${fmtTime(sess[0].start)}.`, rec: sess[0] };
  return null;
}
function prepTomorrow(sid) {
  const t0 = today(); const tm = D.add(t0, 1);
  return {
    date: tm, off: offPeriod(tm),
    classes: classesActive(tm, sid),
    mats: materialsFor(tm, sid),
    tasks: R('task', sid).filter((t) => !isDoneTask(t) && taskDueDate(t) === tm),
    exams: R('exam', sid).filter((e) => e.date === tm || (D.diff(tm, e.date) > 0 && D.diff(tm, e.date) <= 3)),
  };
}

/* ---------- búsqueda global ---------- */
function searchAll(q) {
  const n = norm(q).trim(); if (!n) return [];
  const out = [];
  for (const r of S.recs.values()) {
    if (r.deleted) continue;
    const st = curStudent(); if (r.student_id && st && r.student_id !== st.id) continue;
    const d = r.data; let hay = '', title = '';
    switch (r.type) {
      case 'subject': title = d.name; hay = [d.name, d.room, d.notes].join(' '); break;
      case 'teacher': title = d.name; hay = [d.name, d.email, d.notes].join(' '); break;
      case 'task': case 'exam': case 'event': title = d.title; hay = [d.title, d.notes, (d.steps || []).map((s) => s.t).join(' '), (d.topics || []).map((s) => s.t).join(' ')].join(' '); break;
      case 'note': title = d.title || 'Sin título'; hay = [d.title, htmlText(d.html), (d.tags || []).join(' ')].join(' '); break;
      case 'material': title = d.name; hay = [d.name, d.note].join(' '); break;
      case 'question': title = d.text; hay = d.text; break;
      default: continue;
    }
    if (norm(hay + ' ' + title).includes(n)) out.push({ rec: flat(r), type: r.type, title: title || '(sin título)' });
  }
  return out.slice(0, 60);
}

'use strict';
/* ===== Formularios de cada tipo de registro ===== */
const subjOpts = (none = 'Sin materia') => [['', none], ...R('subject').sort(by((s) => norm(s.name))).map((s) => [s.id, s.name])];
const teacherOpts = () => [['', 'Sin docente'], ...R('teacher', null).concat(R('teacher')).filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i).sort(by((t) => norm(t.name))).map((t) => [t.id, t.name])];
const KINDS = ['tarea', 'trabajo práctico', 'lectura', 'práctica', 'proyecto', 'otro'];
const needsDelivery = (k) => !['lectura', 'práctica'].includes(k);

/* editor de listas simples (pasos, temas, enlaces) */
function listEditor(v, key, { ph = 'Escribir…', toggle = false, extra }) {
  v[key] = (v[key] || []).map((x) => ({ ...x }));
  const box = h('div', { class: 'le' });
  const paint = () => {
    clear(box);
    v[key].forEach((it, i) => {
      box.append(h('div', { class: 'le-row' },
        toggle && h('input', { type: 'checkbox', checked: !!it.done, 'aria-label': 'Hecho', onchange: (e) => { it.done = e.target.checked; } }),
        h('input', { type: 'text', value: it.t || '', placeholder: ph, 'aria-label': ph, oninput: (e) => { it.t = e.target.value; } }),
        extra && extra(it, i, paint),
        h('button', { type: 'button', class: 'ib sm', 'aria-label': 'Quitar', onclick: () => { v[key].splice(i, 1); paint(); } }, icon('x', 16))));
    });
    box.append(h('button', { type: 'button', class: 'btn sm', onclick: () => { v[key].push(toggle ? { t: '', done: false } : { t: '' }); paint(); const ins = box.querySelectorAll('input[type=text]'); ins[ins.length - 1]?.focus(); } }, icon('plus', 14), 'Agregar'));
  };
  paint();
  return box;
}
function cleanList(a) { return (a || []).filter((x) => (x.t || '').trim()).map((x) => ({ ...x, t: x.t.trim() })); }

/* archivos adjuntos (solo con servidor) */
function filesEditor(v) {
  v.files = (v.files || []).slice();
  const box = h('div', { class: 'files' });
  const paint = () => {
    clear(box);
    for (const f of v.files) box.append(h('div', { class: 'le-row' }, icon('clip', 16), h('a', { href: 'api.php?r=files/' + f.id, target: '_blank', rel: 'noopener' }, f.name), h('button', { type: 'button', class: 'ib sm', 'aria-label': 'Quitar archivo', onclick: () => { v.files = v.files.filter((x) => x !== f); paint(); } }, icon('x', 16))));
    if (NOSRV) { box.append(h('p', { class: 'hint' }, LOCAL ? 'Adjuntar archivos está en la versión con suscripción.' : 'Adjuntar archivos funciona en la app instalada (aquí, en la demo, no se guardan archivos).')); return; }
    const inp = h('input', { type: 'file', hidden: true, accept: 'image/*,.pdf,.txt,.docx,.xlsx,.pptx', onchange: async (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast('El archivo supera los 5 MB', 'bad'); return; }
      const fd = new FormData(); fd.append('file', file); const st = curStudent(); if (st) fd.append('student_id', st.id);
      try { const r = await api('POST', 'files', fd); v.files.push({ id: r.file.id, name: r.file.name }); paint(); } catch (er) { toast(er.message, 'bad'); }
    } });
    box.append(inp, h('button', { type: 'button', class: 'btn sm', onclick: () => inp.click() }, icon('clip', 14), 'Adjuntar archivo'), h('span', { class: 'hint' }, ' Hasta 5 MB: imágenes, PDF, texto, Word, Excel, PowerPoint.'));
  };
  paint();
  return box;
}

/* ---------- tarea ---------- */
function openTask(t, defaults = {}) {
  if (t && !canEditRec(t)) return viewTask(t);
  const v0 = t ? { ...t } : { kind: 'tarea', priority: 'media', status: 'pendiente', deliver: true, steps: [], links: [], files: [], due: defaults.due || '', subjectId: defaults.subjectId || '', title: defaults.title || '', notes: defaults.notes || '', ...defaults.extra };
  const fields = [
    { k: 'title', label: 'Título', required: true, max: 120, placeholder: 'Ej.: Ejercicios 4 a 8 de la página 52' },
    { k: 'subjectId', label: 'Materia', type: 'select', options: () => subjOpts(), half: true },
    { k: 'kind', label: 'Tipo', type: 'select', options: KINDS, half: true, reactive: true },
    { k: 'due', label: 'Para cuándo', type: 'datetime', hint: 'Si no ponés hora, queda para todo el día.' },
    { k: 'priority', label: 'Prioridad', type: 'select', options: ['alta', 'media', 'baja'], half: true },
    { k: 'estimateMin', label: 'Tiempo estimado (min)', type: 'number', min: 0, half: true },
    { k: 'deliver', type: 'checkbox', label: '', text: 'Hay que entregarla (terminar y entregar son pasos distintos)' },
    { k: 'status', label: 'Estado', type: 'select', options: TASK_ST, reactive: true },
    { k: 'steps', label: 'Pasos', type: 'custom', render: (v) => listEditor(v, 'steps', { ph: 'Paso…', toggle: true }) },
    { k: 'links', label: 'Enlaces', type: 'custom', render: (v) => listEditor(v, 'links', { ph: 'Título', extra: (it) => h('input', { type: 'url', value: it.url || '', placeholder: 'https://…', 'aria-label': 'Dirección', oninput: (e) => { it.url = e.target.value; } }) }) },
    { k: 'files', label: 'Archivos', type: 'custom', render: (v) => filesEditor(v) },
    { k: 'notes', label: 'Notas', type: 'textarea' },
    { k: 'grade', label: 'Nota obtenida', type: 'number', half: true, show: (v) => DONE_TASK.includes(v.status) },
    { k: 'weight', label: 'Peso en el promedio', type: 'number', min: 0, half: true, show: (v) => DONE_TASK.includes(v.status) && v.grade != null },
  ];
  return editSheet(t ? 'Tarea' : 'Nueva tarea', fields, v0, {
    wide: true,
    onSave: async (v) => {
      const o = { ...v, steps: cleanList(v.steps), links: cleanList(v.links).filter((l) => l.url), title: v.title.trim() };
      if (v.kind && !needsDelivery(v.kind) && !t) o.deliver = false;
      if (DONE_TASK.includes(o.status) && !o.doneAt) o.doneAt = Date.now();
      const r = await put('task', o);
      if (o.due && !t) toast('Tarea guardada');
      return r;
    },
    onDelete: t && (() => del(t.id).then(() => toast('Tarea eliminada'))),
  });
}
function viewTask(t) {
  return sheet('Tarea', (close) => {
    const sub = subjectOf(t.subjectId);
    const steps = (t.steps || []).map((s) => ({ ...s }));
    const box = h('div', { class: 'stack' });
    const paintSteps = () => { clear(sl); steps.forEach((s) => sl.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!s.done, onchange: (e) => { s.done = e.target.checked; put('task', { ...t, steps }); } }), h('span', null, s.t)))); };
    const sl = h('div', { class: 'stack sm' }); paintSteps();
    add(box, [h('h3', null, t.title), h('div', { class: 'meta' }, subjTag(sub), t.due && pill(`Para ${D.short(taskDueDate(t))}${taskDueTime(t) ? ' ' + fmtTime(taskDueTime(t)) : ''}`, '', 'clock'), t.priority && pill('Prioridad ' + t.priority)),
      t.notes && h('p', null, t.notes), steps.length ? [h('h4', null, 'Pasos'), sl] : null,
      (t.links || []).length ? [h('h4', null, 'Enlaces'), ...t.links.map((l) => h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.t || l.url))] : null,
      (t.files || []).length ? [h('h4', null, 'Archivos'), ...t.files.map((f) => h('a', { href: 'api.php?r=files/' + f.id, target: '_blank', rel: 'noopener' }, f.name))] : null,
      h('div', { class: 'field' }, h('label', { for: 'vt_st' }, 'Tu avance'), h('select', { id: 'vt_st', onchange: (e) => { put('task', { ...t, steps, status: e.target.value }); toast('Estado actualizado'); } }, TASK_ST.map((s) => h('option', { value: s, selected: s === t.status }, cap1(s))))),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: () => { close(); openHelp(t); } }, icon('help', 16), 'Pedir ayuda'), h('span', { class: 'sp' }), h('button', { class: 'btn primary', onclick: close }, 'Listo'))]);
    return [box];
  });
}
function openHelp(t) {
  return editSheet('Pedir ayuda', [{ k: 'text', label: 'Qué te cuesta', type: 'textarea', required: true, placeholder: 'Ej.: No entiendo el ejercicio 6' }], { text: '', taskId: t?.id || '', subjectId: t?.subjectId || '' }, { saveLabel: 'Enviar', onSave: async (v) => { await put('help', { ...v, resolved: false }); toast('Pedido enviado a tu familia'); } });
}

/* ---------- examen / recuperatorio ---------- */
function openExam(e, defaults = {}) {
  if (e && !canEditRec(e)) return viewExam(e);
  const v0 = e ? { ...e } : { kind: 'exam', title: '', subjectId: defaults.subjectId || '', date: defaults.date || '', time: '', topics: [], weight: 1, ...defaults.extra };
  const fields = [
    { k: 'kind', label: 'Qué es', type: 'select', options: [['exam', 'Examen'], ['recup', 'Recuperatorio']], reactive: true },
    { k: 'title', label: 'Título', required: true, placeholder: 'Ej.: Parcial 1 — Funciones' },
    { k: 'subjectId', label: 'Materia', type: 'select', options: () => subjOpts(), reactive: true },
    { k: 'parentId', label: 'Examen que recupera', type: 'select', show: (v) => v.kind === 'recup', options: (v) => [['', 'Elegir…'], ...R('exam').filter((x) => x.kind !== 'recup' && x.id !== v.id && (!v.subjectId || x.subjectId === v.subjectId)).map((x) => [x.id, `${x.title} (${D.short(x.date || '2000-01-01')})`])] },
    { k: 'date', label: 'Fecha', type: 'date', required: true, half: true }, { k: 'time', label: 'Hora', type: 'time', half: true },
    { k: 'room', label: 'Aula / lugar', half: true }, { k: 'weight', label: 'Peso en el promedio', type: 'number', min: 0, half: true, hint: 'Ej.: 1 = normal, 2 = vale el doble.' },
    { k: 'topics', label: 'Temas a estudiar', type: 'custom', render: (v) => listEditor(v, 'topics', { ph: 'Tema…', toggle: true, extra: (it) => h('select', { 'aria-label': 'Dificultad', title: 'Dificultad', onchange: (ev) => { it.diff = Number(ev.target.value); } }, [[1, 'Fácil'], [2, 'Media'], [3, 'Difícil']].map(([n, l]) => h('option', { value: n, selected: (it.diff || 2) === n }, l))) }) },
    { k: 'grade', label: `Nota obtenida (${scale().min}–${scale().max})`, type: 'number', half: true }, { k: 'notes', label: 'Notas', type: 'textarea' },
  ];
  return editSheet(e ? (e.kind === 'recup' ? 'Recuperatorio' : 'Examen') : 'Nuevo examen', fields, v0, {
    wide: true,
    onSave: async (v) => {
      const o = { ...v, topics: cleanList(v.topics).map((x) => ({ ...x, diff: x.diff || 2 })), title: v.title.trim() };
      if (o.kind === 'recup' && !o.parentId) { toast('Elegí qué examen recupera', 'bad'); return false; }
      if (o.grade != null && (o.grade < scale().min || o.grade > scale().max)) { toast(`La nota debe estar entre ${scale().min} y ${scale().max}`, 'bad'); return false; }
      const r = await put('exam', o);
      if (!e) { toast('Guardado. Podés armar el plan de estudio en “Estudio”.'); }
      return r;
    },
    onDelete: e && (() => del(e.id).then(async () => { await delMany(R('session').filter((s) => s.examId === e.id).map((s) => s.id)); toast('Examen eliminado'); })),
  });
}
function viewExam(e) {
  return sheet(e.kind === 'recup' ? 'Recuperatorio' : 'Examen', (close) => {
    const topics = (e.topics || []).map((x) => ({ ...x }));
    const p = examProgress(e);
    return [h('h3', null, e.title), h('div', { class: 'meta' }, subjTag(subjectOf(e.subjectId)), pill(`${D.long(e.date)}${e.time ? ' · ' + fmtTime(e.time) : ''}`, '', 'calendar'), e.room && pill(e.room)),
      topics.length ? [h('h4', null, 'Temas'), ...topics.map((x) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!x.done, onchange: (ev) => { x.done = ev.target.checked; put('exam', { ...e, topics }); } }), h('span', null, x.t)))] : null,
      h('p', { class: 'muted' }, `Progreso de estudio: ${p.pct}%`), h('div', { class: 'btnrow' }, h('span', { class: 'sp' }), h('button', { class: 'btn primary', onclick: close }, 'Listo'))];
  });
}

/* ---------- materia y docente ---------- */
function openSubject(s) {
  const v0 = s ? { ...s } : { name: '', color: R('subject').length % 8, recup: 'replace', teacherId: '', room: '', newTeacher: '' };
  const fields = [
    { k: 'name', label: 'Nombre de la materia', required: true, max: 60, placeholder: 'Ej.: Matemática' },
    { k: 'color', label: 'Color', type: 'color' },
    { k: 'teacherId', label: 'Docente', type: 'select', options: () => teacherOpts() },
    { k: 'newTeacher', label: 'O agregar un docente nuevo', placeholder: 'Nombre y apellido', hint: 'Si lo completás, se crea y queda asignado.' },
    { k: 'room', label: 'Aula habitual', half: true },
    { k: 'recup', label: 'Si hay recuperatorio, la nota final es…', type: 'select', options: [['replace', 'La del recuperatorio'], ['max', 'La más alta'], ['avg', 'El promedio de ambas']], half: true },
    { k: 'notes', label: 'Notas de la materia', type: 'textarea' },
  ];
  return editSheet(s ? 'Materia' : 'Nueva materia', fields, v0, {
    onSave: async (v) => {
      const o = { ...v, name: v.name.trim() }; delete o.newTeacher;
      if (v.newTeacher && v.newTeacher.trim()) { const t = await put('teacher', { name: v.newTeacher.trim() }, { sid: null }); o.teacherId = t.id; }
      const r = await put('subject', o); if (!s) toast('Materia creada'); return r;
    },
    onDelete: s && (async () => {
      const kids = [...R('slot'), ...R('exception')].filter((x) => x.subjectId === s.id || R('slot').find((sl) => sl.id === x.slotId && sl.subjectId === s.id));
      await delMany(kids.map((k) => k.id)); await del(s.id); toast('Materia eliminada');
      for (const r of [...R('task'), ...R('exam'), ...R('note'), ...R('material')].filter((x) => x.subjectId === s.id)) await put(r._type, { ...r, subjectId: '' });
      if (location.hash.startsWith('#/materias/')) go('materias');
    }),
  });
}
function openTeacher(t) {
  return editSheet(t ? 'Docente' : 'Nuevo docente', [{ k: 'name', label: 'Nombre', required: true }, { k: 'email', label: 'Correo', type: 'email' }, { k: 'notes', label: 'Notas', type: 'textarea' }], t ? { ...t } : { name: '' }, {
    onSave: (v) => put('teacher', v, { sid: null }), onDelete: t && (() => del(t.id)),
  });
}

/* ---------- clases (horarios) ---------- */
function openSlot(sl, defaults = {}) {
  const v0 = sl ? { ...sl } : { subjectId: defaults.subjectId || '', dow: defaults.dow ?? 1, start: defaults.start || '08:00', end: defaults.end || '09:00', room: '', recur: 'weekly', from: defaults.from || '', to: '' };
  const fields = [
    { k: 'subjectId', label: 'Materia', type: 'select', required: true, options: () => subjOpts('Elegir…') },
    { k: 'dow', label: 'Día', type: 'chips', options: [1, 2, 3, 4, 5, 6, 0].map((d) => [d, DOWS[d]]) },
    { k: 'start', label: 'Desde', type: 'time', required: true, half: true }, { k: 'end', label: 'Hasta', type: 'time', required: true, half: true },
    { k: 'room', label: 'Aula', half: true }, { k: 'recur', label: 'Se repite', type: 'select', options: [['weekly', 'Todas las semanas'], ['biweekly', 'Semana por medio']], half: true },
    { k: 'from', label: 'Empieza el', type: 'date', half: true, hint: 'Vacío = desde siempre.' }, { k: 'to', label: 'Termina el', type: 'date', half: true },
  ];
  return editSheet(sl ? 'Clase semanal' : 'Nueva clase semanal', fields, v0, {
    extra: (form) => { const warn = h('div', { class: 'warnbox', hidden: true, role: 'alert' }); form.el.addEventListener('input', () => check()); form.el.addEventListener('click', () => setTimeout(check, 0)); const check = () => { const o = findOverlaps(form.v, sl?.id, sl?._sid); warn.hidden = !o.length; clear(warn); if (o.length) add(warn, [icon('alert', 16), ` Se superpone con ${o[0].other.sub?.name || 'otra clase'} (${fmtTime(o[0].other.start)}–${fmtTime(o[0].other.end)}) el ${D.short(o[0].date)}.`]); }; setTimeout(check, 50); return warn; },
    onSave: async (v) => {
      if (mins(v.end) <= mins(v.start)) { toast('La hora de fin tiene que ser después del inicio', 'bad'); return false; }
      if (v.to && v.from && v.to < v.from) { toast('La fecha final no puede ser anterior a la inicial', 'bad'); return false; }
      const o = findOverlaps(v, sl?.id, sl?._sid);
      if (o.length && !(await confirmDlg(`Se superpone con ${o[0].other.sub?.name || 'otra clase'} el ${D.short(o[0].date)}. ¿Guardar igual?`, 'Guardar igual'))) return false;
      await put('slot', { ...v, dow: Number(v.dow) }); toast('Clase guardada');
    },
    onDelete: sl && (async () => { await del(sl.id); await delMany(R('exception').filter((x) => x.slotId === sl.id).map((x) => x.id)); }),
  });
}
/** Ocurrencia de una clase en una fecha: ver, mover, cancelar, con alcance. */
function openClass(oc) {
  return sheet(oc.sub?.name || 'Clase', (close) => {
    const sl = oc.slot; const date = oc.date;
    const st = { scope: 'this' };
    const scopeSel = () => sl ? h('div', { class: 'field' }, h('label', null, 'Aplicar a'), h('div', { class: 'chips', role: 'radiogroup' }, [['this', 'Solo esta clase'], ['following', 'Esta y las siguientes'], ['all', 'Todas']].map(([k, l]) => h('button', { type: 'button', class: 'chip' + (st.scope === k ? ' on' : ''), role: 'radio', 'aria-checked': st.scope === k, onclick: (e) => { st.scope = k; [...e.target.parentNode.children].forEach((c) => { const on = c === e.target; c.classList.toggle('on', on); c.setAttribute('aria-checked', on); }); } }, l)))) : null;
    const f = buildForm([{ k: 'start', label: 'Desde', type: 'time', half: true }, { k: 'end', label: 'Hasta', type: 'time', half: true }, { k: 'room', label: 'Aula', half: true }, { k: 'note', label: 'Aviso (opcional)', half: true, placeholder: 'Ej.: Viene suplente' }], { start: oc.start, end: oc.end, room: oc.room, note: oc.note });
    const canEdit = isGuardian();
    return [h('div', { class: 'meta' }, pill(D.long(date), '', 'calendar'), oc.cancelled && pill(oc.off ? oc.off.name : 'Cancelada', 'bad', 'x'), oc.moved && pill('Modificada', 'warn', 'edit'), oc.note && pill(oc.note)),
      canEdit && oc.slot ? [scopeSel(), f.el, h('div', { class: 'btnrow wrap' },
        h('button', { class: 'btn primary', onclick: async () => {
          if (mins(f.v.end) <= mins(f.v.start)) { toast('La hora de fin tiene que ser después del inicio', 'bad'); return; }
          if (st.scope === 'this') { const ov = classesActive(date).filter((c) => c !== oc && c.slot?.id !== sl.id && overlapT(f.v.start, f.v.end, c.start, c.end)); if (ov.length && !(await confirmDlg(`Se superpone con ${ov[0].sub?.name || 'otra clase'}. ¿Guardar igual?`, 'Guardar igual'))) return; }
          close(); await applySlotScope(sl, date, st.scope, { start: f.v.start, end: f.v.end, room: f.v.room, note: f.v.note }); toast('Clase actualizada');
        } }, 'Guardar cambios'),
        oc.cancelled && oc.exc ? h('button', { class: 'btn', onclick: async () => { close(); await del(oc.exc.id); toast('Clase restaurada'); } }, 'Restaurar clase') : h('button', { class: 'btn danger-o', onclick: async () => { close(); await applySlotScope(sl, date, st.scope, null); toast(st.scope === 'this' ? 'Clase cancelada solo ese día' : 'Clase eliminada'); } }, icon('x', 16), st.scope === 'this' ? 'Cancelar esta clase' : 'Eliminar'),
        h('button', { class: 'btn', onclick: () => { close(); openSlot(sl); } }, 'Editar la serie…'))] : h('p', { class: 'muted' }, `${fmtTime(oc.start)}–${fmtTime(oc.end)}${oc.room ? ' · ' + oc.room : ''}`),
      !oc.slot && oc.exc && canEdit ? h('button', { class: 'btn danger-o', onclick: async () => { close(); await del(oc.exc.id); } }, 'Quitar clase extra') : null,
      h('div', { class: 'btnrow wrap' }, oc.sub && h('button', { class: 'btn', onclick: () => { close(); go('materias/' + oc.sub.id); } }, icon('book', 16), 'Ir a la materia'),
        h('button', { class: 'btn', onclick: () => { close(); openNote(null, { subjectId: oc.sub?.id || '', date, slotId: sl?.id || '', title: `${oc.sub?.name || 'Clase'} — ${D.short(date)}` }); } }, icon('note', 16), 'Apunte de esta clase'))];
  });
}
function openExtraClass(date) {
  return editSheet('Clase extra o recuperada', [{ k: 'subjectId', label: 'Materia', type: 'select', required: true, options: () => subjOpts('Elegir…') }, { k: 'date', label: 'Fecha', type: 'date', required: true }, { k: 'start', label: 'Desde', type: 'time', required: true, half: true }, { k: 'end', label: 'Hasta', type: 'time', required: true, half: true }, { k: 'room', label: 'Aula' }], { date: date || today(), start: '08:00', end: '09:00', subjectId: '' }, { onSave: async (v) => { if (mins(v.end) <= mins(v.start)) { toast('La hora de fin tiene que ser después del inicio', 'bad'); return false; } await put('exception', { ...v, kind: 'add', slotId: '' }); } });
}

/* ---------- materiales ---------- */
function openMaterial(m, defaults = {}) {
  const v0 = m ? { ...m } : { name: defaults.name || '', subjectId: defaults.subjectId || '', recur: 'none', needDate: defaults.needDate || '', dow: 3, status: 'conseguir', note: '' };
  const fields = [
    { k: 'name', label: 'Qué hay que llevar', required: true, placeholder: 'Ej.: Compás y escuadra' },
    { k: 'subjectId', label: 'Materia', type: 'select', options: () => subjOpts(), half: true },
    { k: 'recur', label: 'Cuándo', type: 'select', options: [['none', 'Una vez'], ['weekly', 'Todas las semanas']], half: true, reactive: true },
    { k: 'needDate', label: 'Para el día', type: 'date', show: (v) => v.recur !== 'weekly', required: true },
    { k: 'dow', label: 'Día de la semana', type: 'select', show: (v) => v.recur === 'weekly', options: [1, 2, 3, 4, 5, 6, 0].map((d) => [d, cap1(DOWN[d])]) },
    { k: 'status', label: 'Estado', type: 'select', options: MAT_ST.map((s) => [s, MAT_LABEL[s]]), show: (v) => v.recur !== 'weekly' },
    { k: 'note', label: 'Nota', placeholder: 'Ej.: Comprar en la librería' },
  ];
  return editSheet(m ? 'Material' : 'Nuevo material', fields, v0, {
    onSave: async (v) => { const o = { ...v, dow: Number(v.dow) }; if (o.recur === 'weekly') o.needDate = ''; await put('material', o); }, onDelete: m && (() => del(m.id)),
  });
}

/* ---------- evento, período, pregunta ---------- */
function openEvent(e, defaults = {}) {
  return editSheet(e ? 'Evento' : 'Nuevo evento', [{ k: 'title', label: 'Título', required: true, placeholder: 'Ej.: Acto escolar, entrega de boletín' }, { k: 'date', label: 'Fecha', type: 'date', required: true, half: true }, { k: 'time', label: 'Hora', type: 'time', half: true }, { k: 'note', label: 'Nota', type: 'textarea' }], e ? { ...e } : { title: '', date: defaults.date || today(), time: '', ...defaults.extra }, { onSave: (v) => put('event', v), onDelete: e && (() => del(e.id)) });
}
const PERIOD_KINDS = [['periodo', 'Período (trimestre, cuatrimestre…)'], ['vacaciones', 'Vacaciones / receso'], ['feriado', 'Feriado / sin clases'], ['inscripcion', 'Inscripción / matrícula'], ['otro', 'Otra fecha importante']];
function openPeriod(p) {
  return editSheet(p ? 'Período' : 'Nuevo período', [{ k: 'name', label: 'Nombre', required: true, placeholder: 'Ej.: 1.er trimestre' }, { k: 'kind', label: 'Tipo', type: 'select', options: PERIOD_KINDS }, { k: 'from', label: 'Desde', type: 'date', required: true, half: true }, { k: 'to', label: 'Hasta', type: 'date', half: true, hint: 'Vacío = un solo día.' }, { k: 'archived', type: 'checkbox', label: '', text: 'Archivado (ya terminó, lo guardo para consultar)' }], p ? { ...p } : { name: '', kind: 'periodo', from: '', to: '' }, {
    onSave: async (v) => { if (v.to && v.to < v.from) { toast('La fecha final no puede ser anterior a la inicial', 'bad'); return false; } await put('period', v); }, onDelete: p && (() => del(p.id)),
  });
}
function openQuestion(q, defaults = {}) {
  return editSheet(q ? 'Pregunta' : 'Pregunta para el docente', [{ k: 'text', label: 'Pregunta', type: 'textarea', required: true }, { k: 'subjectId', label: 'Materia', type: 'select', options: () => subjOpts() }, { k: 'done', type: 'checkbox', label: '', text: 'Ya la pregunté / respondida' }], q ? { ...q } : { text: defaults.text || '', subjectId: defaults.subjectId || '', noteId: defaults.noteId || '', done: false }, { onSave: (v) => put('question', v), onDelete: q && (() => del(q.id)) });
}

/* ---------- agregar rápido (con contexto) ---------- */
function quickAdd(ctx = {}) {
  const c = { subjectId: ctx.subjectId || '', date: ctx.date || '' };
  const items = [
    ['Tarea', 'check', () => openTask(null, { subjectId: c.subjectId, due: c.date }), true],
    ['Examen', 'flag', () => openExam(null, { subjectId: c.subjectId, date: c.date }), isGuardian()],
    ['Apunte', 'note', () => openNote(null, { subjectId: c.subjectId, date: c.date }), true],
    ['Material', 'bag', () => openMaterial(null, { subjectId: c.subjectId, needDate: c.date }), true],
    ['Clase semanal', 'repeat', () => openSlot(null, { subjectId: c.subjectId }), isGuardian()],
    ['Clase extra', 'plus', () => openExtraClass(c.date), isGuardian()],
    ['Evento', 'calendar', () => openEvent(null, { date: c.date }), isGuardian()],
    ['Materia', 'book', () => openSubject(null), isGuardian()],
    ['Pregunta al docente', 'help', () => openQuestion(null, { subjectId: c.subjectId }), true],
  ].filter((x) => x[3]);
  const ctxLabel = c.subjectId ? subjectOf(c.subjectId)?.name : c.date ? D.long(c.date) : '';
  sheet('Agregar', (close) => [ctxLabel && h('p', { class: 'muted' }, 'Se agrega con: ', h('strong', null, ctxLabel)), h('div', { class: 'qa' }, items.map(([l, ic, fn]) => h('button', { class: 'qa-b', onclick: () => { close(); fn(); } }, icon(ic, 22), l)))]);
}

'use strict';
/* ===== Preferencias visuales, acceso y configuración inicial ===== */
const PALETTES = [['ocean', 'Océano', 'Azul petróleo y verde suave'], ['plum', 'Ciruela', 'Ciruela, lavanda y rosa empolvado']];
const hostMode = () => { const t = document.documentElement.getAttribute('data-theme'); return t === 'dark' || t === 'light' ? t : null; };
function applyPrefs() {
  const s = S.me?.settings || lsGet('prefs') || {};
  const r = document.documentElement;
  r.dataset.pal = s.theme || 'ocean';
  const m = s.mode || 'auto';
  r.dataset.mode = m === 'auto' ? (hostMode() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) : m;
  r.dataset.ts = s.textSize || 'm';
  const meta = $('meta[name=theme-color]'); if (meta) meta.content = r.dataset.mode === 'dark' ? '#0e171c' : '#f4f7f8';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyPrefs());
function lsGet(k) { try { return JSON.parse(localStorage.getItem('mre_' + k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem('mre_' + k, JSON.stringify(v)); } catch (e) { } }
async function saveSettings(patch) {
  const j = await api('PUT', 'settings', patch);
  S.me = j.user; applyPrefs(); lsSet('prefs', { theme: S.me.settings.theme, mode: S.me.settings.mode, textSize: S.me.settings.textSize }); bump(); return j;
}

/* ---------- pantallas de acceso ---------- */
function authShell(title, ...kids) {
  return h('main', { class: 'auth', id: 'main' }, h('div', { class: 'auth-card' },
    h('div', { class: 'brand-lg' }, logoMark(22+4), h('span', null, BRAND.name)),
    h('h1', null, title), ...kids));
}
function errBox() { return h('p', { class: 'err', role: 'alert', hidden: true }); }
function showErr(box, m) { box.textContent = m; box.hidden = false; }
function viewLogin() {
  const err = errBox(); const email = h('input', { type: 'email', id: 'em', autocomplete: 'email', required: true }); const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
  const submit = async (e) => { e.preventDefault(); err.hidden = true; try { const j = await api('POST', 'auth/login', { email: email.value, password: pw.value }); S.me = j.user; applyPrefs(); await afterAuth(); } catch (x) { showErr(err, x.message); } };
  return authShell('Entrar', h('form', { class: 'form', onsubmit: submit },
    h('div', { class: 'field' }, h('label', { for: 'em' }, 'Correo'), email), h('div', { class: 'field' }, h('label', { for: 'pw' }, 'Contraseña'), pw), err,
    h('button', { class: 'btn primary block' }, 'Entrar')),
    h('p', { class: 'links' }, h('a', { href: '#/olvide' }, 'Olvidé mi contraseña'), S.meta?.open_registration !== false && h('a', { href: '#/registro' }, 'Crear una cuenta')));
}
function viewRegister(invite = '') {
  const err = errBox(); const f = {};
  const mk = (k, label, type, extra) => { f[k] = h('input', { type, id: 'r_' + k, required: true, ...extra }); return h('div', { class: 'field' }, h('label', { for: 'r_' + k }, label), f[k]); };
  const submit = async (e) => { e.preventDefault(); err.hidden = true; try { const j = await api('POST', 'auth/register', { name: f.name.value, email: f.email.value, password: f.password.value, invite: invite || (f.invite?.value || '') }); S.me = j.user; applyPrefs(); await afterAuth(); } catch (x) { showErr(err, x.message); } };
  return authShell(invite ? 'Unirte a una familia' : 'Crear cuenta', invite && h('p', { class: 'muted' }, 'Tenés una invitación. Creá tu cuenta para entrar.'), h('form', { class: 'form', onsubmit: submit },
    mk('name', 'Tu nombre', 'text', { autocomplete: 'name', maxlength: 80 }), mk('email', 'Correo', 'email', { autocomplete: 'email' }), mk('password', 'Contraseña (mínimo 8 caracteres)', 'password', { autocomplete: 'new-password', minlength: 8 }),
    err, h('button', { class: 'btn primary block' }, 'Crear cuenta')), h('p', { class: 'links' }, h('a', { href: '#/entrar' }, 'Ya tengo cuenta')));
}
function viewForgot() {
  const err = errBox(); const email = h('input', { type: 'email', id: 'fe', required: true }); const ok = h('p', { class: 'okmsg', hidden: true, role: 'status' });
  return authShell('Recuperar contraseña', h('form', { class: 'form', onsubmit: async (e) => { e.preventDefault(); err.hidden = true; try { const j = await api('POST', 'auth/forgot', { email: email.value }); ok.hidden = false; ok.textContent = j.mail_configured ? 'Si el correo tiene una cuenta, te enviamos un enlace. Vence en 1 hora.' : 'Este servidor todavía no tiene el correo configurado: pedile a quien administra la app que lo configure o que restablezca tu acceso.'; } catch (x) { showErr(err, x.message); } } },
    h('div', { class: 'field' }, h('label', { for: 'fe' }, 'Correo de tu cuenta'), email), err, ok, h('button', { class: 'btn primary block' }, 'Enviar enlace')), h('p', { class: 'links' }, h('a', { href: '#/entrar' }, 'Volver')));
}
function viewReset(token) {
  const err = errBox(); const pw = h('input', { type: 'password', id: 'rp', minlength: 8, required: true, autocomplete: 'new-password' });
  return authShell('Nueva contraseña', h('form', { class: 'form', onsubmit: async (e) => { e.preventDefault(); err.hidden = true; try { await api('POST', 'auth/reset', { token, password: pw.value }); toast('Contraseña cambiada. Ya podés entrar.'); go('entrar'); } catch (x) { showErr(err, x.message); } } },
    h('div', { class: 'field' }, h('label', { for: 'rp' }, 'Contraseña nueva'), pw), err, h('button', { class: 'btn primary block' }, 'Guardar')));
}
function viewVerify(token) {
  const box = h('p', { role: 'status' }, 'Verificando…');
  api('POST', 'auth/verify', { token }).then(() => { box.textContent = '¡Listo! Tu correo quedó confirmado.'; }, (e) => { box.textContent = e.message; });
  return authShell('Confirmar correo', box, h('p', { class: 'links' }, h('a', { href: '#/' }, 'Continuar')));
}
function viewJoin(code) {
  if (S.me && !S.member) {
    const err = errBox();
    return authShell('Unirte a una familia', h('p', null, 'Vas a entrar con el código ', h('strong', null, code), '.'), err, h('button', { class: 'btn primary block', onclick: async () => { try { const j = await api('POST', 'invites/accept', { code }); S.me = j.user; await syncNow(true); toast('¡Listo! Ya estás dentro.'); go('hoy'); } catch (x) { showErr(err, x.message); } } }, 'Aceptar invitación'));
  }
  if (S.me && S.member) return authShell('Ya tenés una familia', h('p', null, 'Esta cuenta ya pertenece a una. Para usar la invitación, entrá con otra cuenta o creá una nueva.'), h('a', { class: 'btn block', href: '#/hoy' }, 'Volver'));
  return viewRegister(code);
}
async function afterAuth() {
  const j = await syncNow(true).catch((e) => { if (e.code === 'no_family') return null; throw e; });
  if (!j) { const me = await api('GET', 'auth/me'); S.me = me.user; S.member = null; S.family = null; }
  applyPrefs(); startPolling(); go(S.member ? 'hoy' : 'bienvenida');
}

/* ---------- configuración inicial (5 pasos) ---------- */
function viewOnboarding() {
  const st = { step: 0, mode: 'self', students: [{ name: S.me?.name || '', level: '', institution: '', grade: '', division: '', shift: '', tz: S.meta?.default_tz || Intl.DateTimeFormat().resolvedOptions().timeZone }], periods: [], prefs: { theme: 'ocean', mode: 'auto', textSize: 'm', hour12: false, weekStart: 1 }, notif: { email: false, leadMin: 1440, daily: true, weekly: false, digestHour: '07:00', quiet: { enabled: false, from: '22:00', to: '07:00' }, cats: { tasks: true, exams: true, materials: true, events: true } } };
  const root = h('main', { class: 'onb', id: 'main' });
  const steps = ['Cómo lo vas a usar', 'Estudiantes', 'Calendario', 'Apariencia', 'Avisos'];
  const paint = () => {
    clear(root);
    const card = h('div', { class: 'onb-card' });
    card.append(h('div', { class: 'onb-top' }, h('div', { class: 'brand-lg' }, logoMark(22+4), h('span', null, BRAND.name)), h('p', { class: 'muted' }, `Paso ${st.step + 1} de 5 · ${steps[st.step]}`)),
      h('div', { class: 'prog', role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': 5, 'aria-valuenow': st.step + 1 }, steps.map((_, i) => h('i', { class: i <= st.step ? 'on' : '' }))));
    const body = h('div', { class: 'onb-body' });
    if (st.step === 0) {
      add(body, [h('h1', null, '¿Para quién es?'), h('div', { class: 'choice' }, [['self', 'user', 'Para mí', 'Organizo mi propio estudio.'], ['family', 'users', 'Para mi familia', (LOCAL ? 'Acompaño a uno o más estudiantes desde este dispositivo.' : 'Acompaño a uno o más estudiantes. Después podés darles acceso propio.')]].map(([k, ic, t, d]) => h('button', { class: 'ch' + (st.mode === k ? ' on' : ''), 'aria-pressed': st.mode === k, onclick: () => { st.mode = k; if (k === 'self') st.students = st.students.slice(0, 1); paint(); } }, icon(ic, 26), h('strong', null, t), h('span', null, d))))]);
    } else if (st.step === 1) {
      add(body, [h('h1', null, st.mode === 'self' ? 'Tus datos de estudio' : 'Datos de cada estudiante'), h('p', { class: 'muted' }, 'Solo el nombre es obligatorio. Lo demás ayuda a mostrar mejor la agenda.')]);
      st.students.forEach((s, i) => {
        const f = buildForm([{ k: 'name', label: 'Nombre o apodo', required: true, half: true, max: 60 }, { k: 'level', label: 'Nivel', type: 'select', half: true, options: [['', '—'], 'Primaria', 'Secundaria', 'Terciario', 'Universidad', 'Curso / idioma', 'Otro'] }, { k: 'institution', label: 'Institución', half: true }, { k: 'grade', label: 'Curso o año', half: true }, { k: 'division', label: 'División / comisión', half: true }, { k: 'shift', label: 'Turno', type: 'select', half: true, options: [['', '—'], 'Mañana', 'Tarde', 'Noche', 'Doble'] }, { k: 'tz', label: 'Zona horaria', type: 'select', options: tzOptions() }], s, () => { });
        st.students[i] = f.v;
        body.append(h('div', { class: 'card' }, st.mode === 'family' && h('div', { class: 'card-h' }, h('strong', null, `Estudiante ${i + 1}`), st.students.length > 1 && h('button', { class: 'ib sm', 'aria-label': 'Quitar', onclick: () => { st.students.splice(i, 1); paint(); } }, icon('x', 16))), f.el));
      });
      if (st.mode === 'family' && st.students.length < 6) body.append(h('button', { class: 'btn', onclick: () => { st.students.push({ name: '', tz: st.students[0].tz }); paint(); } }, icon('plus', 16), 'Agregar otro estudiante'));
    } else if (st.step === 2) {
      add(body, [h('h1', null, 'Calendario académico'), h('p', { class: 'muted' }, 'Cargá períodos, vacaciones, feriados o fechas de inscripción. Podés saltear este paso y hacerlo después en Más → Calendario académico. Al terminar un período lo podés archivar sin perder lo que estudiaste.')]);
      st.periods.forEach((p, i) => body.append(h('div', { class: 'card row' }, h('div', null, h('strong', null, p.name), h('div', { class: 'muted' }, `${PERIOD_KINDS.find((k) => k[0] === p.kind)?.[1].split(' (')[0]} · ${D.short(p.from)}${p.to ? ' → ' + D.short(p.to) : ''}`)), h('button', { class: 'ib sm', 'aria-label': 'Quitar', onclick: () => { st.periods.splice(i, 1); paint(); } }, icon('x', 16)))));
      const np = { name: '', kind: 'periodo', from: '', to: '' };
      const f = buildForm([{ k: 'name', label: 'Nombre', placeholder: 'Ej.: 1.er trimestre', half: true }, { k: 'kind', label: 'Tipo', type: 'select', options: PERIOD_KINDS, half: true }, { k: 'from', label: 'Desde', type: 'date', half: true }, { k: 'to', label: 'Hasta', type: 'date', half: true }], np);
      body.append(h('div', { class: 'card' }, f.el, h('button', { class: 'btn', onclick: () => { if (!f.v.name.trim() || !f.v.from) { toast('Poné nombre y fecha de inicio', 'bad'); return; } if (f.v.to && f.v.to < f.v.from) { toast('La fecha final no puede ser anterior a la inicial', 'bad'); return; } st.periods.push({ ...f.v, name: f.v.name.trim() }); paint(); } }, icon('plus', 16), 'Agregar al calendario')));
    } else if (st.step === 3) {
      add(body, [h('h1', null, 'Apariencia'), h('p', { class: 'muted' }, 'Elegí la que te resulte más cómoda. La podés cambiar cuando quieras.'),
        h('div', { class: 'choice' }, PALETTES.map(([k, n, d]) => h('button', { class: 'ch pal pal-' + k + (st.prefs.theme === k ? ' on' : ''), 'aria-pressed': st.prefs.theme === k, onclick: () => { st.prefs.theme = k; document.documentElement.dataset.pal = k; paint(); } }, h('span', { class: 'swatchrow' }, h('i'), h('i'), h('i')), h('strong', null, n), h('span', null, d)))),
        h('div', { class: 'field' }, h('label', null, 'Claro u oscuro'), h('div', { class: 'chips' }, [['auto', 'Según mi dispositivo'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, l]) => h('button', { class: 'chip' + (st.prefs.mode === k ? ' on' : ''), 'aria-pressed': st.prefs.mode === k, onclick: () => { st.prefs.mode = k; S.me = S.me || {}; applyTmp(st.prefs); paint(); } }, l)))),
        h('div', { class: 'field' }, h('label', null, 'Tamaño del texto'), h('div', { class: 'chips' }, [['s', 'Chico'], ['m', 'Normal'], ['l', 'Grande'], ['xl', 'Muy grande']].map(([k, l]) => h('button', { class: 'chip' + (st.prefs.textSize === k ? ' on' : ''), 'aria-pressed': st.prefs.textSize === k, onclick: () => { st.prefs.textSize = k; applyTmp(st.prefs); paint(); } }, l)))),
        h('div', { class: 'field' }, h('label', null, 'Formato de hora'), h('div', { class: 'chips' }, [[false, '24 horas (18:30)'], [true, '12 horas (6:30 p. m.)']].map(([k, l]) => h('button', { class: 'chip' + (st.prefs.hour12 === k ? ' on' : ''), 'aria-pressed': st.prefs.hour12 === k, onclick: () => { st.prefs.hour12 = k; paint(); } }, l)))),
        h('div', { class: 'field' }, h('label', null, 'La semana empieza el'), h('div', { class: 'chips' }, [[1, 'Lunes'], [0, 'Domingo'], [6, 'Sábado']].map(([k, l]) => h('button', { class: 'chip' + (st.prefs.weekStart === k ? ' on' : ''), 'aria-pressed': st.prefs.weekStart === k, onclick: () => { st.prefs.weekStart = k; paint(); } }, l))))]);
    } else if (LOCAL) {
      add(body, [h('h1', null, 'Avisos'), h('p', { class: 'muted' }, 'La versión de un archivo no envía correos. Si más adelante querés avisos y sincronización entre tus aparatos, podés pasar a la suscripción desde Ajustes.')]);
    } else {
      add(body, [h('h1', null, 'Avisos'), h('p', { class: 'muted' }, 'Los avisos por correo se mandan desde el servidor, aunque no tengas la app abierta.'),
        !S.meta?.mail_configured && h('div', { class: 'warnbox' }, icon('mail', 16), ' Correo pendiente de configurar en el servidor. Podés dejar tus preferencias guardadas; los avisos se enviarán cuando se configure.'),
        h('label', { class: 'chk big' }, h('input', { type: 'checkbox', checked: st.notif.email, onchange: (e) => { st.notif.email = e.target.checked; paint(); } }), h('span', null, 'Quiero avisos por correo')),
        st.notif.email && buildNotifForm(st.notif).el]);
    }
    card.append(body, h('div', { class: 'btnrow' }, st.step > 0 && h('button', { class: 'btn', onclick: () => { st.step--; paint(); } }, 'Atrás'), h('span', { class: 'sp' }),
      st.step === 2 && h('button', { class: 'btn ghost', onclick: () => { st.step++; paint(); } }, 'Saltear'),
      h('button', { class: 'btn primary', onclick: async () => {
        if (st.step === 1 && st.students.some((s) => !(s.name || '').trim())) { toast('Falta el nombre de un estudiante', 'bad'); return; }
        if (st.step < 4) { st.step++; paint(); window.scrollTo(0, 0); return; }
        try {
          const j = await api('POST', 'family/setup', { mode: st.mode, students: st.students.map((s) => ({ ...s, name: s.name.trim() })) });
          S.me = j.user; await syncNow(true); S.sid = j.first_student;
          const tz = st.students[0].tz;
          await saveSettings({ ...st.prefs, tz, notif: { ...st.notif, students: [] } });
          for (const p of st.periods) await put('period', p, { sid: null });
          toast('¡Todo listo!'); go('hoy'); startPolling();
        } catch (x) { toast(x.message, 'bad'); }
      } }, st.step === 4 ? 'Empezar' : 'Siguiente')));
    root.append(card);
  };
  paint();
  return root;
}
function applyTmp(p) { const r = document.documentElement; r.dataset.mode = p.mode === 'auto' ? (hostMode() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) : p.mode; r.dataset.ts = p.textSize; }
function tzOptions(cur) {
  let list = []; try { list = Intl.supportedValuesOf('timeZone'); } catch (e) { list = ['America/Argentina/Buenos_Aires', 'America/Santiago', 'America/Montevideo', 'America/Bogota', 'America/Lima', 'America/Mexico_City', 'America/New_York', 'Europe/Madrid', 'UTC']; }
  if (cur && !list.includes(cur)) list = [cur, ...list];
  return list.map((z) => [z, z.replace(/_/g, ' ')]);
}
/** Formulario de avisos (se usa en onboarding y Ajustes). */
function buildNotifForm(n) {
  n.quiet = n.quiet || { enabled: false, from: '22:00', to: '07:00' }; n.cats = n.cats || { tasks: true, exams: true, materials: true, events: true };
  return buildForm([
    { k: 'leadMin', label: 'Avisarme antes de cada fecha', type: 'select', options: [[0, 'A la hora'], [60, '1 hora antes'], [180, '3 horas antes'], [720, '12 horas antes'], [1440, '1 día antes'], [2880, '2 días antes'], [10080, '1 semana antes']] },
    { k: 'daily', type: 'checkbox', label: '', text: 'Resumen diario con las clases y lo que vence' }, { k: 'weekly', type: 'checkbox', label: '', text: 'Resumen semanal (el primer día de la semana)' },
    { k: 'digestHour', label: 'Hora de los resúmenes', type: 'time', half: true },
    { k: 'qe', type: 'checkbox', label: '', text: 'No molestar en un horario', reactive: true }, { k: 'qf', label: 'No enviar desde', type: 'time', half: true, show: (v) => v.qe }, { k: 'qt', label: 'hasta', type: 'time', half: true, show: (v) => v.qe },
    { k: 'cats', label: 'Qué avisar', type: 'chips', multi: true, options: [['tasks', 'Tareas'], ['exams', 'Exámenes'], ['materials', 'Materiales'], ['events', 'Eventos']] },
  ], { ...n, leadMin: n.leadMin, qe: n.quiet.enabled, qf: n.quiet.from, qt: n.quiet.to, cats: Object.keys(n.cats).filter((k) => n.cats[k]) }, (v) => {
    n.leadMin = Number(v.leadMin); n.daily = v.daily; n.weekly = v.weekly; n.digestHour = v.digestHour; n.quiet = { enabled: v.qe, from: v.qf, to: v.qt, days: [0, 1, 2, 3, 4, 5, 6] };
    n.cats = { tasks: v.cats.includes('tasks'), exams: v.cats.includes('exams'), materials: v.cats.includes('materials'), events: v.cats.includes('events') };
  });
}

'use strict';
/* ===== Estructura, rutas, Hoy y Agenda ===== */
const NAV = [['hoy', 'Hoy', 'home'], ['agenda', 'Agenda', 'calendar'], ['materias', 'Materias', 'book'], ['apuntes', 'Apuntes', 'note'], ['mas', 'Más', 'more']];
const MORE = [['estudio', 'Plan de estudio', 'target'], ['materiales', 'Qué llevar', 'bag'], ['notas', 'Notas y promedios', 'cap'], ['calendario', 'Calendario académico', 'calendar'], ['familia', 'Familia y accesos', 'users'], ['ajustes', 'Ajustes', 'sliders']];
let cur = { name: '', args: [] };
const go = (p) => { if (location.hash === '#/' + p) route(); else location.hash = '#/' + p; };

const AUTH_ROUTES = new Set(['entrar', 'registro', 'olvide', 'restablecer', 'verificar', 'unirse', 'demo']);
const VIEWS = {};
let viewEl = null;

function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
  let name = parts[0] || '';
  const args = parts.slice(1);
  const main = $('#root');
  // guardas
  if (DEMO && !S.me) { name = 'demo'; }
  else if (!S.me) { if (!AUTH_ROUTES.has(name) || name === 'demo') name = 'entrar'; }
  else if (!S.member) { if (name !== 'unirse' && name !== 'verificar') name = 'bienvenida'; }
  else if (!name || AUTH_ROUTES.has(name) && name !== 'verificar' || name === 'bienvenida') name = 'hoy';
  cur = { name, args };
  document.title = (VIEW_TITLE[name] ? VIEW_TITLE[name] + ' · ' : '') + BRAND.name;
  clear(main);
  if (!S.me || !S.member) {
    main.className = '';
    const f = { entrar: viewLogin, registro: () => viewRegister(), olvide: viewForgot, restablecer: () => viewReset(args[0] || ''), verificar: () => viewVerify(args[0] || ''), unirse: () => viewJoin(args[0] || ''), bienvenida: viewOnboarding, demo: viewDemoChooser }[name] || viewLogin;
    main.append(DEMO && S.me ? demoBar() : null, f());
    return;
  }
  main.append(shell());
  renderView();
  window.scrollTo(0, 0);
}
const VIEW_TITLE = { hoy: 'Hoy', agenda: 'Agenda', materias: 'Materias', apuntes: 'Apuntes', mas: 'Más', estudio: 'Plan de estudio', materiales: 'Qué llevar', notas: 'Notas y promedios', calendario: 'Calendario académico', familia: 'Familia', ajustes: 'Ajustes', buscar: 'Buscar' };

function renderView() {
  const box = $('#view'); if (!box) return;
  const sc = window.scrollY;
  const f = VIEWS[cur.name] || VIEWS.hoy;
  const node = f(...cur.args);
  clear(box); box.append(node);
  box.className = 'view v-' + cur.name + (cur.args.length ? ' has-detail' : '');
  window.scrollTo(0, sc);
  $$nav();
}
function $$nav() {
  const act = ['hoy', 'agenda', 'materias', 'apuntes'].includes(cur.name) ? cur.name : 'mas';
  document.querySelectorAll('[data-nav]').forEach((a) => { const on = a.dataset.nav === act || a.dataset.nav === cur.name; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
}
let refreshQueued = false;
function refresh() {
  if (!S.me || !S.member || refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    if (sheetOpen() || window.NOTE_EDITING) { updateChrome(); return; }
    renderView(); updateChrome();
  });
}
listeners.add(refresh);

function initials(n) { return (n || '?').trim().split(/\s+/).filter((x) => /^\p{L}/u.test(x)).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?'; }
function shell() {
  const gu = isGuardian();
  const wrap = h('div', { class: 'app' + (DEMO ? ' demo' : '') });
  if (DEMO) wrap.append(demoBar());
  const navLink = (id, label, ic, cls = '') => h('a', { href: '#/' + id, 'data-nav': id, class: 'nl ' + cls }, icon(ic, 22), h('span', null, label));
  wrap.append(h('a', { class: 'skip', href: '#view' }, 'Saltar al contenido'));
  wrap.append(h('aside', { class: 'rail', 'aria-label': 'Principal' }, h('div', { class: 'brand' }, logoMark(20+4), h('span', null, BRAND.name)),
    h('nav', { 'aria-label': 'Secciones' }, NAV.slice(0, 4).map(([i, l, ic]) => navLink(i, l, ic)), h('hr'), MORE.filter(([i]) => gu || !['familia'].includes(i) || true).map(([i, l, ic]) => navLink(i, l, ic))),
    h('div', { class: 'rail-foot' }, h('button', { class: 'btn primary block', onclick: () => quickAdd(ctxNow()) }, icon('plus', 18), 'Agregar'))));
  const top = h('header', { class: 'top' },
    h('div', { class: 'brand m-only' }, logoMark(18+4), h('span', null, BRAND.short)),
    h('div', { class: 'who', id: 'who' }), h('span', { class: 'sp' }),
    h('span', { class: 'savest', id: 'savest', 'aria-live': 'polite' }),
    ib('search', 'Buscar', () => go('buscar')), h('button', { class: 'avatar', 'aria-label': 'Mi cuenta', onclick: accountMenu }, initials(S.me.name)));
  wrap.append(h('div', { class: 'col' }, top, h('div', { id: 'accbar' }), localBanner(), h('main', { id: 'view', class: 'view', tabindex: '-1' })));
  wrap.append(h('nav', { class: 'bottom', 'aria-label': 'Principal' }, NAV.map(([i, l, ic]) => navLink(i, l, ic))));
  wrap.append(h('button', { class: 'fab', 'aria-label': 'Agregar', onclick: () => quickAdd(ctxNow()) }, icon('plus', 26)));
  setTimeout(updateChrome, 0);
  return wrap;
}
function ctxNow() {
  if (cur.name === 'materias' && cur.args[0]) return { subjectId: cur.args[0] };
  if (cur.name === 'agenda' && agendaState.sel) return { date: agendaState.sel };
  return {};
}
function accessBar() {
  const box = $('#accbar'); if (!box) return; clear(box);
  const a = S.access; if (!a || NOSRV) return;
  const days = a.until ? Math.ceil((a.until - Date.now() / 1000) / 86400) : null;
  const link = (t) => a.owner && a.plan_url ? h('a', { class: 'btn sm primary', href: a.plan_url, target: '_blank', rel: 'noopener' }, t) : null;
  if (a.state === 'readonly') box.append(h('div', { class: 'gk-banner bad', role: 'status' }, icon('lock', 16), h('span', null, a.owner ? 'Tu suscripción no está al día. Podés ver y descargar tus datos, pero no guardar cambios.' : 'La suscripción del responsable de la cuenta no está al día. Podés ver tus datos, pero no guardar cambios.'), h('span', { class: 'sp' }), link('Renovar suscripción')));
  else if (a.state === 'active' && (a.kind === 'trial' || a.kind === 'manual') && days !== null && days <= 5 && a.owner) box.append(h('div', { class: 'gk-banner', role: 'status' }, icon('clock', 16), h('span', null, days <= 0 ? 'Tu período de prueba termina hoy.' : `Tu período de prueba termina en ${plural(days, 'día', 'días')}.`), h('span', { class: 'sp' }), link('Suscribirme')));
}
function updateChrome() {
  accessBar();
  const who = $('#who'); if (who) {
    clear(who);
    const act = activeStudents();
    if (isGuardian() && act.length > 1) {
      const st = curStudent();
      who.append(h('div', { class: 'stu', role: 'group', 'aria-label': 'Estudiante' }, act.map((s) => h('button', { class: 'stub' + (s.id === st.id ? ' on' : ''), 'aria-pressed': s.id === st.id, onclick: () => { S.sid = s.id; lsSet('sid', s.id); bump(); } }, h('span', { class: 'ini' }, initials(s.name)), h('span', { class: 'nm' }, s.name)))));
    } else if (curStudent()) who.append(h('span', { class: 'whoname' }, curStudent().name));
  }
  const ss = $('#savest'); if (ss) {
    ss.textContent = ''; ss.className = 'savest';
    if (!S.online && !LOCAL) { ss.textContent = 'Sin conexión'; ss.classList.add('bad'); }
    else if (saving.n > 0) { ss.textContent = 'Guardando…'; }
    else if (saving.err) { ss.textContent = 'No se guardó'; ss.classList.add('bad'); }
    else if (S.lastSync) { ss.textContent = 'Guardado'; ss.classList.add('ok'); }
  }
}
saveListeners.add(updateChrome);
function accountMenu() {
  sheet('Mi cuenta', (close) => [h('p', null, h('strong', null, S.me.name), h('br'), h('span', { class: 'muted' }, S.me.email || '(cuenta de demostración)')), S.me.email && !S.me.verified && !DEMO && h('p', { class: 'warnbox' }, icon('mail', 16), ' Tu correo todavía no está confirmado. ', h('a', { href: '#/ajustes', onclick: close }, 'Ir a Ajustes')),
    h('div', { class: 'stack' }, h('a', { class: 'btn block', href: '#/ajustes', onclick: close }, icon('sliders', 16), 'Ajustes'), isGuardian() && h('a', { class: 'btn block', href: '#/familia', onclick: close }, icon('users', 16), 'Familia y accesos'),
      h('button', { class: 'btn block', onclick: async () => { close(); await doLogout(); } }, icon('logout', 16), DEMO ? 'Salir de la demo' : LOCAL ? 'Bloquear Gaku' : 'Cerrar sesión'))]);
}
async function doLogout() {
  if (LOCAL) { location.reload(); return; }
  stopPolling();
  try { const j = await api('POST', 'auth/logout'); if (j?.csrf) S.csrf = j.csrf; } catch (e) { }
  S.me = S.member = S.family = null; S.recs = new Map(); S.students = []; S.since = 0; S.sid = null; bump();
  applyPrefs(); go(DEMO ? 'demo' : 'entrar');
}

/* ---------- filas reutilizables ---------- */
function statusPill(t) {
  const t0 = today();
  if (t.status === 'terminada' && t.deliver !== false && needsDelivery(t.kind || 'tarea')) return pill('Terminada · falta entregar', 'warn', 'clock');
  if (!isDoneTask(t) && taskDueDate(t) && taskDueDate(t) < t0) return pill('Atrasada', 'bad', 'alert');
  const map = { pendiente: ['', null], 'en proceso': ['info', 'play'], terminada: ['ok', 'check'], entregada: ['ok', 'check'], revisada: ['ok', 'check'] };
  const [c, i] = map[t.status] || ['', null];
  return pill(cap1(t.status || 'pendiente'), c, i);
}
function taskRow(t, opts = {}) {
  const sub = subjectOf(t.subjectId); const t0 = today(); const done = isDoneTask(t);
  const steps = t.steps || []; const sd = steps.filter((s) => s.done).length;
  const next = !done ? 'terminada' : 'pendiente';
  return h('div', { class: 'row task' + (done ? ' done' : '') },
    h('button', { class: 'tick' + (done ? ' on' : ''), 'aria-label': (done ? 'Marcar pendiente: ' : 'Marcar terminada: ') + t.title, 'aria-pressed': done, onclick: (e) => { e.stopPropagation(); put('task', { ...t, status: next, doneAt: next === 'terminada' ? Date.now() : null }); } }, done && icon('check', 14)),
    h('button', { class: 'row-main', onclick: () => openTask(t) },
      h('span', { class: 'rt' }, t.title),
      h('span', { class: 'meta' }, !opts.noSubject && subjTag(sub), t.due && h('span', { class: 'when' }, icon('clock', 12), ' ', opts.noDate ? fmtTime(taskDueTime(t)) || 'Todo el día' : `${cap1(D.rel(taskDueDate(t), t0))}${taskDueTime(t) ? ' ' + fmtTime(taskDueTime(t)) : ''}`),
        t.priority === 'alta' && pill('Alta', 'bad', 'flag'), t.estimateMin ? h('span', { class: 'when' }, `~${t.estimateMin} min`) : null, steps.length ? h('span', { class: 'when' }, `${sd}/${steps.length} pasos`) : null, statusPill(t))));
}
function examRow(e, opts = {}) {
  const sub = subjectOf(e.subjectId); const t0 = today(); const p = examProgress(e); const n = D.diff(t0, e.date);
  return h('button', { class: 'row exam', onclick: () => openExam(e) }, h('span', { class: 'ico ex' }, icon('flag', 16)),
    h('span', { class: 'row-main' }, h('span', { class: 'rt' }, `${e.kind === 'recup' ? 'Recuperatorio' : 'Examen'}: ${e.title}`),
      h('span', { class: 'meta' }, !opts.noSubject && subjTag(sub), h('span', { class: 'when' }, icon('calendar', 12), ` ${cap1(D.rel(e.date, t0))}${e.time ? ' ' + fmtTime(e.time) : ''}`), n >= 0 && n <= 14 ? pill(n === 0 ? 'Hoy' : `Faltan ${n} d`, n <= 3 ? 'warn' : '') : null, (p.sessions || p.topics) ? h('span', { class: 'when' }, `Estudio ${p.pct}%`) : null, e.grade != null ? pill('Nota ' + fmtGrade(e.grade), 'ok') : null)));
}
function classRow(oc, now) {
  const isNow = now && !oc.cancelled && oc.date === now.date && now.time >= oc.start && now.time < oc.end;
  const past = now && oc.date === now.date && now.time >= oc.end;
  return h('button', { class: 'row cls' + (isNow ? ' now' : '') + (past ? ' past' : '') + (oc.cancelled ? ' canc' : ''), onclick: () => openClass(oc), style: { '--c': colorOf(oc.sub) } },
    h('span', { class: 'ctime' }, h('b', null, fmtTime(oc.start)), h('small', null, fmtTime(oc.end))),
    h('span', { class: 'cbar' }),
    h('span', { class: 'row-main' }, h('span', { class: 'rt' }, oc.sub?.name || 'Clase'),
      h('span', { class: 'meta' }, oc.room && h('span', { class: 'when' }, icon('target', 12), ' ', oc.room), isNow && pill('Ahora', 'ok', 'play'), oc.cancelled && pill(oc.off ? oc.off.name : 'Cancelada', 'bad', 'x'), oc.moved && pill('Cambió', 'warn', 'edit'), oc.extra && pill('Extra', 'info'), oc.note && h('span', { class: 'when' }, oc.note))));
}
function matRow(x, opts = {}) {
  const { m, date, status } = x; const sub = subjectOf(m.subjectId);
  const ready = status === 'mochila' || status === 'llevado';
  const nextS = status === 'conseguir' ? 'tenemos' : status === 'tenemos' ? 'mochila' : status === 'mochila' ? 'llevado' : 'conseguir';
  return h('div', { class: 'row mat' + (ready ? ' done' : '') },
    h('button', { class: 'tick' + (ready ? ' on' : ''), 'aria-label': `${m.name}: ${MAT_LABEL[status]}. Cambiar estado`, onclick: () => setMaterialStatus(m, date, ready && status === 'mochila' ? 'tenemos' : ready ? 'conseguir' : status === 'conseguir' ? 'tenemos' : 'mochila') }, ready && icon('check', 14)),
    h('button', { class: 'row-main', onclick: () => openMaterial(m) }, h('span', { class: 'rt' }, m.name), h('span', { class: 'meta' }, !opts.noSubject && subjTag(sub), pill(MAT_LABEL[status], status === 'conseguir' ? 'warn' : 'ok', status === 'conseguir' ? 'alert' : 'check'), x.recurring && h('span', { class: 'when' }, icon('repeat', 12), ' Todas las semanas'), m.note && h('span', { class: 'when' }, m.note))),
    h('button', { class: 'btn sm', onclick: () => setMaterialStatus(m, date, nextS) }, ({ conseguir: 'Ya lo tenemos', tenemos: 'A la mochila', mochila: 'Llevado', llevado: 'Reiniciar' })[status]));
}
function sessionRow(s) {
  const sub = subjectOf(s.subjectId);
  return h('div', { class: 'row sess' + (s.done ? ' done' : '') },
    h('button', { class: 'tick' + (s.done ? ' on' : ''), 'aria-label': (s.done ? 'Desmarcar sesión: ' : 'Marcar sesión hecha: ') + s.topic, 'aria-pressed': !!s.done, onclick: () => put('session', { ...s, done: !s.done }) }, s.done && icon('check', 14)),
    h('button', { class: 'row-main', onclick: () => startFocus(s) }, h('span', { class: 'rt' }, `Estudiar: ${s.topic}`), h('span', { class: 'meta' }, subjTag(sub), h('span', { class: 'when' }, icon('clock', 12), ` ${fmtTime(s.start)}–${fmtTime(s.end)}`), !s.done && pill('Iniciar enfoque', '', 'play'))));
}
function eventRow(v) { return h('button', { class: 'row', onclick: () => openEvent(v) }, h('span', { class: 'ico' }, icon('calendar', 16)), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, v.title), h('span', { class: 'meta' }, h('span', { class: 'when' }, `${D.short(v.date)}${v.time ? ' ' + fmtTime(v.time) : ''}`), v.note && h('span', { class: 'when' }, v.note)))); }
function itemRow(it, opts = {}) {
  switch (it.kind) { case 'class': return classRow(it.c, opts.now); case 'task': return taskRow(it.t, { noDate: true, ...opts }); case 'exam': return examRow(it.e, opts); case 'material': return matRow({ m: it.m, date: it.date, status: it.m.status, recurring: false }, opts); case 'session': return sessionRow(it.s); default: return eventRow(it.v); }
}
function section(title, kids, right, cls = '') { return h('section', { class: 'sec ' + cls }, h('div', { class: 'sec-h' }, h('h2', null, title), right), kids); }

/* ---------- HOY ---------- */
VIEWS.hoy = function () {
  const st = curStudent(); const now = clock(); const t0 = now.date;
  const root = h('div', { class: 'hoy' });
  const off = offPeriod(t0);
  root.append(h('div', { class: 'page-h' }, h('div', null, h('p', { class: 'kicker' }, cap1(D.long(t0))), h('h1', null, isFamily() && isGuardian() ? `Hoy · ${st.name}` : 'Hoy')), termOf(t0) && pill(termOf(t0).name, 'info')));
  if (off) root.append(h('div', { class: 'banner' }, icon('sun', 18), h('span', null, `Hoy no hay clases: ${off.name}.`)));
  const na = nextAction(st.id);
  if (na) root.append(h('button', { class: 'next ' + na.tone, onclick: () => nextOpen(na.rec) }, h('span', { class: 'ni' }, icon(na.ic, 22)), h('span', { class: 'nb' }, h('small', null, 'Lo próximo que conviene hacer'), h('strong', null, na.title), h('span', null, na.why)), icon('chevR', 18)));
  else root.append(h('div', { class: 'next calm' }, h('span', { class: 'ni' }, icon('check', 22)), h('span', { class: 'nb' }, h('small', null, 'Lo próximo que conviene hacer'), h('strong', null, 'Nada urgente por ahora'), h('span', null, 'Aprovechá para adelantar o repasar algo.'))));
  if (isGuardian()) {
    const helps = R('help').filter((x) => !x.resolved);
    for (const hp of helps) root.append(h('div', { class: 'banner help' }, icon('help', 18), h('span', null, h('strong', null, S.members.find((m) => m.user_id === hp._by)?.name || 'Pidió ayuda'), ': ', hp.text, hp.subjectId && [' · ', subjectOf(hp.subjectId)?.name]), h('button', { class: 'btn sm', onclick: () => put('help', { ...hp, resolved: true }) }, 'Resuelto')));
  }
  // línea del día
  const items = dayItems(t0, st.id).filter((i) => i.kind !== 'material');
  const timed = items.filter((i) => i.time || i.kind === 'class'); const allday = items.filter((i) => !i.time && i.kind !== 'class');
  const tl = h('div', { class: 'timeline' });
  if (allday.length) tl.append(h('div', { class: 'allday' }, h('small', null, 'Para hoy'), allday.map((i) => itemRow(i, { now }))));
  let nowDrawn = false;
  for (const i of timed) {
    if (!nowDrawn && i.time > now.time && timed.some((x) => x.time <= now.time)) { tl.append(h('div', { class: 'nowline', 'aria-label': 'Ahora ' + fmtTime(now.time) }, h('span', null, fmtTime(now.time)))); nowDrawn = true; }
    tl.append(itemRow(i, { now }));
  }
  root.append(section('Tu día', items.length ? tl : empty(off ? 'Día libre. Disfrutalo.' : 'No hay nada cargado para hoy.', isGuardian() ? 'Cargar horario' : null, () => go('materias'), 'sun'), null, 'day'));
  // próximos
  const soon = []; const tasks = R('task', st.id).filter((t) => !isDoneTask(t) && taskDueDate(t) > t0 && D.diff(t0, taskDueDate(t)) <= 10);
  tasks.forEach((t) => soon.push({ d: taskDueDate(t) + (taskDueTime(t) || '99'), el: () => taskRow(t) }));
  R('exam', st.id).filter((e) => e.date > t0 && D.diff(t0, e.date) <= 21).forEach((e) => soon.push({ d: e.date + (e.time || '99'), el: () => examRow(e) }));
  const late = R('task', st.id).filter((t) => !isDoneTask(t) && taskDueDate(t) && taskDueDate(t) < t0);
  const delivery = R('task', st.id).filter((t) => t.status === 'terminada' && t.deliver !== false && needsDelivery(t.kind || 'tarea'));
  const sub = [];
  if (late.length) sub.push(h('div', { class: 'grp' }, h('small', { class: 'bad-t' }, 'Atrasadas'), late.map((t) => taskRow(t))));
  if (delivery.length) sub.push(h('div', { class: 'grp' }, h('small', null, 'Terminadas, falta entregar'), delivery.map((t) => taskRow(t))));
  soon.sort(by((x) => x.d));
  if (soon.length) sub.push(h('div', { class: 'grp' }, h('small', null, 'Próximos días'), soon.slice(0, 8).map((x) => x.el())));
  root.append(section('Para entregar y rendir', sub.length ? sub : h('p', { class: 'muted' }, 'Sin entregas ni exámenes cerca.'), h('a', { href: '#/agenda', class: 'lnk' }, 'Ver agenda')));
  root.append(prepSection(st));
  root.append(quickNotes(st));
  return root;
};
function nextOpen(rec) {
  if (rec._type === 'task') openTask(rec); else if (rec._type === 'exam') openExam(rec); else if (rec._type === 'material') openMaterial(rec); else if (rec._type === 'session') startFocus(rec);
}
function prepSection(st) {
  const p = prepTomorrow(st.id); const hasAny = p.classes.length || p.mats.length || p.tasks.length || p.exams.length;
  const body = h('div', { class: 'prep-b' });
  if (p.off) body.append(h('p', { class: 'muted' }, `Mañana no hay clases: ${p.off.name}.`));
  if (p.classes.length) body.append(h('div', { class: 'grp' }, h('small', null, `Mañana, ${D.long(p.date)}: ${plural(p.classes.length, 'clase', 'clases')}`), h('p', { class: 'chipline' }, p.classes.map((c) => h('span', { class: 'stag' }, h('i', { style: { background: colorOf(c.sub) } }), `${fmtTime(c.start)} ${c.sub?.name || 'Clase'}`)))));
  if (p.mats.length) body.append(h('div', { class: 'grp' }, h('small', null, 'Qué llevar'), p.mats.map((x) => matRow(x, { noSubject: false }))));
  if (p.tasks.length) body.append(h('div', { class: 'grp' }, h('small', null, 'Para entregar mañana'), p.tasks.map((t) => taskRow(t))));
  if (p.exams.length) body.append(h('div', { class: 'grp' }, h('small', null, 'Exámenes cerca'), p.exams.map((e) => examRow(e))));
  const ready = p.mats.length > 0 && p.mats.every((x) => isReadyMat({ status: x.status }));
  return section('Preparar para mañana', hasAny ? body : h('p', { class: 'muted' }, 'Todo en orden para mañana.'), [ready && pill('Mochila lista', 'ok', 'check'), h('button', { class: 'btn sm', onclick: () => openMaterial(null, { needDate: p.date }) }, icon('plus', 14), 'Material')], 'prep');
}
function quickNotes(st) {
  const inp = h('input', { type: 'text', 'aria-label': 'Nota rápida', placeholder: 'Nota rápida: escribí y Enter…', maxlength: 300, onkeydown: async (e) => { if (e.key === 'Enter' && inp.value.trim()) { const txt = inp.value.trim(); inp.value = ''; await put('note', { title: txt.slice(0, 60), html: '<p>' + esc(txt) + '</p>', quick: true, tags: [] }, { vis: isGuardian() ? 'family' : 'private' }); toast('Nota guardada'); } } });
  const last = R('note', st.id).filter((n) => n.quick).sort(by((n) => n._upd, -1)).slice(0, 3);
  return section('Notas rápidas', [h('div', { class: 'qn' }, inp), last.map((n) => h('button', { class: 'row', onclick: () => go('apuntes/' + n.id) }, h('span', { class: 'ico' }, icon('note', 16)), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, n.title))))]);
}

/* ---------- AGENDA ---------- */
const agendaState = { mode: 'week', sel: null, anchor: null };
VIEWS.agenda = function () {
  const A = agendaState; const t0 = today(); const ws = S.me.settings.weekStart ?? 1; const st = curStudent();
  if (!A.sel) A.sel = t0; if (!A.anchor) A.anchor = t0;
  const mv = (n) => { A.anchor = A.mode === 'month' ? D.addMonths(A.anchor, n) : D.add(A.anchor, n * (A.mode === 'day' ? 1 : A.mode === 'week' ? 7 : 14)); if (A.mode === 'day') A.sel = A.anchor; refresh(); };
  const root = h('div', { class: 'agenda' });
  const title = A.mode === 'month' ? cap1(D.month(A.anchor)) : A.mode === 'day' ? cap1(D.long(A.anchor)) : A.mode === 'week' ? `${D.short(D.weekStart(A.anchor, ws))} – ${D.short(D.add(D.weekStart(A.anchor, ws), 6))}` : 'Próximos 14 días';
  root.append(h('div', { class: 'page-h' }, h('h1', null, 'Agenda'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Vista' }, [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['list', 'Lista']].map(([k, l]) => h('button', { class: A.mode === k ? 'on' : '', 'aria-pressed': A.mode === k, onclick: () => { A.mode = k; if (k === 'day') A.anchor = A.sel; refresh(); } }, l)))));
  root.append(h('div', { class: 'ag-nav' }, ib('chevL', 'Anterior', () => mv(-1)), h('strong', { class: 'ag-title', 'aria-live': 'polite' }, title), ib('chevR', 'Siguiente', () => mv(1)), h('button', { class: 'btn sm', onclick: () => { A.anchor = A.sel = t0; refresh(); } }, 'Hoy')));
  const dayBlock = (d, compact) => {
    const off = offPeriod(d); const items = dayItems(d, st.id);
    return h('div', { class: 'daybox' + (d === t0 ? ' today' : '') + (d === A.sel ? ' sel' : '') },
      h('button', { class: 'dayh', onclick: () => { A.sel = d; if (A.mode !== 'week' && A.mode !== 'list') A.anchor = d; refresh(); } }, h('b', null, compact ? DOWS[D.dow(d)] : cap1(D.long(d))), compact && h('span', null, D.parse(d).getDate()), off && pill(off.name, 'info')),
      items.length ? items.map((i) => itemRow(i, { now: d === t0 ? clock() : null, noSubject: false })) : h('p', { class: 'muted small' }, off ? 'Sin clases' : 'Nada cargado'),
      h('button', { class: 'btn ghost sm', onclick: () => quickAdd({ date: d }) }, icon('plus', 14), 'Agregar'));
  };
  if (A.mode === 'day') root.append(dayBlock(A.anchor, false));
  else if (A.mode === 'week') { const w = D.weekStart(A.anchor, ws); root.append(h('div', { class: 'weekgrid' }, [0, 1, 2, 3, 4, 5, 6].map((i) => dayBlock(D.add(w, i), true)))); }
  else if (A.mode === 'month') {
    const first = D.monthStart(A.anchor); const gs = D.weekStart(first, ws); const nd = D.daysIn(first);
    const cells = Math.ceil(((D.diff(gs, first)) + nd) / 7) * 7;
    const grid = h('div', { class: 'mgrid', role: 'grid', 'aria-label': D.month(A.anchor) });
    for (let i = 0; i < 7; i++) grid.append(h('div', { class: 'mh', role: 'columnheader' }, DOWS[(ws + i) % 7]));
    for (let i = 0; i < cells; i++) {
      const d = D.add(gs, i); const inM = d.slice(0, 7) === first.slice(0, 7); const its = dayItems(d, st.id); const off = offPeriod(d);
      const nT = its.filter((x) => x.kind === 'task').length, nE = its.filter((x) => x.kind === 'exam').length, nC = its.filter((x) => x.kind === 'class').length;
      grid.append(h('button', { class: 'mc' + (inM ? '' : ' out') + (d === t0 ? ' today' : '') + (d === A.sel ? ' sel' : '') + (off ? ' off' : ''), role: 'gridcell', 'aria-label': `${D.long(d)}: ${nC} clases, ${nT} tareas, ${nE} exámenes`, onclick: () => { A.sel = d; refresh(); } },
        h('b', null, D.parse(d).getDate()), h('span', { class: 'dots' }, nC > 0 && h('i', { class: 'c' }), nT > 0 && h('i', { class: 't' }, nT > 1 ? nT : ''), nE > 0 && h('i', { class: 'e' }, '!'))));
    }
    root.append(h('div', { class: 'split' }, h('div', null, grid, h('p', { class: 'legend' }, h('i', { class: 'c' }), ' clases ', h('i', { class: 't' }), ' tareas ', h('i', { class: 'e' }, '!'), ' exámenes')), h('div', { class: 'daypanel' }, dayBlock(A.sel, false))));
  } else {
    const list = h('div', { class: 'listv' }); let n = 0;
    for (let i = 0; i < 30; i++) { const d = D.add(A.anchor, i); const its = dayItems(d, st.id).filter((x) => x.kind !== 'class'); if (!its.length) continue; n++; list.append(h('div', { class: 'grp' }, h('small', null, cap1(D.long(d)) + (d === t0 ? ' · hoy' : '')), its.map((x) => itemRow(x)))); }
    root.append(n ? list : empty('No hay tareas, exámenes ni eventos en los próximos 30 días.', 'Agregar', () => quickAdd({})));
  }
  return root;
};

'use strict';
/* ===== Materias, docentes, calendario académico, notas y materiales ===== */
function nextClassOf(subjectId, sid) {
  const c = clock();
  for (let i = 0; i < 21; i++) { const d = D.add(c.date, i); const oc = classesActive(d, sid).find((o) => o.sub?.id === subjectId && (i > 0 || o.end > c.time)); if (oc) return oc; }
  return null;
}
const SUB_TABS = [['resumen', 'Resumen'], ['clases', 'Clases'], ['tareas', 'Tareas'], ['examenes', 'Exámenes'], ['apuntes', 'Apuntes'], ['material', 'Material'], ['notas', 'Notas']];

VIEWS.materias = function (id, tab = 'resumen') {
  const subs = R('subject').sort(by((s) => norm(s.name)));
  const sel = id ? get(id) : null;
  const list = h('div', { class: 'master' }, h('div', { class: 'page-h' }, h('h1', null, 'Materias'), isGuardian() && h('button', { class: 'btn primary sm', onclick: () => openSubject(null) }, icon('plus', 16), 'Nueva')));
  if (!subs.length) list.append(empty(isGuardian() ? 'Todavía no hay materias. Empezá creando la primera.' : 'Tu familia todavía no cargó materias.', isGuardian() ? 'Crear materia' : null, () => openSubject(null), 'book'));
  for (const s of subs) {
    const nc = nextClassOf(s.id, s._sid ?? curStudent().id); const t = teacherOf(s.teacherId);
    const pend = R('task').filter((x) => x.subjectId === s.id && !isDoneTask(x)).length;
    list.append(h('a', { class: 'scard' + (sel && sel.id === s.id ? ' on' : ''), href: '#/materias/' + s.id, style: { '--c': colorOf(s) } }, h('span', { class: 'cbar' }),
      h('span', { class: 'sc-b' }, h('strong', null, s.name), h('small', null, t ? t.name : 'Sin docente asignado'), h('small', null, nc ? `Próxima: ${cap1(D.rel(nc.date, today()))} ${fmtTime(nc.start)}` : 'Sin clases próximas')), pend > 0 && pill(plural(pend, 'tarea', 'tareas'), 'info')));
  }
  list.append(teachersBlock());
  const detail = h('div', { class: 'detail' });
  if (sel) detail.append(subjectDetail(sel, tab)); else detail.append(h('div', { class: 'empty big' }, icon('book', 32), h('p', null, 'Elegí una materia para ver sus clases, tareas, exámenes y apuntes.')));
  return h('div', { class: 'md' }, list, detail);
};
function teachersBlock() {
  const ts = R('teacher').sort(by((t) => norm(t.name)));
  return section('Docentes', ts.length ? ts.map((t) => h('button', { class: 'row', onclick: () => isGuardian() ? openTeacher(t) : null }, h('span', { class: 'ico' }, icon('user', 16)), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, t.name), h('span', { class: 'meta' }, R('subject').filter((s) => s.teacherId === t.id).map((s) => subjTag(s)), t.email && h('span', { class: 'when' }, t.email))))) : h('p', { class: 'muted' }, 'Sin docentes cargados.'), isGuardian() && h('button', { class: 'btn sm', onclick: () => openTeacher(null) }, icon('plus', 14), 'Docente'));
}
function subjectDetail(s, tab) {
  const wrap = h('div', { class: 'sd', style: { '--c': colorOf(s) } });
  wrap.append(h('div', { class: 'sd-h' }, h('a', { class: 'ib back', href: '#/materias', 'aria-label': 'Volver a materias' }, icon('chevL')), h('span', { class: 'cbar big' }), h('div', null, h('h1', null, s.name), h('p', { class: 'muted' }, teacherOf(s.teacherId)?.name || 'Sin docente')), h('span', { class: 'sp' }), isGuardian() && ib('edit', 'Editar materia', () => openSubject(s)), h('button', { class: 'btn primary sm', onclick: () => quickAdd({ subjectId: s.id }) }, icon('plus', 16), 'Agregar')));
  wrap.append(h('div', { class: 'tabs', role: 'tablist' }, SUB_TABS.map(([k, l]) => h('a', { href: `#/materias/${s.id}/${k}`, role: 'tab', 'aria-selected': tab === k, class: tab === k ? 'on' : '' }, l))));
  const body = h('div', { class: 'tab-b', role: 'tabpanel' });
  const sid = curStudent().id;
  if (tab === 'resumen') {
    const nc = nextClassOf(s.id, sid); const tasks = R('task').filter((t) => t.subjectId === s.id && !isDoneTask(t)).sort(by((t) => t.due || '9')); const ex = R('exam').filter((e) => e.subjectId === s.id && e.date >= today()).sort(by((e) => e.date)); const avg = subjectAverage(s.id);
    body.append(h('div', { class: 'facts' }, fact('Próxima clase', nc ? `${cap1(D.rel(nc.date, today()))} · ${fmtTime(nc.start)}${nc.room ? ' · ' + nc.room : ''}` : 'Sin clases próximas'), fact('Aula habitual', s.room || '—'), fact('Promedio', avg ? `${fmtGrade(avg.avg)} · ${avg.pass ? 'Aprobando' : 'Por debajo del mínimo'}` : 'Sin notas todavía'), fact('Pendientes', plural(tasks.length, 'tarea', 'tareas'))));
    body.append(section('Tareas pendientes', tasks.length ? tasks.slice(0, 5).map((t) => taskRow(t, { noSubject: true })) : h('p', { class: 'muted' }, 'Sin tareas pendientes.')));
    body.append(section('Próximos exámenes', ex.length ? ex.map((e) => examRow(e, { noSubject: true })) : h('p', { class: 'muted' }, 'Sin exámenes próximos.')));
    if (s.notes) body.append(section('Notas de la materia', h('p', null, s.notes)));
  } else if (tab === 'clases') {
    const sl = R('slot').filter((x) => x.subjectId === s.id).sort(by((x) => ((x.dow + 6) % 7) * 2400 + mins(x.start)));
    body.append(section('Horario semanal', sl.length ? sl.map((x) => h('button', { class: 'row', onclick: () => isGuardian() && openSlot(x) }, h('span', { class: 'ctime' }, h('b', null, DOWS[x.dow]), h('small', null, fmtTime(x.start))), h('span', { class: 'cbar' }), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, `${fmtTime(x.start)} – ${fmtTime(x.end)}`), h('span', { class: 'meta' }, x.room && h('span', { class: 'when' }, x.room), x.recur === 'biweekly' && pill('Semana por medio', 'info', 'repeat'), x.from && h('span', { class: 'when' }, 'desde ' + D.short(x.from)), x.to && h('span', { class: 'when' }, 'hasta ' + D.short(x.to)))))) : h('p', { class: 'muted' }, 'Sin horario cargado.'), isGuardian() && h('button', { class: 'btn sm', onclick: () => openSlot(null, { subjectId: s.id }) }, icon('plus', 14), 'Clase')));
    const ids = new Set(sl.map((x) => x.id)); const chg = R('exception').filter((e) => (ids.has(e.slotId) || e.subjectId === s.id) && e.date >= today()).sort(by((e) => e.date));
    if (chg.length) body.append(section('Cambios próximos', chg.map((e) => h('div', { class: 'row' }, h('span', { class: 'ico' }, icon(e.kind === 'cancel' ? 'x' : 'edit', 16)), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, `${D.long(e.date)} · ${e.kind === 'cancel' ? 'Clase cancelada' : e.kind === 'add' ? 'Clase extra' : 'Clase modificada'}`), h('span', { class: 'meta' }, e.kind !== 'cancel' && h('span', { class: 'when' }, `${fmtTime(e.start)}–${fmtTime(e.end)} ${e.room || ''}`), e.note && h('span', { class: 'when' }, e.note)))), isGuardian() && ib('x', 'Quitar este cambio', () => del(e.id)))));
  } else if (tab === 'tareas') {
    const all = R('task').filter((t) => t.subjectId === s.id).sort(by((t) => (isDoneTask(t) ? '1' : '0') + (t.due || '9')));
    body.append(all.length ? all.map((t) => taskRow(t, { noSubject: true })) : empty('Sin tareas en esta materia.', 'Nueva tarea', () => openTask(null, { subjectId: s.id })));
  } else if (tab === 'examenes') {
    const ex = R('exam').filter((e) => e.subjectId === s.id).sort(by((e) => e.date, -1));
    body.append(ex.length ? ex.map((e) => examRow(e, { noSubject: true })) : empty('Sin exámenes cargados.', isGuardian() ? 'Nuevo examen' : null, () => openExam(null, { subjectId: s.id }), 'flag'));
  } else if (tab === 'apuntes') {
    const ns = R('note').filter((n) => n.subjectId === s.id).sort(by((n) => n._upd, -1));
    body.append(ns.length ? ns.map(noteRow) : empty('Sin apuntes en esta materia.', 'Nuevo apunte', () => openNote(null, { subjectId: s.id }), 'note'));
  } else if (tab === 'material') {
    const ms = R('material').filter((m) => m.subjectId === s.id);
    body.append(ms.length ? ms.map((m) => { const date = m.recur === 'weekly' ? nextDow(Number(m.dow)) : m.needDate; return matRow({ m, date, status: m.recur === 'weekly' ? ((m.log || []).find((l) => l.date === date)?.s || 'conseguir') : m.status, recurring: m.recur === 'weekly' }, { noSubject: true }); }) : empty('Sin materiales para esta materia.', 'Agregar material', () => openMaterial(null, { subjectId: s.id }), 'bag'));
  } else if (tab === 'notas') body.append(gradesFor(s));
  wrap.append(body);
  return wrap;
}
const nextDow = (dow) => { let d = today(); while (D.dow(d) !== dow) d = D.add(d, 1); return d; };
function fact(l, v) { return h('div', { class: 'fact' }, h('small', null, l), h('strong', null, v)); }
function gradesFor(s, termId) {
  const a = subjectAverage(s.id, termId); const sc = scale();
  if (!a) return empty('Todavía no hay notas cargadas. Cargalas en cada examen o tarea.', null, null, 'cap');
  const pct = Math.max(0, Math.min(100, ((a.avg - sc.min) / (sc.max - sc.min)) * 100)); const pp = ((sc.pass - sc.min) / (sc.max - sc.min)) * 100;
  return h('div', { class: 'grades' },
    h('div', { class: 'avg' }, h('span', { class: 'avg-n' }, fmtGrade(a.avg)), h('span', null, a.pass ? pill('Aprobando', 'ok', 'check') : pill('Por debajo del mínimo (' + fmtGrade(sc.pass) + ')', 'bad', 'alert'))),
    h('div', { class: 'gbar', role: 'img', 'aria-label': `Promedio ${fmtGrade(a.avg)} de ${sc.max}; mínimo para aprobar ${fmtGrade(sc.pass)}` }, h('i', { style: { width: pct + '%' }, class: a.pass ? 'ok' : 'bad' }), h('b', { style: { left: pp + '%' }, title: 'Mínimo' })),
    h('p', { class: 'muted' }, a.expl), h('ul', { class: 'glist' }, a.items.map((i) => h('li', null, h('span', null, i.label, i.note && h('small', null, ' · ' + i.note)), h('span', null, `${fmtGrade(i.g)}  (peso ${i.w})`)))));
}

/* ---------- Calendario académico ---------- */
VIEWS.calendario = function () {
  const ps = R('period', null).sort(by((p) => p.from)); const t0 = today();
  const grp = { 'Vigentes y próximos': ps.filter((p) => !p.archived && (p.to || p.from) >= t0), 'Ya pasaron': ps.filter((p) => !p.archived && (p.to || p.from) < t0), Archivados: ps.filter((p) => p.archived) };
  const root = h('div', { class: 'page' }, h('div', { class: 'page-h' }, h('h1', null, 'Calendario académico'), isGuardian() && h('button', { class: 'btn primary sm', onclick: () => openPeriod(null) }, icon('plus', 16), 'Agregar')));
  root.append(h('p', { class: 'muted' }, 'Períodos, vacaciones, feriados e inscripciones. Los días de vacaciones y feriados no muestran clases en la agenda. Al terminar un período podés archivarlo y sus notas se conservan.'));
  for (const [k, arr] of Object.entries(grp)) if (arr.length) root.append(section(k, arr.map((p) => h('button', { class: 'row', onclick: () => isGuardian() && openPeriod(p) }, h('span', { class: 'ico' }, icon(p.kind === 'vacaciones' ? 'sun' : p.kind === 'periodo' ? 'calendar' : 'flag', 16)), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, p.name), h('span', { class: 'meta' }, pill(PERIOD_KINDS.find((x) => x[0] === p.kind)?.[1].split(' (')[0] || p.kind), h('span', { class: 'when' }, `${D.short(p.from)}${p.to ? ' → ' + D.short(p.to) : ''}`))), isGuardian() && !p.archived && h('span', { class: 'btn sm', role: 'button', tabindex: 0, onclick: (e) => { e.stopPropagation(); put('period', { ...p, archived: true }, { sid: null }); toast('Archivado'); } }, 'Archivar')))));
  if (!ps.length) root.append(empty('Todavía no cargaste períodos ni vacaciones.', isGuardian() ? 'Agregar el primero' : null, () => openPeriod(null), 'calendar'));
  return root;
};

/* ---------- Notas y promedios ---------- */
VIEWS.notas = function () {
  const subs = R('subject').sort(by((s) => norm(s.name))); const terms = R('period', null).filter((p) => p.kind === 'periodo');
  const st = { term: '' };
  const box = h('div');
  const paint = () => {
    clear(box);
    const avgs = subs.map((s) => ({ s, a: subjectAverage(s.id, st.term) })).filter((x) => x.a);
    if (avgs.length) { const g = avgs.reduce((a, b) => a + b.a.avg, 0) / avgs.length; box.append(h('div', { class: 'facts' }, fact('Promedio general', fmtGrade(g)), fact('Materias con nota', `${avgs.length} de ${subs.length}`), fact('Por debajo del mínimo', String(avgs.filter((x) => !x.a.pass).length)))); }
    for (const s of subs) box.append(section(s.name, gradesFor(s, st.term), h('a', { href: '#/materias/' + s.id + '/notas', class: 'lnk' }, 'Abrir'), 'g'));
    if (!subs.length) box.append(empty('Cuando haya materias y notas, acá vas a ver los promedios explicados.', null, null, 'cap'));
  };
  paint();
  const sc = scale();
  return h('div', { class: 'page' }, h('div', { class: 'page-h' }, h('h1', null, 'Notas y promedios'), terms.length > 0 && h('select', { 'aria-label': 'Período', onchange: (e) => { st.term = e.target.value; paint(); } }, [['', 'Todo el año'], ...terms.map((t) => [t.id, t.name])].map(([v, l]) => h('option', { value: v }, l)))),
    h('p', { class: 'muted' }, `Escala: ${fmtGrade(sc.min)} a ${fmtGrade(sc.max)} · aprueba desde ${fmtGrade(sc.pass)}. ${isGuardian() ? 'Se puede cambiar en Ajustes.' : ''}`), box);
};

/* ---------- Qué llevar ---------- */
VIEWS.materiales = function () {
  const st = curStudent(); const t0 = today(); const root = h('div', { class: 'page' });
  root.append(h('div', { class: 'page-h' }, h('h1', null, 'Qué llevar'), h('button', { class: 'btn primary sm', onclick: () => openMaterial(null) }, icon('plus', 16), 'Material')));
  root.append(h('p', { class: 'muted' }, 'Cada cosa pasa por: hay que conseguirla → la tenemos → en la mochila → llevada. Los recordatorios por correo dejan de avisar cuando ya está lista.'));
  let any = false;
  for (let i = 0; i < 8; i++) {
    const d = D.add(t0, i); const ms = materialsFor(d, st.id); if (!ms.length) continue; any = true;
    root.append(section(cap1(D.rel(d, t0)) + ' · ' + D.long(d), ms.map((x) => matRow(x))));
  }
  const free = R('material').filter((m) => m.recur !== 'weekly' && m.needDate && m.needDate > D.add(t0, 7));
  if (free.length) { any = true; root.append(section('Más adelante', free.sort(by((m) => m.needDate)).map((m) => matRow({ m, date: m.needDate, status: m.status })))); }
  const nodate = R('material').filter((m) => m.recur !== 'weekly' && !m.needDate); if (nodate.length) { any = true; root.append(section('Sin fecha', nodate.map((m) => matRow({ m, date: today(), status: m.status })))); }
  if (!any) root.append(empty('No hay materiales cargados. Agregá lo que haya que llevar (por ejemplo “todos los miércoles: ropa de gimnasia”).', 'Agregar material', () => openMaterial(null), 'bag'));
  return root;
};

'use strict';
/* ===== Apuntes ===== */
window.NOTE_EDITING = false;
const noteSnippet = (n) => htmlText(n.html).slice(0, 110);
function noteRow(n) {
  const sub = subjectOf(n.subjectId); const ex = n.examId ? get(n.examId) : null;
  return h('a', { class: 'row note', href: '#/apuntes/' + n.id }, h('span', { class: 'ico' }, icon(n.fav ? 'star' : 'note', 16)),
    h('span', { class: 'row-main' }, h('span', { class: 'rt' }, n.title || 'Sin título'), h('span', { class: 'snip' }, noteSnippet(n)),
      h('span', { class: 'meta' }, subjTag(sub), ex && pill(ex.title, 'warn', 'flag'), n.date && h('span', { class: 'when' }, icon('calendar', 12), ' ' + D.short(n.date)), n._vis === 'private' && pill('Privado', '', 'lock'), (n.tags || []).map((t) => h('span', { class: 'tag' }, '#' + t)))));
}
async function openNote(n, defaults = {}) {
  if (n) { go('apuntes/' + n.id); return; }
  const nn = await put('note', { title: defaults.title || '', html: '', subjectId: defaults.subjectId || '', date: defaults.date || '', slotId: defaults.slotId || '', examId: defaults.examId || '', topic: defaults.topic || '', tags: [], fav: false, files: [], links: [], fresh: true }, { vis: isGuardian() ? 'family' : 'private' });
  go('apuntes/' + nn.id);
}
const noteFilter = { q: '', subject: '', fav: false };
VIEWS.apuntes = function (id) {
  const sel = id ? get(id) : null;
  const all = R('note').sort(by((n) => n._upd, -1));
  const list = h('div', { class: 'master' });
  const results = h('div', { class: 'results' });
  const paint = () => {
    clear(results);
    const q = norm(noteFilter.q);
    const arr = all.filter((n) => (!noteFilter.subject || n.subjectId === noteFilter.subject) && (!noteFilter.fav || n.fav) && (!q || norm([n.title, htmlText(n.html), (n.tags || []).join(' ')].join(' ')).includes(q)));
    if (arr.length) results.append(arr.map((n) => { const r = noteRow(n); if (sel && sel.id === n.id) r.classList.add('on'); return r; }));
    else results.append(empty(all.length ? 'Ningún apunte coincide con la búsqueda.' : 'Todavía no hay apuntes. Escribí el primero.', all.length ? null : 'Nuevo apunte', () => openNote(null, {}), 'note'));
  };
  list.append(h('div', { class: 'page-h' }, h('h1', null, 'Apuntes'), h('button', { class: 'btn primary sm', onclick: () => openNote(null, {}) }, icon('plus', 16), 'Nuevo')));
  list.append(h('div', { class: 'filters' },
    h('input', { type: 'search', 'aria-label': 'Buscar en apuntes', placeholder: 'Buscar en apuntes…', value: noteFilter.q, oninput: (e) => { noteFilter.q = e.target.value; paint(); } }),
    h('select', { 'aria-label': 'Filtrar por materia', onchange: (e) => { noteFilter.subject = e.target.value; paint(); } }, subjOpts('Todas las materias').map(([v, l]) => h('option', { value: v, selected: v === noteFilter.subject }, l))),
    h('button', { class: 'chip' + (noteFilter.fav ? ' on' : ''), 'aria-pressed': noteFilter.fav, onclick: (e) => { noteFilter.fav = !noteFilter.fav; e.currentTarget.classList.toggle('on', noteFilter.fav); e.currentTarget.setAttribute('aria-pressed', noteFilter.fav); paint(); } }, icon('star', 14), 'Favoritos')));
  list.append(results); paint();
  const detail = h('div', { class: 'detail' });
  if (id && !sel) detail.append(empty('Este apunte no existe o no tenés acceso.', 'Volver', () => go('apuntes')));
  else if (sel) detail.append(noteEditor(sel)); else detail.append(h('div', { class: 'empty big' }, icon('note', 32), h('p', null, 'Elegí un apunte o creá uno nuevo.')));
  return h('div', { class: 'md' }, list, detail);
};

function noteEditor(n0) {
  let n = { ...n0 };
  const mine = isGuardian() || n._by === myUid();
  const status = h('span', { class: 'savest', 'aria-live': 'polite' }, 'Guardado');
  const setSt = (t, c = '') => { status.textContent = t; status.className = 'savest ' + c; };
  const ed = h('div', { class: 'editor', contenteditable: mine ? 'true' : 'false', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Contenido del apunte', spellcheck: 'true' });
  ed.innerHTML = sanitize(n.html) || (mine ? '<p><br></p>' : '');
  let dirty = false;
  const doSave = async () => {
    if (!mine || !dirty) { window.NOTE_EDITING = document.activeElement === ed; return; }
    dirty = false; setSt('Guardando…');
    try { n.html = sanitize(ed.innerHTML); n.fresh = false; const r = await put('note', n); n._upd = r._upd; setSt('Guardado', 'ok'); } catch (e) { dirty = true; setSt('No se guardó. Reintento…', 'bad'); setTimeout(doSave, 4000); }
    window.NOTE_EDITING = document.activeElement === ed;
  };
  const save = debounce(doSave, 900);
  const touch = () => { dirty = true; window.NOTE_EDITING = true; setSt('Sin guardar…'); save(); };
  ed.addEventListener('input', touch);
  ed.addEventListener('focus', () => { window.NOTE_EDITING = true; });
  ed.addEventListener('blur', () => { save.cancel(); doSave(); });
  ed.addEventListener('paste', (e) => { e.preventDefault(); const t = e.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); });
  ed.addEventListener('click', (e) => { const el = e.target; if (el.classList && el.classList.contains('ck') && e.offsetX < 34) { el.classList.toggle('done'); touch(); } if (el.tagName === 'A') { e.preventDefault(); window.open(el.href, '_blank', 'noopener'); } });
  const fmt = (cmd, arg) => () => { ed.focus(); document.execCommand(cmd, false, arg); touch(); };
  const tb = (ic, label, fn, txt) => h('button', { type: 'button', class: 'tbtn', 'aria-label': label, title: label, onmousedown: (e) => e.preventDefault(), onclick: fn }, txt || icon(ic, 16));
  const updMeta = (patch) => { n = { ...n, ...patch }; dirty = true; doSave().then(() => { if (!sheetOpen()) refresh(); }); };
  const titleIn = h('input', { class: 'title-in', type: 'text', value: n.title || '', placeholder: 'Título del apunte', 'aria-label': 'Título', maxlength: 120, disabled: !mine, oninput: (e) => { n.title = e.target.value; touch(); } });
  if (n0.fresh && mine) setTimeout(() => titleIn.focus(), 60);
  const exams = R('exam').filter((e) => !n.subjectId || e.subjectId === n.subjectId);
  const metaRow = h('div', { class: 'nmeta' },
    h('label', null, 'Materia', h('select', { disabled: !mine, onchange: (e) => updMeta({ subjectId: e.target.value, examId: '' }) }, subjOpts().map(([v, l]) => h('option', { value: v, selected: v === (n.subjectId || '') }, l)))),
    h('label', null, 'Examen', h('select', { disabled: !mine, onchange: (e) => updMeta({ examId: e.target.value }) }, [['', 'Ninguno'], ...exams.map((x) => [x.id, x.title])].map(([v, l]) => h('option', { value: v, selected: v === (n.examId || '') }, l)))),
    h('label', null, 'Clase del día', h('input', { type: 'date', disabled: !mine, value: n.date || '', onchange: (e) => updMeta({ date: e.target.value }) })),
    h('label', null, 'Tema', h('input', { type: 'text', disabled: !mine, value: n.topic || '', placeholder: 'Ej.: Funciones lineales', maxlength: 80, onchange: (e) => updMeta({ topic: e.target.value }) })));
  const tagsBox = h('div', { class: 'tags' });
  const paintTags = () => { clear(tagsBox); (n.tags || []).forEach((t) => tagsBox.append(h('span', { class: 'tag' }, '#' + t, mine && h('button', { class: 'ib xs', 'aria-label': 'Quitar etiqueta ' + t, onclick: () => { n.tags = n.tags.filter((x) => x !== t); paintTags(); touch(); } }, icon('x', 12))))); if (mine) tagsBox.append(h('input', { type: 'text', placeholder: '+ etiqueta', 'aria-label': 'Nueva etiqueta', maxlength: 24, onkeydown: (e) => { if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) { e.preventDefault(); n.tags = [...new Set([...(n.tags || []), e.target.value.trim().replace(/^#/, '').toLowerCase()])].slice(0, 12); paintTags(); touch(); } } })); };
  paintTags();
  const selText = () => { const s = window.getSelection(); return s && ed.contains(s.anchorNode) ? s.toString().trim() : ''; };
  const act = (label, ic, fn) => h('button', { type: 'button', class: 'btn sm', onmousedown: (e) => e.preventDefault(), onclick: () => { const t = selText(); fn(t); } }, icon(ic, 14), label);
  const base = () => ({ subjectId: n.subjectId || '', extra: { fromNote: n.id } });
  const actions = h('div', { class: 'nacts' }, h('small', null, 'Convertir selección en…'),
    act('Tarea', 'check', (t) => openTask(null, { title: t || n.title, subjectId: n.subjectId, extra: { fromNote: n.id } })),
    act('Recordatorio', 'bell', (t) => openEvent(null, { date: today(), title: t || n.title, extra: { fromNote: n.id, title: t || n.title, subjectId: n.subjectId } })),
    act('Tema de estudio', 'target', (t) => topicFromNote(n, t || n.topic || n.title)),
    act('Pregunta al docente', 'help', (t) => openQuestion(null, { text: t, subjectId: n.subjectId, noteId: n.id })),
    act('Tarjeta de repaso', 'copy', (t) => cardFromNote(n, t)));
  const made = [...R('task'), ...R('event'), ...R('question'), ...R('quiz')].filter((x) => x.fromNote === n.id || x.noteId === n.id);
  const madeBox = made.length ? h('div', { class: 'made' }, h('small', null, 'Creado desde este apunte'), made.map((x) => h('button', { class: 'chip', onclick: () => ({ task: openTask, event: openEvent, question: openQuestion, quiz: () => go('estudio') })[x._type](x) }, icon(x._type === 'task' ? 'check' : x._type === 'event' ? 'bell' : x._type === 'question' ? 'help' : 'copy', 12), x.title || x.text || x.q))) : null;
  const linksBox = h('div', { class: 'nlinks' });
  const paintLinks = () => { clear(linksBox); (n.links || []).forEach((l) => linksBox.append(h('span', { class: 'chip' }, icon('link', 12), h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.t || l.url), mine && h('button', { class: 'ib xs', 'aria-label': 'Quitar enlace', onclick: () => { n.links = n.links.filter((x) => x !== l); paintLinks(); touch(); } }, icon('x', 12))))); (n.files || []).forEach((f) => linksBox.append(h('span', { class: 'chip' }, icon('clip', 12), h('a', { href: 'api.php?r=files/' + f.id, target: '_blank', rel: 'noopener' }, f.name), mine && h('button', { class: 'ib xs', 'aria-label': 'Quitar archivo', onclick: () => { n.files = n.files.filter((x) => x !== f); paintLinks(); touch(); } }, icon('x', 12))))); };
  paintLinks();
  const addLink = () => editSheet('Agregar enlace', [{ k: 't', label: 'Título', placeholder: 'Ej.: Video explicativo' }, { k: 'url', label: 'Dirección', type: 'url', required: true, placeholder: 'https://…' }], { t: '', url: '' }, { onSave: (v) => { if (!/^https?:\/\//i.test(v.url)) { toast('La dirección debe empezar con http:// o https://', 'bad'); return false; } n.links = [...(n.links || []), { t: v.t, url: v.url }]; paintLinks(); touch(); } });
  const attach = NOSRV ? null : (() => { const inp = h('input', { type: 'file', hidden: true, accept: 'image/*,.pdf,.txt,.docx,.xlsx,.pptx', onchange: async (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { toast('El archivo supera los 5 MB', 'bad'); return; } const fd = new FormData(); fd.append('file', f); if (n._sid) fd.append('student_id', n._sid); try { const r = await api('POST', 'files', fd); n.files = [...(n.files || []), { id: r.file.id, name: r.file.name }]; paintLinks(); touch(); } catch (er) { toast(er.message, 'bad'); } } }); return h('span', null, inp, h('button', { type: 'button', class: 'btn sm', onclick: () => inp.click() }, icon('clip', 14), 'Archivo')); })();
  const priv = n._vis === 'private';
  const head = h('div', { class: 'sd-h' }, h('a', { class: 'ib back', href: '#/apuntes', 'aria-label': 'Volver a apuntes', onclick: () => { doSave(); } }, icon('chevL')), titleIn, h('span', { class: 'sp' }), status,
    mine && ib(n.fav ? 'star' : 'star', n.fav ? 'Quitar de favoritos' : 'Marcar favorito', () => updMeta({ fav: !n.fav }), n.fav ? 'on' : ''),
    mine && ib('lock', priv ? 'Privado: solo lo ves vos. Tocar para compartir con la familia' : 'Compartido con la familia. Tocar para hacerlo privado', async () => { dirty = false; await doSave(); await put('note', n, { vis: priv ? 'family' : 'private' }); toast(priv ? 'Ahora lo ve tu familia' : 'Ahora es privado'); refresh(); }, priv ? 'on' : ''),
    mine && ib('trash', 'Eliminar apunte', async () => { if (await confirmDlg('¿Eliminar este apunte?', 'Eliminar', true, 'Esta acción no se puede deshacer.')) { dirty = false; await del(n.id); go('apuntes'); } }));
  const wrap = h('div', { class: 'ne' }, head,
    h('p', { class: 'privnote' }, icon('lock', 14), priv ? ' Privado: solo vos lo ves.' : ' Compartido con la familia.', !mine && ' (Solo lectura)'),
    metaRow, mine && h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Formato' },
      tb('bold', 'Negrita', fmt('bold')), tb('italic', 'Cursiva', fmt('italic')), tb(null, 'Título', fmt('formatBlock', 'H3'), 'T'), tb('list', 'Lista con viñetas', fmt('insertUnorderedList')), tb(null, 'Lista numerada', fmt('insertOrderedList'), '1.'),
      tb('box', 'Lista de tareas', () => { ed.focus(); document.execCommand('insertHTML', false, '<div class="ck">&nbsp;</div>'); touch(); }), tb('link', 'Enlace en el texto', () => { const s = window.getSelection(); const rng = s.rangeCount ? s.getRangeAt(0).cloneRange() : null; editSheet('Enlace', [{ k: 'url', label: 'Dirección', type: 'url', required: true, placeholder: 'https://…' }], { url: '' }, { onSave: (v) => { if (!/^https?:\/\//i.test(v.url)) { toast('La dirección debe empezar con http:// o https://', 'bad'); return false; } ed.focus(); if (rng) { s.removeAllRanges(); s.addRange(rng); } document.execCommand('createLink', false, v.url); touch(); } }); })),
    ed, mine && actions, madeBox, h('div', { class: 'nfoot' }, tagsBox, h('div', { class: 'nl2' }, linksBox, mine && h('span', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn sm', onclick: addLink }, icon('link', 14), 'Enlace'), attach))));
  // al salir: borrar apunte vacío recién creado
  const onLeave = () => { if (n0.fresh && !(n.title || '').trim() && !htmlText(ed.innerHTML)) del(n.id).catch(() => { }); window.removeEventListener('hashchange', onLeave); window.NOTE_EDITING = false; };
  window.addEventListener('hashchange', onLeave);
  return wrap;
}
function topicFromNote(n, text) {
  const exams = R('exam').filter((e) => e.date >= today() && (!n.subjectId || e.subjectId === n.subjectId));
  if (!exams.length) { toast('Primero cargá un examen de esta materia para agregarle temas', 'bad'); return; }
  editSheet('Agregar como tema de estudio', [{ k: 'examId', label: 'Examen', type: 'select', options: exams.map((e) => [e.id, `${e.title} · ${D.short(e.date)}`]), required: true }, { k: 't', label: 'Tema', required: true }, { k: 'diff', label: 'Dificultad', type: 'select', options: [[1, 'Fácil'], [2, 'Media'], [3, 'Difícil']] }], { examId: exams[0].id, t: (text || '').slice(0, 100), diff: 2 }, {
    onSave: async (v) => { if (!isGuardian()) { toast('El examen lo administra tu familia. Pedí que agregue el tema.', 'bad'); return false; } const e = get(v.examId); await put('exam', { ...e, topics: [...(e.topics || []), { t: v.t.trim(), diff: Number(v.diff), done: false, fromNote: n.id }] }); toast('Tema agregado al examen'); },
  });
}
function cardFromNote(n, text) {
  editSheet('Nueva tarjeta de repaso', [{ k: 'q', label: 'Pregunta', type: 'textarea', required: true, placeholder: '¿Qué es…?' }, { k: 'a', label: 'Respuesta', type: 'textarea', required: true }], { q: '', a: text || '' }, { onSave: async (v) => { await put('quiz', { ...v, noteId: n.id, subjectId: n.subjectId || '', box: 1 }); toast('Tarjeta guardada en Plan de estudio'); } });
}

'use strict';
/* ===== Plan de estudio, enfoque, autoevaluación ===== */
const TIPS = [
  'Empezá por el tema más difícil mientras tenés energía.', 'Estudiá en bloques cortos y hacé una pausa de 10 minutos entre uno y otro.',
  'Explicá el tema en voz alta como si se lo enseñaras a alguien: si te trabás, ahí hay que repasar.', 'Probá responder sin mirar tus apuntes antes de releerlos.',
  'El día anterior al examen, repasá y dormí bien: no arranques temas nuevos.', 'Guardá el celular fuera de la vista durante la sesión.',
];
VIEWS.estudio = function () {
  const st = curStudent(); const t0 = today(); const cfg = planCfg();
  const root = h('div', { class: 'page study' }, h('div', { class: 'page-h' }, h('h1', null, 'Plan de estudio')));
  const exams = R('exam').filter((e) => e.date >= t0).sort(by((e) => e.date));
  root.append(h('p', { class: 'muted' }, 'El plan se arma con reglas simples: reparte los temas de cada examen en tus horarios libres, respeta las clases y nunca programa sesiones después del examen. Todo se puede mover o borrar.'));
  const res = h('div', { id: 'planres' });
  root.append(section('Horarios para estudiar', [
    h('div', { class: 'cfg' },
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Días de estudio' }, [1, 2, 3, 4, 5, 6, 0].map((d) => h('button', { class: 'chip' + (cfg.days.includes(d) ? ' on' : ''), 'aria-pressed': cfg.days.includes(d), onclick: () => savePlan({ days: cfg.days.includes(d) ? cfg.days.filter((x) => x !== d) : [...cfg.days, d].sort() }) }, DOWS[d]))),
      h('div', { class: 'row-inputs' }, labeled('Desde', h('input', { type: 'time', value: cfg.from, onchange: (e) => savePlan({ from: e.target.value }) })), labeled('Hasta', h('input', { type: 'time', value: cfg.to, onchange: (e) => savePlan({ to: e.target.value }) })), labeled('Sesión (min)', h('input', { type: 'number', min: 15, max: 120, step: 5, value: cfg.sessionMin, onchange: (e) => savePlan({ sessionMin: Math.max(15, Math.min(120, Number(e.target.value) || 40)) }) })), labeled('Pausa (min)', h('input', { type: 'number', min: 5, max: 30, step: 5, value: cfg.breakMin, onchange: (e) => savePlan({ breakMin: Math.max(5, Math.min(30, Number(e.target.value) || 10)) }) })))),
    h('div', { class: 'btnrow' }, h('button', { class: 'btn primary', onclick: async () => { const r = await applyPlan(); paintRes(res, r); } }, icon('target', 16), R('session').some((s) => s.auto) ? 'Rearmar el plan' : 'Armar el plan'), exams.length === 0 && h('span', { class: 'muted' }, 'Primero cargá un examen con sus temas.')), res]));
  if (exams.length) {
    root.append(section('Cómo vas con cada examen', exams.map((e) => { const p = examProgress(e); const sub = subjectOf(e.subjectId); return h('div', { class: 'ex-prog' }, h('button', { class: 'row-main link', onclick: () => openExam(e) }, h('span', { class: 'rt' }, `${e.title}`), h('span', { class: 'meta' }, subjTag(sub), h('span', { class: 'when' }, `${cap1(D.rel(e.date, t0))} · faltan ${Math.max(0, D.diff(t0, e.date))} días`))), h('div', { class: 'pbar', role: 'progressbar', 'aria-valuenow': p.pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Progreso de ' + e.title }, h('i', { style: { width: p.pct + '%' } })), h('small', null, `${p.pct}% · ${p.done}/${p.sessions} sesiones · ${p.tdone}/${p.topics} temas`)); })));
  }
  const missed = R('session').filter((s) => !s.done && s.date < t0);
  if (missed.length) root.append(h('div', { class: 'banner' }, icon('alert', 18), h('span', null, `Tenés ${plural(missed.length, 'sesión pendiente', 'sesiones pendientes')} de días anteriores.`), h('button', { class: 'btn sm', onclick: async () => { const r = await applyPlan(); paintRes($('#planres') || res, r); toast('Plan reprogramado'); } }, 'Reprogramar')));
  const next = R('session').filter((s) => s.date >= t0).sort(by((s) => s.date + s.start));
  const byDay = {}; next.forEach((s) => (byDay[s.date] = byDay[s.date] || []).push(s));
  root.append(section('Próximas sesiones', Object.keys(byDay).length ? Object.entries(byDay).slice(0, 14).map(([d, arr]) => h('div', { class: 'grp' }, h('small', null, cap1(D.long(d)) + (d === t0 ? ' · hoy' : '')), arr.map((s) => h('div', { class: 'srow' }, sessionRow(s), h('button', { class: 'ib sm', 'aria-label': 'Editar sesión', onclick: () => editSession(s) }, icon('edit', 16)))))) : h('p', { class: 'muted' }, 'Todavía no hay sesiones planificadas.'), h('button', { class: 'btn sm', onclick: () => editSession(null) }, icon('plus', 14), 'Sesión manual')));
  const cards = R('quiz');
  root.append(section('Autoevaluación', [h('div', { class: 'btnrow wrap' }, h('button', { class: 'btn', onclick: () => practiceTopics() }, icon('target', 16), 'Repasar temas de exámenes'), h('button', { class: 'btn', disabled: !cards.length, onclick: () => practiceCards() }, icon('copy', 16), `Practicar tarjetas (${cards.length})`), h('button', { class: 'btn', onclick: () => editCard(null) }, icon('plus', 16), 'Nueva tarjeta')), cards.length ? null : h('p', { class: 'muted' }, 'Creá tarjetas pregunta/respuesta, o generalas desde un apunte seleccionando texto.')]));
  root.append(section('Consejos rápidos', h('ul', { class: 'tips' }, [0, 1, 2].map((i) => h('li', null, TIPS[(new Date().getDate() + i) % TIPS.length])))));
  return root;
};
const labeled = (l, el) => h('label', { class: 'lbl' }, l, el);
async function savePlan(patch) { const c = planCfg(); const o = { days: c.days, from: c.from, to: c.to, sessionMin: c.sessionMin, breakMin: c.breakMin, ...patch }; if (c._rec) await put('plan', { ...c._rec, ...o }); else await put('plan', o); }
function paintRes(el, r) {
  clear(el);
  el.append(h('p', { class: 'okmsg', role: 'status' }, r.count ? `Listo: ${plural(r.count, 'sesión planificada', 'sesiones planificadas')}.` : 'No se pudo ubicar ninguna sesión.'));
  for (const w of r.warns) el.append(h('div', { class: 'warnbox', role: 'alert' }, icon('alert', 16), ` Para “${w.title}” faltan ${plural(w.sessions, 'sesión', 'sesiones')} (~${w.missingMin} min): no alcanza el tiempo libre antes del examen. Sumá días u horas de estudio, acortá las sesiones o hablá con el docente por la fecha.`));
}
function editSession(s) {
  const exams = R('exam').filter((e) => e.date >= today());
  return editSheet(s ? 'Sesión de estudio' : 'Sesión manual', [{ k: 'topic', label: 'Qué vas a estudiar', required: true }, { k: 'examId', label: 'Examen (opcional)', type: 'select', options: [['', 'Ninguno'], ...exams.map((e) => [e.id, e.title])] }, { k: 'date', label: 'Día', type: 'date', required: true, half: true }, { k: 'start', label: 'Desde', type: 'time', required: true, half: true }, { k: 'end', label: 'Hasta', type: 'time', required: true, half: true }], s ? { ...s } : { topic: '', examId: '', date: today(), start: '17:00', end: '17:40' }, {
    onSave: async (v) => {
      if (mins(v.end) <= mins(v.start)) { toast('La hora de fin tiene que ser después del inicio', 'bad'); return false; }
      const ex = v.examId ? get(v.examId) : null; if (ex && v.date >= ex.date) { toast('No se planifican sesiones el día del examen ni después', 'bad'); return false; }
      const cl = classesActive(v.date).find((c) => overlapT(v.start, v.end, c.start, c.end)); if (cl && !(await confirmDlg(`Se superpone con ${cl.sub?.name || 'una clase'}. ¿Guardar igual?`, 'Guardar igual'))) return false;
      await put('session', { ...v, auto: false, done: s?.done || false, subjectId: ex?.subjectId || s?.subjectId || '' });
    }, onDelete: s && (() => del(s.id)),
  });
}

/* ---------- temporizador de enfoque ---------- */
function startFocus(s) {
  const cfg = planCfg(); const total = Math.max(5, mins(s.end) - mins(s.start)) || cfg.sessionMin;
  sheet('Sesión de enfoque', (close) => {
    let phase = 'focus'; let left = total * 60; let t = null; let endAt = 0;
    const clockEl = h('div', { class: 'big-clock', role: 'timer', 'aria-live': 'off' }); const lab = h('p', { class: 'muted' }); const bar = h('div', { class: 'pbar' }, h('i'));
    const btn = h('button', { class: 'btn primary lg' });
    const draw = () => { const m = Math.floor(left / 60), sec = left % 60; clockEl.textContent = `${p2(m)}:${p2(sec)}`; lab.textContent = phase === 'focus' ? `Enfocate en: ${s.topic}` : 'Pausa: levantate, tomá agua, mirá lejos.'; const tot = (phase === 'focus' ? total : cfg.breakMin) * 60; bar.firstChild.style.width = Math.round(100 * (1 - left / tot)) + '%'; btn.textContent = t ? 'Pausar' : 'Iniciar'; btn.prepend(icon(t ? 'pause' : 'play', 18)); };
    const tick = () => { left = Math.max(0, Math.round((endAt - Date.now()) / 1000)); draw(); if (left <= 0) { clearInterval(t); t = null; if (phase === 'focus') { toast('¡Sesión completada! Hacé una pausa.'); phase = 'break'; left = cfg.breakMin * 60; put('session', { ...s, done: true }); } else { toast('Pausa terminada'); phase = 'focus'; left = total * 60; } draw(); } };
    btn.onclick = () => { if (t) { clearInterval(t); t = null; } else { endAt = Date.now() + left * 1000; t = setInterval(tick, 500); } draw(); };
    draw();
    return [lab, clockEl, bar, h('div', { class: 'btnrow center' }, btn, h('button', { class: 'btn', onclick: () => { clearInterval(t); t = null; phase = 'focus'; left = total * 60; draw(); } }, 'Reiniciar')),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: () => { clearInterval(t); put('session', { ...s, done: true }); toast('Sesión marcada como hecha'); close(); } }, icon('check', 16), 'Marcar como hecha'), h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => { clearInterval(t); close(); } }, 'Cerrar')), h('p', { class: 'hint' }, 'El avance se mide con el reloj del dispositivo; si cerrás esta ventana se detiene.')];
  }, { onClose: () => { } });
}

/* ---------- autoevaluación ---------- */
function editCard(c) {
  return editSheet(c ? 'Tarjeta' : 'Nueva tarjeta', [{ k: 'q', label: 'Pregunta', type: 'textarea', required: true }, { k: 'a', label: 'Respuesta', type: 'textarea', required: true }, { k: 'subjectId', label: 'Materia', type: 'select', options: () => subjOpts() }], c ? { ...c } : { q: '', a: '', subjectId: '', box: 1 }, { onSave: (v) => put('quiz', { box: 1, ...v }), onDelete: c && (() => del(c.id)) });
}
function practiceCards() {
  const deck = R('quiz').sort(by((c) => c.box || 1)); if (!deck.length) return;
  let i = 0, shown = false, ok = 0;
  sheet('Practicar tarjetas', (close) => {
    const box = h('div', { class: 'quiz' });
    const paint = () => {
      clear(box);
      if (i >= deck.length) { box.append(h('p', { class: 'okmsg' }, `Terminaste: ${ok} de ${deck.length} sabidas.`), h('button', { class: 'btn primary', onclick: close }, 'Cerrar')); return; }
      const c = deck[i];
      box.append(h('small', { class: 'muted' }, `Tarjeta ${i + 1} de ${deck.length}`), h('p', { class: 'qtext' }, c.q), shown ? h('div', { class: 'qans' }, h('strong', null, 'Respuesta'), h('p', null, c.a)) : null,
        shown ? h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: () => { put('quiz', { ...c, box: 1 }); i++; shown = false; paint(); } }, 'Repasar de nuevo'), h('button', { class: 'btn primary', onclick: () => { ok++; put('quiz', { ...c, box: Math.min(4, (c.box || 1) + 1) }); i++; shown = false; paint(); } }, icon('check', 16), 'Lo sabía')) : h('button', { class: 'btn primary', onclick: () => { shown = true; paint(); } }, 'Mostrar respuesta'));
    };
    paint(); return [box];
  });
}
function practiceTopics() {
  const exams = R('exam').filter((e) => e.date >= today() && (e.topics || []).some((t) => !t.done));
  if (!exams.length) { toast('No hay temas pendientes para repasar. Cargá temas en tus exámenes.'); return; }
  const pool = []; exams.forEach((e) => e.topics.forEach((t, idx) => { if (!t.done) pool.push({ e, t, idx }); }));
  let i = 0;
  sheet('Repasar temas', (close) => {
    const box = h('div', { class: 'quiz' });
    const paint = () => {
      clear(box);
      if (i >= pool.length) { box.append(h('p', { class: 'okmsg' }, 'Repasaste todos los temas de la lista.'), h('button', { class: 'btn primary', onclick: close }, 'Cerrar')); return; }
      const { e, t, idx } = pool[i];
      box.append(h('small', { class: 'muted' }, `${e.title} · ${i + 1} de ${pool.length}`), h('p', { class: 'qtext' }, `Explicá con tus palabras: ${t.t}`), h('p', { class: 'hint' }, 'Sin mirar los apuntes. Después decidí qué tan bien te salió.'),
        h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: () => { i++; paint(); } }, 'Repasar más tarde'), h('button', { class: 'btn primary', onclick: async () => { const fresh = get(e.id); const topics = fresh.topics.map((x, k) => k === idx ? { ...x, done: true } : x); await put('exam', { ...fresh, topics }); i++; paint(); } }, icon('check', 16), 'Lo domino')));
    };
    paint(); return [box];
  });
}

'use strict';
/* ===== Más, Familia, Ajustes, Buscar ===== */
VIEWS.mas = function () {
  const desc = { estudio: 'Armá sesiones para tus exámenes', materiales: 'Mochila y materiales por día', notas: 'Promedios explicados', calendario: 'Períodos, vacaciones y feriados', familia: 'Estudiantes, accesos e invitaciones', ajustes: 'Apariencia, avisos y datos' };
  return h('div', { class: 'page' }, h('div', { class: 'page-h' }, h('h1', null, 'Más')), h('div', { class: 'menu' }, MORE.map(([id, l, ic]) => h('a', { class: 'mrow', href: '#/' + id }, h('span', { class: 'ico' }, icon(ic, 20)), h('span', null, h('strong', null, l), h('small', null, desc[id])), icon('chevR', 18)))));
};

/* ---------- Familia ---------- */
function studentFields() { return [{ k: 'name', label: 'Nombre o apodo', required: true, max: 60 }, { k: 'level', label: 'Nivel', type: 'select', half: true, options: [['', '—'], 'Primaria', 'Secundaria', 'Terciario', 'Universidad', 'Curso / idioma', 'Otro'] }, { k: 'institution', label: 'Institución', half: true }, { k: 'grade', label: 'Curso o año', half: true }, { k: 'division', label: 'División / comisión', half: true }, { k: 'shift', label: 'Turno', type: 'select', half: true, options: [['', '—'], 'Mañana', 'Tarde', 'Noche', 'Doble'] }, { k: 'tz', label: 'Zona horaria', type: 'select', options: tzOptions() }]; }
function openStudent(s) {
  return editSheet(s ? 'Estudiante' : 'Nuevo estudiante', studentFields(), s ? { ...s } : { name: '', tz: curStudent()?.tz || S.meta?.default_tz || 'UTC' }, {
    wide: true,
    onSave: async (v) => { const j = await api(s ? 'PUT' : 'POST', s ? 'students/' + s.id : 'students', v); await syncNow(true); if (!s) { S.sid = j.student.id; toast('Estudiante agregado'); } },
    extra: s && (() => h('div', { class: 'btnrow wrap' }, h('button', { class: 'btn', onclick: async () => { await api('PUT', 'students/' + s.id, { ...s, archived: !s.settings?.archived }); await syncNow(true); toast(s.settings?.archived ? 'Estudiante reactivado' : 'Estudiante archivado'); sheetStack.at(-1)?.remove(); sheetStack.pop(); } }, s.settings?.archived ? 'Reactivar' : 'Archivar (conserva todo)'))),
    onDelete: s && liveStudents().length > 1 && (async () => { try { await api('DELETE', 'students/' + s.id); S.sid = null; await syncNow(true); toast('Estudiante eliminado'); } catch (e) { toast(e.message, 'bad'); } }),
  });
}
VIEWS.familia = function () {
  const root = h('div', { class: 'page' }, h('div', { class: 'page-h' }, h('h1', null, 'Familia y accesos')));
  if (!isGuardian()) {
    root.append(section('Tu acceso', [h('p', null, 'Tenés acceso como estudiante. Podés ver tu agenda, marcar tus tareas y la mochila, escribir tus apuntes (privados por defecto) y pedir ayuda.'), h('p', { class: 'muted' }, 'Tu familia administra materias, horarios, exámenes y calendario.'), h('button', { class: 'btn', onclick: () => openHelp(null) }, icon('help', 16), 'Pedir ayuda')]));
    return root;
  }
  const f = S.family;
  root.append(section('Estudiantes', [...S.students.filter((s) => !s.deleted).map((s) => h('button', { class: 'row', onclick: () => openStudent(s) }, h('span', { class: 'ico' }, icon('user', 16)), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, s.name), h('span', { class: 'meta' }, s.level && h('span', { class: 'when' }, s.level), s.grade && h('span', { class: 'when' }, s.grade), s.institution && h('span', { class: 'when' }, s.institution), s.settings?.archived && pill('Archivado', '', 'lock'), S.members.find((m) => m.student_id === s.id) && pill('Tiene acceso propio', 'ok', 'check'))))), liveStudents().length < 12 && f.mode === 'family' || liveStudents().length < 1 ? null : null], h('button', { class: 'btn sm', onclick: () => openStudent(null) }, icon('plus', 14), 'Estudiante')));
  if (!LOCAL) root.append(section('Quién tiene acceso', S.members.map((m) => h('div', { class: 'row' }, h('span', { class: 'ico' }, icon(m.role === 'guardian' ? 'user' : 'cap', 16)), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, m.name + (m.user_id === myUid() ? ' (vos)' : '')), h('span', { class: 'meta' }, pill(m.role === 'guardian' ? 'Responsable' : 'Estudiante: ' + (S.students.find((s) => s.id === m.student_id)?.name || ''), m.role === 'guardian' ? 'info' : ''), m.email && h('span', { class: 'when' }, m.email))), m.user_id !== myUid() && f && h('button', { class: 'btn sm danger-o', onclick: async () => { if (await confirmDlg(`¿Quitar el acceso de ${m.name}?`, 'Quitar', true, 'Deja de poder entrar a esta familia.')) { try { await api('DELETE', 'members/' + m.user_id); await syncNow(true); toast('Acceso quitado'); } catch (e) { toast(e.message, 'bad'); } } } }, 'Quitar')))));
  const inv = (S.invites || []);
  root.append(LOCAL ? section('Compartir y sincronizar', [h('p', { class: 'muted' }, 'La versión de un archivo es para una persona y guarda los datos solo en este dispositivo. Para compartir con tu familia o ver lo mismo en varios aparatos, pasá a la suscripción.'), h('button', { class: 'btn primary', onclick: openUpgrade }, icon('repeat', 16), 'Pasar a la versión sincronizada')]) : section('Invitaciones', [h('p', { class: 'muted' }, 'Una invitación vence a los 7 días y se puede revocar. Un estudiante con acceso propio ve solo su información; no puede cambiar materias, horarios ni exámenes, y sus apuntes privados no los ve nadie más.'),
    inv.map((i) => h('div', { class: 'row' }, h('span', { class: 'ico' }, icon('mail', 16)), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, h('code', null, i.code)), h('span', { class: 'meta' }, pill(i.role === 'student' ? 'Para ' + (S.students.find((s) => s.id === i.student_id)?.name || 'estudiante') : 'Otro responsable'), h('span', { class: 'when' }, 'Vence ' + new Date(i.expires_at * 1000).toLocaleDateString('es-AR')))), h('button', { class: 'btn sm', onclick: () => copyText(inviteUrl(i.code)) }, icon('copy', 14), 'Copiar enlace'), h('button', { class: 'btn sm danger-o', onclick: async () => { await api('DELETE', 'invites/' + i.code); await syncNow(true); toast('Invitación revocada'); } }, 'Revocar'))),
    h('div', { class: 'btnrow wrap' }, h('button', { class: 'btn', onclick: () => makeInvite('guardian') }, icon('users', 16), 'Invitar a otro responsable'), liveStudents().length > 0 && h('button', { class: 'btn', onclick: () => makeInvite('student') }, icon('cap', 16), 'Dar acceso a un estudiante'))]));
  const helps = R('help', null).concat(R('help')).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i);
  if (helps.length) root.append(section('Pedidos de ayuda', helps.map((x) => h('div', { class: 'row' }, h('span', { class: 'ico' }, icon('help', 16)), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, x.text), h('span', { class: 'meta' }, h('span', { class: 'when' }, S.members.find((m) => m.user_id === x._by)?.name || ''), pill(x.resolved ? 'Resuelto' : 'Abierto', x.resolved ? 'ok' : 'warn'))), !x.resolved && h('button', { class: 'btn sm', onclick: () => put('help', { ...x, resolved: true }) }, 'Resuelto')))));
  const sc = scale();
  root.append(section('Escala de notas', buildScaleForm(sc)));
  root.append(section('Modo', h('div', { class: 'chips' }, [['self', 'Para mí'], ['family', 'Para mi familia']].map(([k, l]) => h('button', { class: 'chip' + (f.mode === k ? ' on' : ''), 'aria-pressed': f.mode === k, onclick: async () => { const j = await api('PUT', 'family', { mode: k }); S.family = j.family; bump(); } }, l)))));
  return root;
};
const inviteUrl = (code) => (location.href.split('#')[0].replace(/[^/]*$/, '') || location.origin + '/') + '#/unirse/' + code;
async function makeInvite(role) {
  let sid = '';
  const students = liveStudents().filter((s) => !S.members.find((m) => m.student_id === s.id));
  if (role === 'student') {
    if (!students.length) { toast('Todos los estudiantes ya tienen acceso propio', 'bad'); return; }
    sid = students[0].id;
    await new Promise((res) => { sheet('¿Para qué estudiante?', (close) => [h('div', { class: 'field' }, h('select', { id: 'invsel', 'aria-label': 'Estudiante', onchange: (e) => { sid = e.target.value; } }, students.map((s) => h('option', { value: s.id }, s.name)))), h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: () => { res(false); close(); } }, 'Cancelar'), h('button', { class: 'btn primary', onclick: () => { res(true); close(); } }, 'Crear invitación'))], { onClose: () => res(false) }); }).then((ok) => { if (!ok) sid = null; });
    if (!sid) return;
  }
  try {
    const j = await api('POST', 'invites', { role, student_id: sid });
    await syncNow(true);
    sheet('Invitación creada', (close) => [h('p', null, 'Compartí este enlace o el código. Vence el ', h('strong', null, new Date(j.expires_at * 1000).toLocaleDateString('es-AR')), '.'), DEMO && h('p', { class: 'warnbox' }, 'Demo: este código es de ejemplo y no sirve para entrar.'), h('p', { class: 'bigcode' }, j.code), h('input', { type: 'text', readonly: true, value: inviteUrl(j.code), 'aria-label': 'Enlace de invitación', onfocus: (e) => e.target.select() }), h('div', { class: 'btnrow' }, h('button', { class: 'btn primary', onclick: () => copyText(inviteUrl(j.code)) }, icon('copy', 16), 'Copiar enlace'), h('button', { class: 'btn', onclick: close }, 'Listo'))]);
  } catch (e) { toast(e.message, 'bad'); }
}
function buildScaleForm(sc) {
  const f = buildForm([{ k: 'min', label: 'Nota mínima', type: 'number', half: true }, { k: 'max', label: 'Nota máxima', type: 'number', half: true }, { k: 'pass', label: 'Aprueba desde', type: 'number', half: true }, { k: 'decimals', label: 'Decimales', type: 'select', options: [[0, '0'], [1, '1'], [2, '2']], half: true }], { ...sc });
  f.el.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: async () => { try { const j = await api('PUT', 'family', { settings: { scale: { min: f.v.min, max: f.v.max, pass: f.v.pass, decimals: Number(f.v.decimals) } } }); S.family = j.family; bump(); toast('Escala guardada'); } catch (e) { toast(e.message, 'bad'); } } }, 'Guardar escala')));
  return f.el;
}

/* ---------- Ajustes ---------- */
VIEWS.ajustes = function () {
  const s = S.me.settings; const root = h('div', { class: 'page' }, h('div', { class: 'page-h' }, h('h1', null, 'Ajustes')));
  const chipsRow = (label, key, opts) => h('div', { class: 'field' }, h('label', null, label), h('div', { class: 'chips', role: 'group', 'aria-label': label }, opts.map(([k, l, ic]) => h('button', { class: 'chip' + ((s[key] ?? DEF[key]) === k ? ' on' : ''), 'aria-pressed': (s[key] ?? DEF[key]) === k, onclick: () => saveSettings({ [key]: k }) }, ic && icon(ic, 14), l))));
  const DEF = { theme: 'ocean', mode: 'auto', textSize: 'm', hour12: false, weekStart: 1 };
  const nameIn = h('input', { type: 'text', value: S.me.name, maxlength: 80, 'aria-label': 'Tu nombre' });
  if (LOCAL) root.append(localCard());
  root.append(section('Cuenta', [h('div', { class: 'field' }, h('label', null, 'Tu nombre'), h('div', { class: 'inline' }, nameIn, h('button', { class: 'btn', onclick: async () => { await saveSettings({ name: nameIn.value }); toast('Nombre guardado'); } }, 'Guardar'))),
    h('p', { class: 'muted' }, S.me.email || '(cuenta de demostración)', !NOSRV && (S.me.verified ? ' · correo confirmado' : ' · correo sin confirmar')),
    !NOSRV && !S.me.verified && h('button', { class: 'btn', onclick: async () => { try { await api('POST', 'auth/resend'); toast('Te enviamos el correo de confirmación'); } catch (e) { toast(e.message, 'bad'); } } }, icon('mail', 16), 'Reenviar confirmación'),
    !DEMO && h('button', { class: 'btn', onclick: changePassword }, icon('lock', 16), 'Cambiar contraseña')]));
  root.append(section('Apariencia', [h('div', { class: 'field' }, h('label', null, 'Colores'), h('div', { class: 'choice sm' }, PALETTES.map(([k, n, d]) => h('button', { class: 'ch pal pal-' + k + (s.theme === k || (!s.theme && k === 'ocean') ? ' on' : ''), 'aria-pressed': (s.theme || 'ocean') === k, onclick: () => saveSettings({ theme: k }) }, h('span', { class: 'swatchrow' }, h('i'), h('i'), h('i')), h('strong', null, n), h('span', null, d))))),
    chipsRow('Claro u oscuro', 'mode', [['auto', 'Según el dispositivo'], ['light', 'Claro', 'sun'], ['dark', 'Oscuro', 'moon']]), chipsRow('Tamaño del texto', 'textSize', [['s', 'Chico'], ['m', 'Normal'], ['l', 'Grande'], ['xl', 'Muy grande']])]));
  root.append(section('Fecha y hora', [chipsRow('Formato de hora', 'hour12', [[false, '24 horas'], [true, '12 horas']]), chipsRow('La semana empieza el', 'weekStart', [[1, 'Lunes'], [0, 'Domingo'], [6, 'Sábado']]),
    h('div', { class: 'field' }, h('label', { for: 'tzsel' }, 'Zona horaria'), h('select', { id: 'tzsel', onchange: (e) => saveSettings({ tz: e.target.value }) }, tzOptions(s.tz || curStudent()?.tz).map(([z, l]) => h('option', { value: z, selected: z === (s.tz || curStudent()?.tz) }, l))), h('p', { class: 'hint' }, 'Los avisos y resúmenes por correo se calculan con esta zona.'))]));
  root.append(LOCAL ? section('Avisos por correo', [h('p', { class: 'muted' }, 'La versión de un archivo no envía correos. Con la suscripción recibís avisos de tareas, exámenes y materiales.')]) : section('Avisos por correo', notifSection()));
  root.append(section('Accesibilidad', [h('ul', { class: 'tips' }, h('li', null, 'Se puede usar todo con teclado: Tab para moverte, Enter o Espacio para activar, Esc para cerrar ventanas.'), h('li', null, 'El estado de cada cosa se indica con texto e ícono, no solo con color.'), h('li', null, 'Si tu dispositivo pide “reducir movimiento”, la app lo respeta.'), h('li', null, 'Podés agrandar el texto arriba, en “Tamaño del texto”.'))]));
  root.append(section('Tus datos', [h('p', { class: 'muted' }, LOCAL ? 'Los datos se guardan solo en este dispositivo. Hacé copias seguido: es la única forma de recuperarlos si se borran los datos del navegador.' : 'Los datos se guardan en el servidor de esta app. Podés llevarte una copia o borrar todo cuando quieras.'),
    isGuardian() && h('div', { class: 'btnrow wrap' }, h('button', { class: 'btn', onclick: exportData }, icon('download', 16), 'Descargar copia (JSON)'), h('button', { class: 'btn', onclick: importData }, icon('upload', 16), 'Restaurar desde copia')),
    !DEMO && h('button', { class: 'btn danger-o', onclick: deleteAccount }, icon('trash', 16), LOCAL ? 'Borrar los datos de este dispositivo' : 'Eliminar mi cuenta')]));
  root.append(h('p', { class: 'muted small' }, BRAND.name + (DEMO ? ' · demostración con datos ficticios' : LOCAL ? ' · versión de un archivo' : '')));
  return root;
};
function notifSection() {
  const n = JSON.parse(JSON.stringify(S.me.settings.notif || { email: false, leadMin: 1440, daily: true, weekly: false, digestHour: '07:00', quiet: { enabled: false, from: '22:00', to: '07:00' }, cats: { tasks: true, exams: true, materials: true, events: true } }));
  const box = h('div'); const stat = h('div', { class: 'mailstat' });
  const paint = () => {
    clear(box);
    box.append(h('label', { class: 'chk big' }, h('input', { type: 'checkbox', checked: !!n.email, onchange: (e) => { n.email = e.target.checked; paint(); } }), h('span', null, 'Recibir avisos por correo')));
    if (n.email) {
      box.append(buildNotifForm(n).el);
      const stu = liveStudents();
      if (isGuardian() && stu.length > 1) box.append(h('div', { class: 'field' }, h('label', null, 'Avisar sobre'), h('div', { class: 'chips' }, stu.map((x) => { const on = !n.students?.length || n.students.includes(x.id); return h('button', { class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on, onclick: () => { const all = stu.map((z) => z.id); let cur = n.students?.length ? n.students : all.slice(); cur = cur.includes(x.id) ? cur.filter((z) => z !== x.id) : [...cur, x.id]; n.students = cur.length === all.length ? [] : cur; paint(); } }, on && icon('check', 14), x.name); }))));
      box.append(h('div', { class: 'btnrow wrap' }, h('button', { class: 'btn primary', onclick: async () => { try { const j = await api('PUT', 'settings', { notif: n }); S.me = j.user; bump(); toast('Avisos guardados'); loadStat(); } catch (e) { toast(e.message, 'bad'); } } }, 'Guardar avisos'), !DEMO && h('button', { class: 'btn', onclick: async () => { try { await api('POST', 'reminders/test'); toast('Correo de prueba enviado'); loadStat(); } catch (e) { toast(e.message, 'bad'); } } }, icon('mail', 16), 'Enviar correo de prueba')));
    } else box.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: async () => { const j = await api('PUT', 'settings', { notif: { ...n, email: false } }); S.me = j.user; bump(); toast('Avisos desactivados'); } }, 'Guardar')));
    box.append(stat);
  };
  const loadStat = async () => {
    clear(stat);
    if (DEMO) { stat.append(h('p', { class: 'warnbox' }, icon('mail', 16), ' Demo: aquí no se envían correos. En la app instalada se envían de verdad desde el servidor y se muestra el estado real de cada envío.')); return; }
    try {
      const r = await api('GET', 'reminders/status');
      if (!r.mail_configured) stat.append(h('p', { class: 'warnbox' }, icon('mail', 16), ' Correo pendiente de configurar en el servidor. Tus preferencias quedan guardadas, pero no se envía nada hasta que se configure.'));
      else if (!r.verified) stat.append(h('p', { class: 'warnbox' }, icon('alert', 16), ' Confirmá tu correo (te enviamos un enlace) para recibir avisos.'));
      else stat.append(h('p', { class: 'okmsg' }, icon('check', 16), ` Correo configurado. Avisos en cola: ${r.pending}.`));
      stat.append(h('p', { class: 'muted small' }, r.cron_last ? `Último ciclo del programador: ${new Date(r.cron_last * 1000).toLocaleString('es-AR')}.` : 'El programador (cron) todavía no se ejecutó: sin él no salen avisos automáticos.'));
      if (r.log.length) stat.append(h('details', null, h('summary', null, 'Últimos envíos'), h('ul', { class: 'glist' }, r.log.map((l) => h('li', null, h('span', null, `${({ reminder: 'Aviso', digest: 'Resumen', test: 'Prueba', verify: 'Confirmación', reset: 'Contraseña' })[l.kind] || l.kind} · ${new Date(l.created_at * 1000).toLocaleString('es-AR')}`), h('span', null, l.status === 'sent' ? 'Enviado' : 'Falló' + (l.error ? ': ' + l.error : '')))))));
    } catch (e) { }
  };
  paint(); loadStat();
  return box;
}
function changePassword() {
  editSheet('Cambiar contraseña', [{ k: 'old', label: 'Contraseña actual', type: 'password', required: true }, { k: 'new', label: 'Contraseña nueva (mínimo 8)', type: 'password', required: true }], { old: '', new: '' }, { onSave: async (v) => { try { await api('POST', 'auth/password', v); toast('Contraseña cambiada'); } catch (e) { toast(e.message, 'bad'); return false; } } });
}
function exportData() {
  if (LOCAL) { localBackup(); return; }
  if (DEMO) { sheet('Copia de los datos de la demo', () => [h('p', { class: 'muted' }, 'En la demo no se descargan archivos. Este es el contenido que se guardaría:'), h('textarea', { rows: 10, readonly: true, onfocus: (e) => e.target.select() }, JSON.stringify(Backend.exportAll(), null, 1)), h('button', { class: 'btn', onclick: () => copyText(JSON.stringify(Backend.exportAll())) }, icon('copy', 16), 'Copiar')], { wide: true }); return; }
  location.href = 'api.php?r=export';
}
function importData() {
  const inp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!Array.isArray(j.records) || !Array.isArray(j.students)) throw new Error('El archivo no parece una copia de esta app');
      const replace = await confirmDlg(`La copia tiene ${j.records.length} elementos. ¿Reemplazar lo actual o sumarlo?`, 'Reemplazar todo', true, 'Si cancelás podés elegir “sumar”.');
      const ok = replace || await confirmDlg('¿Sumar la copia a lo que ya tenés?', 'Sumar');
      if (!ok) return;
      const r = await api('POST', 'import', { ...j, replace }); await syncNow(true); toast(`Se importaron ${r.imported} elementos`);
    } catch (er) { toast(er.message || 'No se pudo importar', 'bad'); }
  } });
  document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 60000);
}
function deleteAccount() {
  editSheet('Eliminar mi cuenta', [{ k: 'password', label: 'Tu contraseña', type: 'password', required: true }, { k: 'sure', type: 'checkbox', label: '', text: 'Entiendo que se borran mis datos' + (S.member?.is_owner ? ', los de toda la familia y los archivos' : '') + ' y no se pueden recuperar' }], { password: '', sure: false }, {
    saveLabel: 'Eliminar para siempre', onSave: async (v) => { if (!v.sure) { toast('Marcá la casilla para confirmar', 'bad'); return false; } try { await api('POST', 'auth/delete', { password: v.password }); stopPolling(); S.me = S.member = S.family = null; S.recs = new Map(); S.since = 0; bump(); go('entrar'); toast('Cuenta eliminada'); } catch (e) { toast(e.message, 'bad'); return false; } },
  });
}

/* ---------- Buscar ---------- */
VIEWS.buscar = function () {
  const out = h('div', { class: 'results' }); const label = { subject: 'Materia', teacher: 'Docente', task: 'Tarea', exam: 'Examen', event: 'Evento', note: 'Apunte', material: 'Material', question: 'Pregunta' };
  const open = (r) => { const x = r.rec; ({ subject: () => go('materias/' + x.id), teacher: () => openTeacher(x), task: () => openTask(x), exam: () => openExam(x), event: () => openEvent(x), note: () => go('apuntes/' + x.id), material: () => openMaterial(x), question: () => openQuestion(x) })[r.type](); };
  const run = (q) => { clear(out); if (!q.trim()) { out.append(h('p', { class: 'muted' }, 'Buscá por título, texto de apuntes, temas, etiquetas, materias o docentes.')); return; } const rs = searchAll(q); out.append(rs.length ? rs.map((r) => h('button', { class: 'row', onclick: () => open(r) }, h('span', { class: 'ico' }, icon(r.type === 'note' ? 'note' : r.type === 'exam' ? 'flag' : r.type === 'task' ? 'check' : r.type === 'material' ? 'bag' : r.type === 'subject' ? 'book' : r.type === 'teacher' ? 'user' : 'calendar', 16)), h('span', { class: 'row-main' }, h('span', { class: 'rt' }, r.title), h('span', { class: 'meta' }, pill(label[r.type]), subjTag(subjectOf(r.rec.subjectId)))))) : h('p', { class: 'muted' }, 'No encontré nada con “' + q + '”.')); };
  const inp = h('input', { type: 'search', 'aria-label': 'Buscar', placeholder: 'Buscar en todo…', oninput: (e) => run(e.target.value) });
  setTimeout(() => inp.focus(), 50); run('');
  return h('div', { class: 'page' }, h('div', { class: 'page-h' }, h('h1', null, 'Buscar')), h('div', { class: 'searchbar' }, icon('search', 18), inp), out);
};

'use strict';
/* ===== Modo demostración: datos ficticios, rotulados, en memoria ===== */
const DEMO_STUDENT_WRITE = ['task', 'material', 'note', 'quiz', 'question', 'help', 'bag', 'session', 'plan'];
const DEMO_STUDENT_PATCH = { task: ['status', 'steps', 'statusBy', 'doneAt'], material: ['status', 'log', 'statusBy'], exam: ['topics', 'prep'], session: ['done'] };
const DemoApi = {
  db: null, who: 1, tick: Date.now(),
  ts() { return (this.tick = Math.max(this.tick + 1, Date.now())); },
  err(m, s = 400, c = 'demo') { return new ApiError(m, s, c); },
  member() { return this.db.members.find((m) => m.user_id === this.who); },
  user() { return this.db.users.find((u) => u.id === this.who); },
  visible(r) { const m = this.member(); if (r.family_id !== 'demo') return false; if (m.role === 'student' && r.student_id !== null && r.student_id !== m.student_id) return false; return r.visibility === 'family' || r.created_by === this.who; },
  out(r) { const { family_id, ...x } = r; return { ...x, data: JSON.parse(JSON.stringify(r.data)) }; },
  meOut() { const m = this.member(); const u = this.user(); return { user: { id: u.id, email: '', name: u.name, verified: true, settings: u.settings }, member: { role: m.role, student_id: m.student_id, family_id: 'demo', is_owner: m.user_id === 1 }, family: this.db.family, csrf: 'demo' }; },
  exportAll() { return { app: BRAND.name + ' (demo)', students: this.db.students, records: this.db.records.filter((r) => !r.deleted && this.visible(r)).map((r) => this.out(r)) }; },
  async call(method, path, body, params) {
    await Promise.resolve();
    if (!this.db && !['meta', 'auth/logout'].includes(path)) throw this.err('Elegí un escenario de demostración', 401, 'auth');
    const [a, b] = path.split('/'); const db = this.db;
    if (path === 'meta') return { brand: BRAND, mail_configured: false, default_tz: 'America/Argentina/Buenos_Aires', open_registration: false, csrf: 'demo', logged: !!db };
    if (path === 'auth/logout') { this.db = null; return { ok: true, csrf: 'demo' }; }
    if (path === 'auth/me') return this.meOut();
    if (a === 'auth') throw this.err('En la demo no hay cuentas. Para crear la tuya, instalá la app en tu hosting.');
    if (a === 'sync') {
      const m = this.member(); const since = Number(params?.since || 0);
      const recs = db.records.filter((r) => this.visible(r) && (since > 0 ? r.updated_at > since : !r.deleted)).map((r) => this.out(r)).sort(by((r) => r.updated_at));
      const studs = db.students.filter((s) => m.role !== 'student' || s.id === m.student_id);
      return { ...this.meOut(), server_time: Date.now(), students: JSON.parse(JSON.stringify(studs)), records: recs, full: since === 0, members: db.members.map((x) => ({ user_id: x.user_id, role: x.role, student_id: x.student_id, name: db.users.find((u) => u.id === x.user_id).name, email: null })), ...(m.role === 'guardian' ? { invites: db.invites.filter((i) => i.expires_at > Date.now() / 1000) } : {}) };
    }
    if (a === 'settings') { const u = this.user(); for (const k of ['theme', 'mode', 'textSize', 'hour12', 'weekStart', 'tz', 'notif', 'activeStudent', 'view']) if (k in body) u.settings[k] = body[k]; if (body.name) u.name = body.name; return this.meOut(); }
    if (a === 'family' && method === 'PUT') { const m = this.member(); if (m.role !== 'guardian') throw this.err('Solo responsables', 403); if (body.mode) db.family.mode = body.mode; if (body.settings?.scale) { const s = body.settings.scale; if (!(s.max > s.min)) throw this.err('La nota máxima debe ser mayor que la mínima', 422); db.family.settings.scale = { min: Number(s.min), max: Number(s.max), pass: Math.max(s.min, Math.min(s.max, Number(s.pass))), decimals: Number(s.decimals) }; } return this.meOut(); }
    if (a === 'students') {
      if (this.member().role !== 'guardian') throw this.err('Solo responsables', 403);
      if (method === 'POST') { const s = { id: uid(), name: body.name, level: body.level || '', institution: body.institution || '', grade: body.grade || '', division: body.division || '', shift: body.shift || '', tz: body.tz || 'UTC', settings: {}, updated_at: this.ts(), deleted: false }; db.students.push(s); return { student: s }; }
      const s = db.students.find((x) => x.id === b); if (!s) throw this.err('No encontrado', 404);
      if (method === 'DELETE') { if (db.students.filter((x) => !x.deleted).length <= 1) throw this.err('Tiene que quedar al menos un estudiante', 422); s.deleted = true; s.updated_at = this.ts(); db.records.forEach((r) => { if (r.student_id === s.id) { r.deleted = true; r.updated_at = this.ts(); } }); return { ok: true }; }
      Object.assign(s, { name: body.name ?? s.name, level: body.level ?? s.level, institution: body.institution ?? s.institution, grade: body.grade ?? s.grade, division: body.division ?? s.division, shift: body.shift ?? s.shift, tz: body.tz ?? s.tz }); if ('archived' in body) s.settings = { ...s.settings, archived: !!body.archived }; s.updated_at = this.ts(); return { student: s };
    }
    if (a === 'invites') { if (method === 'POST') { const code = Array.from({ length: 10 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); const i = { code, role: body.role, student_id: body.student_id || null, expires_at: Math.floor(Date.now() / 1000) + 7 * 86400, used_by: null }; db.invites.push(i); return { ...i, url: '' }; } if (method === 'DELETE') { db.invites = db.invites.filter((i) => i.code !== b); return { ok: true }; } }
    if (a === 'members' && method === 'DELETE') { const id = Number(b); if (id === 1) throw this.err('No se puede quitar a quien creó la familia', 422); db.members = db.members.filter((m) => m.user_id !== id); return { ok: true }; }
    if (a === 'files') throw this.err('Los archivos adjuntos funcionan en la app instalada, no en la demo.');
    if (a === 'import') throw this.err('Importar no está disponible en la demo.');
    if (a === 'reminders') throw this.err('Los avisos por correo se envían desde el servidor de la app instalada.', 503, 'mail_off');
    if (a === 'records') return this.records(method, b, body);
    throw this.err('No disponible en la demo', 404);
  },
  records(method, id, body) {
    const db = this.db; const m = this.member(); const types = ['period', 'subject', 'teacher', 'slot', 'exception', 'task', 'exam', 'note', 'material', 'event', 'session', 'quiz', 'question', 'help', 'bag', 'plan'];
    if (method === 'POST') {
      if (!types.includes(body.type)) throw this.err('Tipo desconocido', 422);
      if (m.role === 'student' && !DEMO_STUDENT_WRITE.includes(body.type)) throw this.err('Este contenido lo administra tu familia', 403, 'forbidden');
      let sid = body.student_id || null; if (m.role === 'student') { if (sid && sid !== m.student_id) throw this.err('No tenés acceso a ese estudiante', 403); sid = m.student_id; }
      let vis = body.visibility === 'private' ? 'private' : 'family'; if (body.type === 'note' && m.role === 'student' && !body.visibility) vis = 'private';
      const t = this.ts(); const r = { id: body.id || uid(), family_id: 'demo', type: body.type, student_id: sid, data: body.data || {}, visibility: vis, created_by: this.who, updated_by: this.who, created_at: t, updated_at: t, deleted: false }; db.records.push(r); return { record: this.out(r), server_time: t };
    }
    const r = db.records.find((x) => x.id === id && !x.deleted && this.visible(x)); if (!r) throw this.err('No encontrado', 404, 'not_found');
    if (method === 'DELETE') { if (m.role === 'student' && (r.created_by !== this.who || !DEMO_STUDENT_WRITE.includes(r.type))) throw this.err('No podés eliminar este elemento', 403, 'forbidden'); r.deleted = true; r.updated_at = this.ts(); return { ok: true }; }
    const old = r.data; const next = method === 'PATCH' ? { ...old, ...body.data } : (body.data ?? old);
    if (m.role === 'student') {
      if (r.created_by === this.who) { if (!DEMO_STUDENT_WRITE.includes(r.type)) throw this.err('Este contenido lo administra tu familia', 403); }
      else { const allowed = DEMO_STUDENT_PATCH[r.type]; if (!allowed) throw this.err('No podés editar este elemento', 403, 'forbidden'); for (const k of new Set([...Object.keys(old), ...Object.keys(next)])) if (JSON.stringify(old[k]) !== JSON.stringify(next[k]) && !allowed.includes(k)) throw this.err('Solo podés marcar tu avance en este elemento', 403, 'forbidden'); }
    }
    r.data = next; if (body.visibility && r.created_by === this.who) r.visibility = body.visibility === 'private' ? 'private' : 'family'; if (m.role === 'guardian' && 'student_id' in body) r.student_id = body.student_id; r.updated_by = this.who; r.updated_at = this.ts(); return { record: this.out(r), server_time: r.updated_at };
  },
};

/* ---------- datos ficticios ---------- */
function demoSeed(kind) {
  const t0 = D.str(new Date()); const d = (n) => D.add(t0, n); const dow0 = D.dow(t0);
  const recs = []; let tk = Date.now() - 100000;
  const add = (type, sid, data, o = {}) => { const r = { id: uid(), family_id: 'demo', type, student_id: sid, data, visibility: o.vis || 'family', created_by: o.by || 1, updated_by: o.by || 1, created_at: tk, updated_at: ++tk, deleted: false }; recs.push(r); return r.id; };
  const next = (dow, off = 0) => { let x = d(off); while (D.dow(x) !== dow) x = D.add(x, 1); return x; };
  const periods = (sid) => {
    add('period', null, { name: kind === 'adult' ? '1.er cuatrimestre' : '2.º trimestre', kind: 'periodo', from: d(-45), to: d(40) });
    add('period', null, { name: kind === 'adult' ? 'Receso de invierno' : 'Vacaciones de invierno', kind: 'vacaciones', from: d(56), to: d(70) });
    add('period', null, { name: 'Día no laborable', kind: 'feriado', from: d(17), to: d(17) });
    add('period', null, { name: 'Inscripción a materias del próximo período', kind: 'inscripcion', from: d(30), to: d(34) });
    add('period', null, { name: '1.er trimestre (cerrado)', kind: 'periodo', from: d(-160), to: d(-60), archived: true });
  };
  if (kind === 'adult') {
    const sid = 'valeria'; periods(sid);
    const tProf = [add('teacher', null, { name: 'Prof. Lucía Ferrari', email: 'lferrari@ejemplo.test' }), add('teacher', null, { name: 'Dr. Martín Bustos' }), add('teacher', null, { name: 'Prof. Anne Collins' }), add('teacher', null, { name: 'Lic. Raúl Quiroga' })];
    const sub = { est: add('subject', sid, { name: 'Estadística II', color: 0, teacherId: tProf[0], room: 'Aula 12', recup: 'replace' }), der: add('subject', sid, { name: 'Derecho Civil', color: 3, teacherId: tProf[1], room: 'Aula 4', recup: 'max' }), ing: add('subject', sid, { name: 'Inglés intermedio', color: 5, teacherId: tProf[2], room: 'Lab. idiomas', recup: 'replace' }), eco: add('subject', sid, { name: 'Economía', color: 1, teacherId: tProf[3], room: 'Aula 8', recup: 'avg' }) };
    const sl = (s, dow, a, b, o = {}) => add('slot', sid, { subjectId: sub[s], dow, start: a, end: b, room: '', recur: 'weekly', from: d(-45), to: '', ...o });
    sl('est', 1, '18:00', '20:00'); sl('der', 2, '18:30', '20:30'); sl('eco', 3, '19:00', '21:00'); sl('est', 4, '18:00', '19:30'); sl('ing', 6, '10:00', '12:00', { recur: 'biweekly' });
    const ex1 = add('exam', sid, { title: 'Parcial 1 — Inferencia', subjectId: sub.est, kind: 'exam', date: d(6), time: '18:30', weight: 2, room: 'Aula 12', topics: [{ t: 'Intervalos de confianza', diff: 2, done: true }, { t: 'Test de hipótesis', diff: 3, done: false }, { t: 'Distribución t de Student', diff: 2, done: false }, { t: 'Regresión simple', diff: 3, done: false }] });
    const exOld = add('exam', sid, { title: 'Parcial 1 — Contratos', subjectId: sub.der, kind: 'exam', date: d(-12), time: '19:00', weight: 1, grade: 4, topics: [] });
    add('exam', sid, { title: 'Recuperatorio — Contratos', subjectId: sub.der, kind: 'recup', parentId: exOld, date: d(9), time: '19:00', topics: [{ t: 'Formación del contrato', diff: 2, done: false }, { t: 'Vicios del consentimiento', diff: 3, done: false }] });
    add('exam', sid, { title: 'Quiz de vocabulario', subjectId: sub.ing, kind: 'exam', date: d(-20), weight: 1, grade: 8.5, topics: [] });
    add('exam', sid, { title: 'Parcial domiciliario', subjectId: sub.eco, kind: 'exam', date: d(-25), weight: 2, grade: 7, topics: [] });
    add('task', sid, { title: 'Guía de ejercicios 3 (muestreo)', subjectId: sub.est, kind: 'tarea', due: d(1) + 'T12:00', priority: 'alta', estimateMin: 90, status: 'en proceso', deliver: true, steps: [{ t: 'Ejercicios 1 a 4', done: true }, { t: 'Ejercicios 5 a 8', done: false }, { t: 'Revisar con la calculadora', done: false }], links: [{ t: 'Tablas estadísticas', url: 'https://example.com/tablas' }] });
    add('task', sid, { title: 'Informe de lectura: Capítulo 7', subjectId: sub.der, kind: 'trabajo práctico', due: d(-1) + 'T20:00', priority: 'media', status: 'terminada', deliver: true, steps: [] });
    add('task', sid, { title: 'Ensayo de 300 palabras', subjectId: sub.ing, kind: 'tarea', due: d(3), priority: 'media', estimateMin: 60, status: 'pendiente', deliver: true });
    add('task', sid, { title: 'Ficha de lectura (Mankiw, cap. 4)', subjectId: sub.eco, kind: 'lectura', due: d(2), priority: 'baja', estimateMin: 40, status: 'pendiente', deliver: false });
    add('task', sid, { title: 'Práctica de reportes orales', subjectId: sub.ing, kind: 'práctica', due: d(-4), priority: 'baja', status: 'entregada', deliver: true, grade: 9, weight: 1 });
    add('material', sid, { name: 'Calculadora científica', subjectId: sub.est, recur: 'none', needDate: d(6), status: 'tenemos' });
    add('material', sid, { name: 'Código Civil comentado', subjectId: sub.der, recur: 'weekly', dow: 3, status: 'conseguir', note: 'Edición actualizada', log: [] });
    add('material', sid, { name: 'Tablas estadísticas impresas', subjectId: sub.est, recur: 'none', needDate: d(1), status: 'conseguir' });
    const n1 = add('note', sid, { title: 'Test de hipótesis: pasos', html: '<h3>Pasos del test</h3><ul><li>Plantear H0 y H1</li><li>Elegir nivel de significación (α)</li><li>Calcular el estadístico</li></ul><div class="ck done">Releer ejemplo del profe</div><div class="ck">Hacer 3 ejercicios de la guía</div>', subjectId: sub.est, examId: ex1, date: d(-2), topic: 'Test de hipótesis', tags: ['parcial', 'repaso'], fav: true, files: [], links: [{ t: 'Video de apoyo', url: 'https://example.com/video' }] });
    add('note', sid, { title: 'Preguntas para la clase', html: '<p>Consultar si el parcial permite tablas impresas.</p>', subjectId: sub.est, tags: [], fav: false, files: [], links: [] });
    add('question', sid, { text: '¿El parcial permite usar tablas impresas?', subjectId: sub.est, noteId: n1, done: false });
    add('quiz', sid, { q: '¿Qué significa un p-valor menor que α?', a: 'Se rechaza la hipótesis nula: hay evidencia en contra de H0.', subjectId: sub.est, box: 1 });
    add('quiz', sid, { q: '¿Cuándo se usa la t de Student en lugar de la normal?', a: 'Cuando σ es desconocida y la muestra es chica.', subjectId: sub.est, box: 2 });
    add('event', sid, { title: 'Entrega de certificados', date: d(12), time: '11:00', note: 'Secretaría académica' });
    add('plan', sid, { days: [1, 2, 3, 4, 5, 6], from: '16:00', to: '18:00', sessionMin: 40, breakMin: 10 });
    return { users: [{ id: 1, name: 'Valeria', settings: { theme: 'ocean', mode: 'auto', textSize: 'm', hour12: false, weekStart: 1, tz: 'America/Argentina/Buenos_Aires', notif: { email: false } } }], students: [{ id: sid, name: 'Valeria', level: 'Universidad', institution: 'Universidad de Ejemplo', grade: '2.º año', division: 'Comisión B', shift: 'Noche', tz: 'America/Argentina/Buenos_Aires', settings: {}, updated_at: Date.now(), deleted: false }], members: [{ user_id: 1, role: 'guardian', student_id: null }], mode: 'self', recs, first: sid };
  }
  /* Familia */
  periods(); const so = 'sofia', to = 'tomas'; const tS = {}, tT = {};
  const t1 = add('teacher', null, { name: 'Prof. Graciela Núñez' }), t2 = add('teacher', null, { name: 'Prof. Hernán Ibarra' }), t3 = add('teacher', null, { name: 'Seño Marta' }), t4 = add('teacher', null, { name: 'Prof. Diego Salas' });
  const sS = { mat: add('subject', so, { name: 'Matemática', color: 0, teacherId: t1, room: 'Aula 21', recup: 'replace' }), len: add('subject', so, { name: 'Lengua', color: 4, teacherId: t2, room: 'Aula 21', recup: 'replace' }), cie: add('subject', so, { name: 'Biología', color: 2, teacherId: t4, room: 'Laboratorio', recup: 'max' }), edf: add('subject', so, { name: 'Educación Física', color: 6, teacherId: t4, room: 'Gimnasio' }) };
  const sT = { mat: add('subject', to, { name: 'Matemática', color: 0, teacherId: t3, room: 'Aula 4.º B', recup: 'replace' }), pra: add('subject', to, { name: 'Prácticas del lenguaje', color: 4, teacherId: t3, room: 'Aula 4.º B' }), pla: add('subject', to, { name: 'Plástica', color: 7, teacherId: t3, room: 'Taller' }) };
  const days = [1, 2, 3, 4, 5];
  for (const dw of days) { add('slot', so, { subjectId: sS.mat, dow: dw, start: '07:45', end: '08:45', room: 'Aula 21', recur: 'weekly', from: d(-45), to: '' }); }
  add('slot', so, { subjectId: sS.len, dow: 1, start: '09:00', end: '10:30', room: 'Aula 21', recur: 'weekly', from: d(-45), to: '' }); add('slot', so, { subjectId: sS.len, dow: 3, start: '09:00', end: '10:00', recur: 'weekly', from: d(-45), to: '' });
  add('slot', so, { subjectId: sS.cie, dow: 2, start: '09:00', end: '11:00', room: 'Laboratorio', recur: 'biweekly', from: d(-47), to: '' }); add('slot', so, { subjectId: sS.cie, dow: 4, start: '09:00', end: '10:30', recur: 'weekly', from: d(-45), to: '' });
  add('slot', so, { subjectId: sS.edf, dow: 3, start: '11:00', end: '12:30', room: 'Gimnasio', recur: 'weekly', from: d(-45), to: '' });
  [1, 2, 3, 4, 5].forEach((dw) => add('slot', to, { subjectId: sT.mat, dow: dw, start: '13:30', end: '14:30', room: 'Aula 4.º B', recur: 'weekly', from: d(-45), to: '' })); add('slot', to, { subjectId: sT.pra, dow: 2, start: '14:45', end: '16:00', recur: 'weekly', from: d(-45), to: '' }); add('slot', to, { subjectId: sT.pla, dow: 3, start: '14:45', end: '16:15', room: 'Taller', recur: 'weekly', from: d(-45), to: '' });
  const exOld = add('exam', so, { title: 'Prueba de fracciones', subjectId: sS.mat, kind: 'exam', date: d(-10), time: '07:45', weight: 1, grade: 4, topics: [] });
  add('exam', so, { title: 'Recuperatorio de fracciones', subjectId: sS.mat, kind: 'recup', parentId: exOld, date: d(5), time: '07:45', topics: [{ t: 'Suma y resta de fracciones', diff: 2, done: true }, { t: 'Fracciones equivalentes', diff: 1, done: false }, { t: 'Problemas con fracciones', diff: 3, done: false }] });
  add('exam', so, { title: 'Evaluación de la célula', subjectId: sS.cie, kind: 'exam', date: d(11), time: '09:00', weight: 2, topics: [{ t: 'Partes de la célula', diff: 1, done: false }, { t: 'Mitosis', diff: 3, done: false }, { t: 'Célula animal vs. vegetal', diff: 2, done: false }] });
  add('exam', to, { title: 'Prueba de multiplicación', subjectId: sT.mat, kind: 'exam', date: d(4), time: '13:30', topics: [{ t: 'Tablas del 6 al 9', diff: 2, done: false }] });
  add('task', so, { title: 'Problemas 4 a 9 (pág. 58)', subjectId: sS.mat, kind: 'tarea', due: d(1) + 'T07:45', priority: 'alta', estimateMin: 45, status: 'pendiente', deliver: true, steps: [{ t: 'Leer el ejemplo', done: true }, { t: 'Resolver 4 a 6', done: false }, { t: 'Resolver 7 a 9', done: false }] });
  add('task', so, { title: 'Comentario del cuento “El almohadón de plumas”', subjectId: sS.len, kind: 'trabajo práctico', due: d(-2), priority: 'media', status: 'terminada', deliver: true });
  add('task', so, { title: 'Maqueta de la célula', subjectId: sS.cie, kind: 'proyecto', due: d(9), priority: 'media', estimateMin: 120, status: 'pendiente', deliver: true });
  add('task', to, { title: 'Copiar y resolver las cuentas', subjectId: sT.mat, kind: 'tarea', due: d(1) + 'T13:30', priority: 'media', status: 'pendiente', deliver: true });
  add('task', to, { title: 'Leer 10 minutos', subjectId: sT.pra, kind: 'lectura', due: d(0), priority: 'baja', status: 'pendiente', deliver: false });
  add('material', so, { name: 'Ropa de gimnasia y botella', subjectId: sS.edf, recur: 'weekly', dow: 3, status: 'conseguir', note: 'Todos los miércoles', log: [] });
  add('material', to, { name: 'Témperas y pinceles', subjectId: sT.pla, recur: 'weekly', dow: 3, status: 'conseguir', log: [] });
  add('material', so, { name: 'Compás y transportador', subjectId: sS.mat, recur: 'none', needDate: d(1), status: 'tenemos' });
  add('event', null, { title: 'Reunión de padres', date: d(8), time: '18:30', note: 'Se entregan boletines' });
  add('plan', so, { days: [1, 2, 3, 4, 5], from: '16:30', to: '18:30', sessionMin: 35, breakMin: 10 });
  add('note', so, { title: 'Fracciones: lo que me cuesta', html: '<p>Me confundo al buscar el denominador común. Pedir a mamá que repasemos el sábado.</p>', subjectId: sS.mat, tags: ['mate'], files: [], links: [] }, { by: 2, vis: 'private' });
  add('help', so, { text: 'No entiendo cómo se suman fracciones con distinto denominador', subjectId: sS.mat, resolved: false }, { by: 2 });
  add('note', so, { title: 'Partes de la célula (resumen)', html: '<ul><li>Núcleo</li><li>Membrana</li><li>Citoplasma</li></ul>', subjectId: sS.cie, tags: ['bio'], fav: true, files: [], links: [] });
  add('quiz', so, { q: '¿Qué es el núcleo?', a: 'La parte de la célula que guarda el ADN.', subjectId: sS.cie, box: 1 });
  return { users: [{ id: 1, name: 'Marcos', settings: { theme: 'ocean', mode: 'auto', textSize: 'm', hour12: false, weekStart: 1, tz: 'America/Argentina/Buenos_Aires', notif: { email: false } } }, { id: 2, name: 'Sofía', settings: { theme: 'plum', mode: 'auto', textSize: 'm', hour12: false, weekStart: 1, tz: 'America/Argentina/Buenos_Aires', notif: { email: false } } }],
    students: [{ id: so, name: 'Sofía', level: 'Secundaria', institution: 'Colegio de Ejemplo', grade: '2.º año', division: 'B', shift: 'Mañana', tz: 'America/Argentina/Buenos_Aires', settings: {}, updated_at: Date.now(), deleted: false }, { id: to, name: 'Tomás', level: 'Primaria', institution: 'Escuela de Ejemplo', grade: '4.º grado', division: 'B', shift: 'Tarde', tz: 'America/Argentina/Buenos_Aires', settings: {}, updated_at: Date.now(), deleted: false }],
    members: [{ user_id: 1, role: 'guardian', student_id: null }, { user_id: 2, role: 'student', student_id: so }], mode: 'family', recs, first: so };
}
async function startDemo(kind, as = 1) {
  const s = demoSeed(kind);
  DemoApi.db = { users: s.users, students: s.students, members: kind === 'adult' ? s.members : s.members, records: s.recs, invites: [], family: { id: 'demo', name: kind === 'adult' ? 'Demo estudiante adulta' : 'Demo familia', mode: s.mode, settings: { scale: { min: 0, max: 10, pass: 6, decimals: 1 } } }, kind };
  DemoApi.who = as; S.recs = new Map(); S.since = 0; S.sid = null;
  const j = await api('GET', 'sync'); applySync(j); applyPrefs();
  if (as === 1 && !R('session').length) { try { await applyPlan(); } catch (e) { } }
  S.since = 0; await syncNow(true);
  go('hoy'); route();
}
async function demoSwitch(as) { DemoApi.who = as; S.recs = new Map(); S.since = 0; S.sid = null; await syncNow(true); applyPrefs(); S.sid = null; go('hoy'); route(); }
function demoBar() {
  const db = DemoApi.db; const fam = db?.kind === 'family';
  return h('div', { class: 'demobar', role: 'region', 'aria-label': 'Modo demostración' }, h('strong', null, 'DEMOSTRACIÓN'), h('span', { class: 'dtxt' }, ' · datos ficticios: nada se guarda ni se envía'), h('span', { class: 'sp' }),
    fam && h('label', null, 'Ver como ', h('select', { 'aria-label': 'Ver como', onchange: (e) => demoSwitch(Number(e.target.value)) }, h('option', { value: 1, selected: DemoApi.who === 1 }, 'Responsable (Marcos)'), h('option', { value: 2, selected: DemoApi.who === 2 }, 'Estudiante (Sofía)'))),
    db && h('button', { class: 'btn sm', onclick: () => startDemo(db.kind) }, 'Reiniciar'), db && h('button', { class: 'btn sm', onclick: () => doLogout() }, 'Cambiar escenario'));
}
function viewDemoChooser() {
  return h('main', { class: 'auth', id: 'main' }, h('div', { class: 'auth-card wide' }, h('div', { class: 'brand-lg' }, logoMark(22+4), h('span', null, BRAND.name)),
    h('h1', null, 'Probá la app'), h('p', { class: 'muted' }, 'Esta es una demostración con datos inventados. Podés tocar todo: no se guarda nada ni se envían correos. En la app real, cada cuenta empieza vacía.'),
    h('div', { class: 'choice' }, h('button', { class: 'ch', onclick: () => startDemo('adult') }, icon('user', 28), h('strong', null, 'Estudiante adulta'), h('span', null, 'Valeria cursa la universidad de noche: parciales, un recuperatorio, entregas pendientes y plan de estudio.')),
      h('button', { class: 'ch', onclick: () => startDemo('family') }, icon('users', 28), h('strong', null, 'Familia con dos hijos'), h('span', null, 'Sofía (secundaria) y Tomás (primaria): material de los miércoles, entrega pendiente, recuperatorio y acceso de estudiante.'))),
    h('p', { class: 'hint' }, 'Tip: con “Ver como” podés pasar de responsable a estudiante y comprobar qué puede cambiar cada uno.')));
}

'use strict';
/* ===== Versión de un solo archivo (pago único) =====
   Se usa solo cuando el HTML trae window.GAKU_LOCAL (lo inyecta descarga.php). En la app web y en la demo no hace nada.
   - Candado: clave de licencia (validada en el servidor, máx. 3 dispositivos) + contraseña local.
   - Datos: se guardan en este dispositivo (localStorage). Sin sincronización entre aparatos.
   - Pase a la suscripción: se exporta una copia y se importa en la cuenta web. */
const GL = window.GAKU_LOCAL || null;
const LSK = { dev: 'gaku_dev', lock: 'gaku_lock', tok: 'gaku_tok', data: 'gaku_data', bk: 'gaku_bk' };
const memStore = {};
const LSx = {
  get(k) { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return k in memStore ? memStore[k] : null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); delete memStore[k]; return true; } catch (e) { memStore[k] = v; return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } delete memStore[k]; },
};
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const LOC = { key: '', payload: null, dev: '', name: '' };

function deviceId() {
  let d = LSx.get(LSK.dev);
  if (!d || !/^[A-Za-z0-9_-]{16,64}$/.test(d)) { d = b64u(crypto.getRandomValues(new Uint8Array(24))); LSx.set(LSK.dev, d); }
  return d;
}
function deviceLabel() {
  const u = navigator.userAgent || ''; const os = /Windows/.test(u) ? 'Windows' : /Android/.test(u) ? 'Android' : /iPhone|iPad|iPod/.test(u) ? 'iOS' : /Mac OS X|Macintosh/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'Dispositivo';
  const br = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Navegador';
  return `${br} en ${os}`;
}
const normKey = (s) => { const t = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return t.startsWith('GAKU') && t.length === 16 ? `GAKU-${t.slice(4, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}` : String(s || '').trim().toUpperCase(); };

/* ---------- criptografía ---------- */
async function pbkdf(pw, salt, it) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: it, hash: 'SHA-256' }, k, 256));
}
async function makeLock(pw, name) { const salt = crypto.getRandomValues(new Uint8Array(16)); const it = 250000; return { salt: b64u(salt), it, hash: b64u(await pbkdf(pw, salt, it)), name }; }
async function checkPw(pw, lock) { const h2 = b64u(await pbkdf(pw, unb64u(lock.salt), lock.it)); let d = 0; for (let i = 0; i < h2.length || i < lock.hash.length; i++) d |= (h2.charCodeAt(i) || 0) ^ (lock.hash.charCodeAt(i) || 0); return d === 0; }
async function verifyToken(tok) {
  try {
    const [data, sig] = String(tok).split('.'); if (!data || !sig) return null;
    const key = await crypto.subtle.importKey('jwk', GL.pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64u(sig), new TextEncoder().encode(data));
    return ok ? JSON.parse(new TextDecoder().decode(unb64u(data))) : null;
  } catch (e) { return null; }
}

/* ---------- servidor de licencias ---------- */
async function licCall(a, key) {
  try {
    const r = await fetch(GL.api, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ a, k: key, d: LOC.dev, l: deviceLabel() }) });
    let j = null; try { j = await r.json(); } catch (e) { }
    return { net: false, ok: r.ok && j && j.ok, j: j || {} };
  } catch (e) { return { net: true, ok: false, j: {} }; }
}
async function storeToken(key, token) { const p = await verifyToken(token); if (!p || p.d !== LOC.dev || p.k !== key) return false; LSx.set(LSK.tok, { key, token }); LOC.key = key; LOC.payload = p; return true; }
const BAD_LIC = new Set(['revoked', 'not_registered', 'bad_key', 'bad_device']);
let recheckBusy = false;
async function recheckNow(manual = false) {
  if (recheckBusy) return null; recheckBusy = true;
  try {
    const r = await licCall('check', LOC.key);
    if (r.net) return manual ? { err: 'No hay conexión con internet. Probá de nuevo cuando la tengas.' } : null;
    if (r.ok && r.j.token) { await storeToken(LOC.key, r.j.token); return { ok: true }; }
    if (BAD_LIC.has(r.j.error)) { LSx.del(LSK.tok); LSx.set('gaku_msg', r.j.message || 'Esta licencia ya no está activa en este dispositivo.'); location.reload(); return { err: r.j.message }; }
    return manual ? { err: r.j.message || 'No se pudo validar ahora.' } : null;
  } finally { recheckBusy = false; }
}

/* ---------- pantallas del candado ---------- */
function gateShell(title, ...kids) {
  return h('main', { class: 'auth lockcard', id: 'main' }, h('div', { class: 'auth-card' }, h('div', { class: 'brand-lg' }, logoMark(30), h('span', null, 'Gaku')), h('h1', null, title), ...kids));
}
function gateField(id, label, type, extra = {}) { const i = h('input', { type, id, required: true, ...extra }); return [h('div', { class: 'field' }, h('label', { for: id }, label), i), i]; }
function mount(el) { const r = $('#root'); clear(r); r.append(el); const f = el.querySelector('input'); if (f) setTimeout(() => f.focus(), 30); }
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function screenActivate(done, note) {
  const lock = LSx.get(LSK.lock); const err = errBox(); const ok = h('p', { class: 'okmsg', hidden: true });
  const [fk, ik] = gateField('lk', 'Tu clave de licencia', 'text', { autocomplete: 'off', placeholder: 'GAKU-XXXX-XXXX-XXXX', spellcheck: false, autocapitalize: 'characters' });
  const [fn, inm] = lock ? [null, null] : gateField('ln', '¿Cómo te llamás?', 'text', { autocomplete: 'name', maxlength: 80 });
  const [fp, ip] = lock ? [null, null] : gateField('lp', 'Elegí una contraseña (mínimo 8 caracteres)', 'password', { autocomplete: 'new-password', minlength: 8 });
  const [fp2, ip2] = lock ? [null, null] : gateField('lp2', 'Repetí la contraseña', 'password', { autocomplete: 'new-password', minlength: 8 });
  const btn = h('button', { class: 'btn primary block' }, 'Activar en este dispositivo');
  const submit = async (e) => {
    e.preventDefault(); err.hidden = true;
    const key = normKey(ik.value);
    if (!lock) { if (ip.value.length < 8) return showErr(err, 'La contraseña debe tener al menos 8 caracteres.'); if (ip.value !== ip2.value) return showErr(err, 'Las contraseñas no coinciden.'); if (!inm.value.trim()) return showErr(err, 'Escribí tu nombre.'); }
    btn.disabled = true; btn.textContent = 'Activando…';
    const r = await licCall('activate', key);
    btn.disabled = false; btn.textContent = 'Activar en este dispositivo';
    if (r.net) return showErr(err, 'Para activar necesitás internet (solo esta primera vez y cada tanto para renovar el permiso).');
    if (!r.ok || !r.j.token) {
      let m = r.j.message || 'No se pudo activar.';
      if (r.j.error === 'limit' && Array.isArray(r.j.devices) && r.j.devices.length) m += ' Dispositivos activos: ' + r.j.devices.map((d) => d.label || 'Dispositivo').join(', ') + '.';
      return showErr(err, m);
    }
    if (!(await storeToken(key, r.j.token))) return showErr(err, 'La respuesta del servidor no se pudo verificar. Descargá de nuevo el archivo desde tu enlace.');
    LSx.del('gaku_msg');
    if (!lock) { const lk = await makeLock(ip.value, inm.value.trim()); LSx.set(LSK.lock, lk); LOC.name = lk.name; done(true); }
    else { LOC.name = lock.name; mount(screenUnlock(done)); }
  };
  mount(gateShell('Activar Gaku', note && h('p', { class: 'warnbox' }, icon('alert', 16), ' ', note),
    h('p', { class: 'muted' }, lock ? 'Este dispositivo necesita validar tu licencia de nuevo.' : 'Ingresá la clave que te enviamos y creá la contraseña con la que vas a abrir tus datos en este dispositivo.'),
    h('form', { class: 'form', onsubmit: submit }, fk, fn, fp, fp2, err, btn),
    h('p', { class: 'fine' }, 'La clave funciona en hasta 3 dispositivos. Tus datos se guardan solo en este aparato, no en internet.'),
    GL.wa && h('p', { class: 'fine' }, '¿Problemas? ', h('a', { href: 'https://wa.me/' + GL.wa, target: '_blank', rel: 'noopener' }, 'Escribinos por WhatsApp'))));
}
let badTries = 0;
function screenUnlock(done) {
  const lock = LSx.get(LSK.lock); const err = errBox();
  const [fp, ip] = gateField('up', 'Contraseña', 'password', { autocomplete: 'current-password' });
  const submit = async (e) => {
    e.preventDefault(); err.hidden = true;
    if (badTries >= 5) await wait(Math.min(15000, 1000 * (badTries - 3)));
    if (await checkPw(ip.value, lock)) { badTries = 0; LOC.name = lock.name; done(false); }
    else { badTries++; showErr(err, 'Contraseña incorrecta.'); ip.select(); }
  };
  return gateShell(`Hola${lock.name ? ', ' + lock.name.split(' ')[0] : ''}`, h('p', { class: 'muted' }, 'Ingresá tu contraseña para abrir tus datos.'),
    h('form', { class: 'form', onsubmit: submit }, fp, err, h('button', { class: 'btn primary block' }, 'Abrir')),
    h('p', { class: 'links' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); mount(screenResetPw(done)); } }, 'Olvidé mi contraseña')));
}
function screenResetPw(done) {
  const lock = LSx.get(LSK.lock); const tok = LSx.get(LSK.tok); const err = errBox();
  const [fk, ik] = gateField('rk', 'Tu clave de licencia', 'text', { autocomplete: 'off', placeholder: 'GAKU-XXXX-XXXX-XXXX', autocapitalize: 'characters' });
  const [fp, ip] = gateField('rp', 'Contraseña nueva (mínimo 8)', 'password', { autocomplete: 'new-password', minlength: 8 });
  const submit = async (e) => {
    e.preventDefault(); err.hidden = true;
    if (!tok || normKey(ik.value) !== tok.key) return showErr(err, 'Esa clave no corresponde a esta licencia.');
    if (ip.value.length < 8) return showErr(err, 'La contraseña debe tener al menos 8 caracteres.');
    LSx.set(LSK.lock, await makeLock(ip.value, lock?.name || '')); toast('Contraseña cambiada'); mount(screenUnlock(done));
  };
  return gateShell('Nueva contraseña', h('p', { class: 'muted' }, 'Con tu clave de licencia podés crear otra contraseña. Tus datos no se pierden.'),
    h('form', { class: 'form', onsubmit: submit }, fk, fp, err, h('button', { class: 'btn primary block' }, 'Guardar contraseña')), h('p', { class: 'links' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); mount(screenUnlock(done)); } }, 'Volver')));
}
function screenExpired(done) {
  const err = errBox();
  const btn = h('button', { class: 'btn primary block', onclick: async () => { btn.disabled = true; err.hidden = true; const r = await recheckNow(true); btn.disabled = false; if (r?.ok) done(false); else if (r?.err) showErr(err, r.err); } }, 'Validar ahora');
  return gateShell('Falta renovar el permiso', h('p', null, 'Hace más de ' + Math.round((GL.offlineDays || 35)) + ' días que este dispositivo no se conecta a internet para validar tu licencia. Conectate y tocá el botón: tus datos siguen intactos.'), err, btn);
}

/* Devuelve una promesa que se resuelve cuando el candado se abrió. */
function localGate() {
  return new Promise(async (resolve) => {
    if (!window.crypto?.subtle) { mount(gateShell('Navegador no compatible', h('p', null, 'Este navegador no permite la protección que usa Gaku. Probá abrir el archivo con Chrome, Edge, Firefox o Safari actualizados.'))); return; }
    LOC.dev = deviceId();
    const finish = (first) => { LOC.first = first; resolve(); };
    const lock = LSx.get(LSK.lock); const tok = LSx.get(LSK.tok); const msg = LSx.get('gaku_msg');
    const p = tok ? await verifyToken(tok.token) : null;
    const good = p && p.d === LOC.dev && p.k === tok.key;
    if (!lock || !good) { if (tok && !good) LSx.del(LSK.tok); return screenActivate(finish, msg); }
    LOC.key = tok.key; LOC.payload = p; LOC.name = lock.name;
    if (p.exp * 1000 < Date.now()) { mount(screenExpired(finish)); return; }
    mount(screenUnlock(finish));
  });
}
/* tras abrir: renovar el permiso cada tanto sin molestar */
function localKeepAlive() {
  const due = () => LOC.payload && Date.now() / 1000 - LOC.payload.iat > (GL.recheck || 604800);
  if (due()) recheckNow(false);
  setInterval(() => { if (!document.hidden && due()) recheckNow(false); }, 6 * 3600 * 1000);
}
async function localRelease() {
  if (!(await confirmDlg('¿Desactivar este dispositivo?', 'Desactivar', true, 'Liberás un lugar de los 3. Tus datos quedan guardados acá, pero no se podrán abrir hasta que lo actives otra vez. Hacé una copia antes si querés llevártelos.'))) return;
  const r = await licCall('release', LOC.key);
  if (r.net) { toast('Necesitás internet para desactivar este dispositivo', 'bad'); return; }
  LSx.del(LSK.tok); location.reload();
}

/* ---------- datos locales ---------- */
const LocalApi = Object.create(DemoApi);
Object.assign(LocalApi, {
  db: null, who: 1, tick: Date.now(),
  newDb(name) { return { users: [{ id: 1, name: name || 'Yo', settings: { theme: 'ocean', mode: 'auto', textSize: 'm', hour12: false, weekStart: 1, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Argentina/Buenos_Aires', notif: { email: false } } }], students: [], members: [], records: [], invites: [], family: null }; },
  load(name) { const d = LSx.get(LSK.data); this.db = d && d.users ? d : this.newDb(name); this.db.invites = []; if (!d) this.persist(); },
  persist() { if (!LSx.set(LSK.data, this.db)) throw new ApiError('No hay espacio para guardar en este navegador. Hacé una copia de tus datos y liberá espacio.', 507, 'quota'); },
  meOut() {
    const u = this.user(); const m = this.member();
    return { user: { id: 1, email: 'Versión de un archivo', name: u.name, verified: true, settings: u.settings }, member: m ? { role: 'guardian', student_id: null, family_id: 'demo', is_owner: true } : null, family: this.db.family, csrf: 'local' };
  },
  exportAll() {
    return { app: 'Gaku', version: 1, exported_at: new Date().toISOString(), family: { name: this.db.family?.name || '', mode: this.db.family?.mode || 'self', settings: this.db.family?.settings || {} },
      students: this.db.students.filter((s) => !s.deleted).map((s) => JSON.parse(JSON.stringify(s))), records: this.db.records.filter((r) => !r.deleted).map((r) => this.out(r)) };
  },
  importAll(b) {
    const db = this.db; if (!Array.isArray(b.records) || !Array.isArray(b.students)) throw this.err('El archivo no parece una copia de Gaku', 422, 'bad_file');
    const t = this.ts();
    if (b.replace) db.records.forEach((r) => { if (!r.deleted) { r.deleted = true; r.updated_at = this.ts(); } });
    const map = {};
    for (const s of b.students) {
      const old = String(s.id || ''); let hit = db.students.find((x) => !x.deleted && (x.id === old || x.name.toLowerCase() === String(s.name || '').toLowerCase()));
      if (!hit) { hit = { id: /^[a-z0-9]{8,24}$/.test(old) && !db.students.some((x) => x.id === old) ? old : uid(), name: String(s.name || 'Estudiante').slice(0, 80), level: s.level || '', institution: s.institution || '', grade: s.grade || '', division: s.division || '', shift: s.shift || '', tz: s.tz || 'America/Argentina/Buenos_Aires', settings: s.settings || {}, updated_at: this.ts(), deleted: false }; db.students.push(hit); }
      map[old] = hit.id;
    }
    const types = ['period', 'subject', 'teacher', 'slot', 'exception', 'task', 'exam', 'note', 'material', 'event', 'session', 'quiz', 'question', 'help', 'bag', 'plan'];
    let n = 0;
    for (const r of b.records) {
      if (!r || !types.includes(r.type)) continue; let sid = r.student_id ?? null; if (sid !== null) { if (!map[sid]) continue; sid = map[sid]; }
      const id = /^[a-z0-9]{8,24}$/.test(String(r.id || '')) ? r.id : uid(); const ex = db.records.find((x) => x.id === id); const data = JSON.parse(JSON.stringify(r.data || {}));
      if (ex) { ex.data = data; ex.student_id = sid; ex.deleted = false; ex.updated_at = this.ts(); }
      else { const tt = this.ts(); db.records.push({ id, family_id: 'demo', type: r.type, student_id: sid, data, visibility: r.visibility === 'private' ? 'private' : 'family', created_by: 1, updated_by: 1, created_at: tt, updated_at: tt, deleted: false }); }
      n++;
    }
    return { ok: true, imported: n };
  },
  async call(method, path, body, params) {
    await Promise.resolve(); const [a] = path.split('/');
    if (path === 'meta') return { brand: BRAND, mail_configured: false, default_tz: this.db?.users?.[0]?.settings?.tz || 'America/Argentina/Buenos_Aires', open_registration: false, csrf: 'local', logged: true, local: true };
    if (path === 'auth/logout') return { ok: true, csrf: 'local' };
    if (path === 'auth/me') return this.meOut();
    if (path === 'auth/password') {
      const lock = LSx.get(LSK.lock); if (!(await checkPw(String(body?.old || ''), lock))) throw this.err('La contraseña actual no es correcta', 403, 'password');
      if (String(body?.new || '').length < 8) throw this.err('La contraseña debe tener al menos 8 caracteres', 422, 'password');
      LSx.set(LSK.lock, await makeLock(body.new, lock.name)); return { ok: true };
    }
    if (path === 'auth/delete') {
      const lock = LSx.get(LSK.lock); if (!(await checkPw(String(body?.password || ''), lock))) throw this.err('La contraseña no es correcta', 403, 'password');
      LSx.del(LSK.data); LSx.del(LSK.bk); setTimeout(() => location.reload(), 400); return { ok: true };
    }
    if (a === 'auth') throw this.err('Esto no está disponible en la versión de un archivo', 404);
    if (path === 'family/setup' && method === 'POST') {
      const db = this.db; if (db.family) throw this.err('Ya completaste la configuración', 409, 'exists');
      const mode = body.mode === 'family' ? 'family' : 'self'; const list = (body.students || []).slice(0, 12); if (!list.length) throw this.err('Agregá al menos un estudiante', 422, 'students');
      db.family = { id: 'demo', name: 'Familia de ' + db.users[0].name, mode, settings: { scale: { min: 0, max: 10, pass: 6, decimals: 1 } } };
      db.students = list.map((s) => ({ id: uid(), name: String(s.name || '').slice(0, 80) || 'Estudiante', level: s.level || '', institution: s.institution || '', grade: s.grade || '', division: s.division || '', shift: s.shift || '', tz: s.tz || db.users[0].settings.tz, settings: {}, updated_at: this.ts(), deleted: false }));
      db.members = [{ user_id: 1, role: 'guardian', student_id: null }]; this.persist();
      return { ...this.meOut(), first_student: db.students[0].id };
    }
    if (path === 'settings' && !this.db.family) { const u = this.user(); for (const k in (body || {})) if (k !== 'name') u.settings[k] = body[k]; if (body?.name) u.name = body.name; this.persist(); return this.meOut(); }
    if (!this.db.family) throw new ApiError('Falta la configuración inicial', 409, 'no_family');
    if (a === 'invites' || a === 'members') throw this.err('La versión de un archivo es para una sola persona. Para compartir con la familia o sincronizar entre aparatos, pasá a la suscripción.', 403, 'local');
    if (a === 'import') { const r = this.importAll(body || {}); this.persist(); return r; }
    if (a === 'files') throw this.err('Los adjuntos solo están en la versión con suscripción.', 403, 'local');
    if (a === 'reminders') throw this.err('Los avisos por correo solo están en la versión con suscripción.', 503, 'mail_off');
    const r = await DemoApi.call.call(this, method, path, body, params);
    if (method !== 'GET') this.persist();
    return r;
  },
});

/* ---------- copia de seguridad y pase a la suscripción ---------- */
function localBackup() {
  const data = LocalApi.exportAll(); const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `gaku-copia-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json` });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  LSx.set(LSK.bk, Date.now()); toast('Copia descargada. Guardala en un lugar seguro.'); document.querySelectorAll('.gk-bk').forEach((e) => e.remove());
}
function backupAgeDays() { const t = LSx.get(LSK.bk); return t ? Math.floor((Date.now() - t) / 86400000) : null; }
function localBanner() {
  if (!LOCAL) return null; const age = backupAgeDays(); const n = LocalApi.db?.records?.filter((r) => !r.deleted).length || 0;
  if (n < 5 || (age !== null && age < 14)) return null;
  return h('div', { class: 'gk-banner gk-bk', role: 'status' }, icon('download', 16), h('span', null, age === null ? 'Todavía no hiciste una copia de tus datos. Se guardan solo en este dispositivo.' : `Hace ${age} días que no hacés una copia de tus datos.`), h('span', { class: 'sp' }), h('button', { class: 'btn sm primary', onclick: localBackup }, 'Hacer copia ahora'));
}
function openUpgrade() {
  sheet('Pasar a la versión con sincronización', (close) => [
    h('p', null, 'Con la suscripción tus datos viven en tu cuenta y se ven al instante en el celular, la tablet y la computadora. Además podés invitar a tu familia y recibir avisos por correo.'),
    h('ol', { class: 'steps' }, h('li', null, h('strong', null, 'Descargá tu copia. '), 'Incluye todo lo que cargaste.'), h('li', null, h('strong', null, 'Suscribite. '), 'Creás tu cuenta con tu correo y una contraseña.'), h('li', null, h('strong', null, 'Importá la copia. '), 'En la app web: Ajustes → Importar copia.')),
    h('p', { class: 'hint' }, 'Tu archivo y tu licencia siguen funcionando: no se borra nada de acá.'),
    h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: localBackup }, icon('download', 16), '1. Descargar mi copia'), GL.plan && h('a', { class: 'btn primary', href: GL.plan, target: '_blank', rel: 'noopener', onclick: () => { } }, icon('link', 16), '2. Ver la suscripción'), h('button', { class: 'btn ghost', onclick: close }, 'Ahora no'))]);
}
function localCard() {
  const p = LOC.payload; const left = p ? Math.max(0, Math.floor((p.exp - Date.now() / 1000) / 86400)) : 0; const age = backupAgeDays();
  const k = LOC.key.replace(/^(GAKU-\w{4})-\w{4}-(\w{4})$/, '$1-····-$2');
  return h('section', { class: 'card lockcard' }, h('h2', null, 'Tu licencia de un archivo'),
    h('p', { class: 'muted' }, 'Licencia ', h('span', { class: 'k' }, k), ' · ', deviceLabel()),
    h('p', { class: 'small muted' }, `Funciona sin internet por ${left} día(s) más; se renueva sola cuando hay conexión. Última copia: ${age === null ? 'nunca' : age === 0 ? 'hoy' : 'hace ' + age + ' día(s)'}.`),
    h('div', { class: 'btnrow wrap' }, h('button', { class: 'btn primary', onclick: localBackup }, icon('download', 16), 'Hacer copia de mis datos'), h('button', { class: 'btn', onclick: openUpgrade }, icon('repeat', 16), 'Pasar a la versión sincronizada'), h('button', { class: 'btn', onclick: async () => { const r = await recheckNow(true); toast(r?.ok ? 'Licencia validada' : (r?.err || 'No se pudo validar'), r?.ok ? undefined : 'bad'); route(); } }, icon('check', 16), 'Validar ahora'), h('button', { class: 'btn danger-o', onclick: localRelease }, icon('logout', 16), 'Desactivar este dispositivo')),
    h('p', { class: 'hint' }, 'Tus datos están solo en este navegador. Si cambiás de navegador, movés el archivo de lugar o borrás los datos del sitio, se pierden: por eso conviene hacer copias.'));
}

'use strict';
/* ===== Arranque y sincronización ===== */
let pollT = null;
function startPolling() {
  stopPolling(); if (NOSRV) return;
  pollT = setInterval(pollOnce, 15000);
}
function stopPolling() { clearInterval(pollT); pollT = null; }
async function pollOnce() {
  if (document.hidden || !S.me || !S.member || window.NOTE_EDITING) return;
  try { await syncNow(false); updateChrome(); } catch (e) { if (e.status === 401) { stopPolling(); S.me = S.member = null; applyPrefs(); toast('Tu sesión venció. Entrá de nuevo.', 'bad'); go('entrar'); } else updateChrome(); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) pollOnce(); });
window.addEventListener('online', () => { S.online = true; pollOnce(); });
window.addEventListener('offline', () => { S.online = false; updateChrome(); });
window.addEventListener('beforeunload', (e) => { if (saving.n > 0) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('error', (e) => { console.error(e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { const r = e.reason; if (r instanceof ApiError) return; console.error(r); });

(async function boot() {
  if (LOCAL) { Backend = LocalApi; await localGate(); LocalApi.load(LOC.name); localKeepAlive(); } else Backend = DEMO ? DemoApi : Remote;
  applyPrefs();
  const root = $('#root');
  try {
    const meta = await api('GET', 'meta'); S.meta = meta; S.csrf = meta.csrf;
    if (meta.logged && !DEMO) {
      try { await syncNow(true); } catch (e) { if (e.code === 'no_family') { const me = await api('GET', 'auth/me'); S.me = me.user; } else if (e.status !== 401) throw e; }
      applyPrefs(); startPolling();
    }
    const sid = lsGet('sid'); if (sid && S.students.some((s) => s.id === sid)) S.sid = sid;
  } catch (e) {
    clear(root); root.append(h('main', { class: 'auth' }, h('div', { class: 'auth-card' }, h('h1', null, 'No se pudo conectar'), h('p', null, e.message || 'Error de conexión'), h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Reintentar')))); return;
  }
  window.addEventListener('hashchange', () => { if (sheetStack.length) { sheetStack.forEach((o) => o.remove()); sheetStack = []; document.body.classList.remove('noscroll'); } route(); });
  if (DEMO && /[?&]embed=1/.test(location.search)) document.body.classList.add('embed');
  if (DEMO && /[?&]auto=1/.test(location.search) && !S.me) { try { await startDemo(/[?&]k=family/.test(location.search) ? 'family' : 'adult'); return; } catch (e) { } }
  route();
  if (!location.hash && S.me) go('hoy');
})();
