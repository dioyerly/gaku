<?php
declare(strict_types=1);
/* Páginas públicas simples del servidor (alta, gracias, licencia): mismo estilo que Gaku. */
function gk_esc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function gk_stamp(int $size = 40): string { return ''; }  // sin logo: la marca es solo el nombre
function gk_page(string $title, string $body, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Frame-Options: DENY'); header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: same-origin'); header('X-Robots-Tag: noindex');
  header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' . gk_esc($title) . ' · Gaku</title><style>
:root{--paper:#f4f7f8;--card:#fff;--ink:#14232b;--mut:#55676f;--indigo:#0f6b7d;--ver:#3f8f6b;--line:#d3dfe3;--ok:#1f5b3b;--bad:#8d2416}
@media(prefers-color-scheme:dark){:root{--paper:#0e171c;--card:#15232a;--ink:#e8f1f4;--mut:#9db1ba;--indigo:#5cc0d2;--ver:#6cc79a;--line:#29414c;--ok:#7fd3a8;--bad:#ff9486}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;display:grid;place-items:center;padding:20px}
main{width:100%;max-width:460px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:28px 26px;box-shadow:0 18px 50px -28px rgba(27,32,48,.45)}
.logo{display:flex;align-items:center;gap:10px;margin-bottom:14px;font:700 1.6rem Georgia,"Times New Roman",serif;letter-spacing:.02em}
h1{font:700 1.55rem/1.2 Georgia,"Times New Roman",serif;margin:0 0 10px}p{margin:0 0 12px}
label{display:block;font-size:.86rem;font-weight:600;margin:14px 0 4px;color:var(--mut)}input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font:inherit}
button,a.b{display:inline-block;margin-top:16px;padding:12px 18px;border:0;border-radius:11px;background:var(--indigo);color:#fff;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
@media(prefers-color-scheme:dark){button,a.b{background:var(--indigo);color:#06222a}}
.o,.e,.n{padding:11px 14px;border-radius:11px;margin:0 0 14px;font-size:.95rem}.o{background:#e3f1e8;color:var(--ok)}.e{background:#fbe3de;color:var(--bad)}.n{background:#f3ead2;color:#6b5a1e}
@media(prefers-color-scheme:dark){.o{background:#1c3327}.e{background:#43211c}.n{background:#3a3418}}
.key{font:700 1.5rem ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;text-align:center;padding:14px;border:2px dashed var(--ver);border-radius:12px;margin:12px 0;user-select:all}
small,.m{color:var(--mut);font-size:.88rem}a{color:var(--indigo)}ol{padding-left:20px}
</style></head><body><main><div class="logo"><span>Gaku</span></div>' . $body . '</main></body></html>';
  exit;
}
