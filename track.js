/* Gaku · contador de la landing (sin cookies). Se carga con una línea antes de </body>:
   <script src="track.js" defer></script>
   Cuenta: visita, vio el precio, scroll 50% / 90%, click en "Suscribirme" (con el botón que tocó),
   click en WhatsApp y click en "Ya tengo cuenta". */
(function () {
  'use strict';
  var URL_TRACK = 'track.php';
  function enviar(t, d) {
    try {
      var q = new URLSearchParams(location.search);
      var body = JSON.stringify({ t: t, d: d || '', r: document.referrer || '', u: q.get('utm_source') || q.get('ref') || '', c: q.get('utm_campaign') || '', w: innerWidth });
      if (navigator.sendBeacon && navigator.sendBeacon(URL_TRACK, new Blob([body], { type: 'application/json' }))) return;
      fetch(URL_TRACK, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function () { });
    } catch (e) { }
  }
  var hechos = {};
  function una(t, d) { var k = t + (d || ''); if (hechos[k]) return; hechos[k] = 1; enviar(t, d); }

  // una visita por pestaña
  var yaVisto = false; try { yaVisto = sessionStorage.getItem('gk_v') === '1'; sessionStorage.setItem('gk_v', '1'); } catch (e) { }
  if (!yaVisto) enviar('visita');

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a,button'); if (!a) return;
    var d = a.getAttribute('data-t');
    if (d) { enviar(d, a.getAttribute('data-d') || ''); return; }
    var h = (a.getAttribute('href') || '');
    if (/wa\.me|whatsapp/i.test(h)) enviar('click_wa');
    else if (/app\.php/i.test(h)) enviar('click_app');
  }, true);

  function scroll() {
    var h = document.documentElement, p = (window.scrollY + innerHeight) / Math.max(1, h.scrollHeight);
    if (p >= .5) una('scroll50'); if (p >= .9) una('scroll90');
  }
  addEventListener('scroll', scroll, { passive: true });
  var dm = document.getElementById('demo');
  if (dm && 'IntersectionObserver' in window) { var io2 = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { una('demo'); io2.disconnect(); } }); }, { threshold: .3 }); io2.observe(dm); }
  var pr = document.getElementById('precio');
  if (pr && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { una('precio'); io.disconnect(); } }); }, { threshold: .4 });
    io.observe(pr);
  }
})();
