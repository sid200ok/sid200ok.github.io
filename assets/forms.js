/* Portrox public form handler. Insert-only; server-side RLS is the security boundary. */
(function () {
  'use strict';
  var cfg = window.PORTROX;
  if (!cfg || !cfg.url || !cfg.key) return;
  if (/^sb_(secret|service)_/.test(cfg.key)) { console.error('[portrox] secret key refused'); return; }
  var MIN_MS = 3000;
  function wire(id, kind) {
    var f = document.getElementById(id);
    if (!f) return;
    var t0 = Date.now(), busy = false;
    var st = f.querySelector('[data-status]');
    var hp = f.querySelector('input[name=honeypot]');
    function set(m, ok) { if (st) { st.textContent = m; st.className = 'status ' + (ok ? 'ok' : 'err'); } }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      if (hp && hp.value.trim() !== '') { set('Message sent — thank you!', true); f.reset(); return; }
      if (Date.now() - t0 < MIN_MS) { set('Please take a moment before sending.', false); return; }
      var fd = new FormData(f), o = { site_id: cfg.site, kind: kind };
      ['full_name','email','message','slot'].forEach(function (k) {
        var v = (fd.get(k) || '').toString().trim();
        if (v) o[k] = v;
      });
      if (!o.full_name || !o.email || !o.message) { set('Name, email and message are required.', false); return; }
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email) === false) { set('Please enter a valid email.', false); return; }
      var btn = f.querySelector('button[type=submit]');
      busy = true; if (btn) btn.disabled = true; set('Sending…', true);
      var ac = new AbortController();
      var to = setTimeout(function () { ac.abort(); }, 15000);
      fetch(cfg.url + '/rest/v1/rpc/portrox_submit', {
        method: 'POST', signal: ac.signal,
        headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_site: o.site_id, p_kind: kind, p_full_name: o.full_name, p_email: o.email, p_message: o.message, p_slot: o.slot || null, p_honeypot: null })
      }).then(function (r) {
        clearTimeout(to);
        return r.json().catch(function () { return { ok: false }; }).then(function (j) {
          if (r.ok && j && j.ok) { set('Sent — thank you!', true); f.reset(); t0 = Date.now(); }
          else if (j && j.error === 'rate_limited') set('Too many requests. Please try later.', false);
          else set('Send failed. Please try later.', false);
        });
      }).catch(function (err) { clearTimeout(to); console.error('[portrox]', err); set('Network error. Please try later.', false); })
        .finally(function () { busy = false; if (btn) btn.disabled = false; });
    });
  }
  wire('contact-form', 'contact');
  wire('book-form', 'booking');
})();
