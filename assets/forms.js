/* Portrox public form handler. Insert-only; server-side RLS is the security boundary.
 *
 * Every refusal code the SQL can return is mapped to a sentence a visitor can act
 * on. Previously only slot_taken / past_slot / rate_limited were mapped, so the
 * eight codes added by availability enforcement fell through to "Booking failed.
 * Please try later." - which tells a visitor to retry a request that can never
 * succeed. scripts/verify-form-messages.mjs enumerates the codes from the LIVE
 * function bodies and fails if any of them is missing here.
 */
(function () {
  'use strict';
  var cfg = window.PORTROX;
  if (!cfg || !cfg.url || !cfg.key) return;
  if (/^sb_(secret|service)_/.test(cfg.key)) { console.error('[portrox] secret key refused'); return; }
  var MIN_MS = 3000;
  var MINUTES = Number(cfg.minutes) || 30;
  var CONTACT_FALLBACK = 'Please use the contact details on the About page.';

  var MSG = {
    /* intake, shared by both forms */
    rate_limited: 'Too many messages from this address. Please try again in about an hour.',
    site_busy: 'The inbox is very busy right now. Please try again shortly.',
    unknown_site: 'This form is not active. ' + CONTACT_FALLBACK,
    site_not_published: 'This form is not active. ' + CONTACT_FALLBACK,
    bad_kind: 'This form is not configured correctly. ' + CONTACT_FALLBACK,
    invalid_name: 'Please enter your name, up to 120 characters.',
    invalid_email: 'Please enter a valid email address.',
    invalid_message: 'Please write a message, up to 5000 characters.',
    /* booking */
    past_slot: 'Please pick a date and time in the future.',
    outside_availability: 'That time is outside the available windows listed above. Please pick a slot inside them.',
    off_grid: 'Please pick a start time in ' + MINUTES + '-minute steps inside the available windows.',
    bad_duration: 'Please choose a slot of ' + MINUTES + ' minutes.',
    slot_taken: 'That slot has just been taken. Please pick another.',
    too_many_pending: 'You already have three requests awaiting confirmation. Please wait for a reply before booking again.',
    availability_not_configured: 'Online booking is not set up yet. Please use the contact form and I will reply with times.',
    availability_no_rules: 'Online booking has no available hours yet. Please use the contact form.',
    availability_bad_rule: 'Online booking is temporarily unavailable. Please use the contact form.',
    availability_bad_timezone: 'Online booking is temporarily unavailable. Please use the contact form.',
    /* payment reference */
    bad_reference_length: 'Enter the full payment reference, 4 to 120 characters.',
    bad_reference_chars: 'A reference may contain letters, numbers, spaces and _ . / : # - only.',
    unknown_appointment: 'We could not find that booking. Please book a slot first.',
    reference_already_submitted: 'A reference was already sent for this booking. It is with the owner for verification.',
    cancelled: 'That booking was cancelled. Please book a new slot.'
  };

  /* Honest fallbacks: a refusal is NOT a transient fault, so never say "try later"
     for an unknown code. Log it so the owner can see what needs mapping. */
  function messageFor(j, fallback) {
    var code = j && j.error ? String(j.error) : '';
    if (code && MSG[code]) {
      if (code === 'outside_availability' && j.timezone) return MSG[code] + ' Times are shown in ' + j.timezone + '.';
      if (code === 'bad_duration' && j.expected_minutes) return 'Please choose a slot of ' + j.expected_minutes + ' minutes.';
      return MSG[code];
    }
    if (code) console.warn('[portrox] unmapped refusal code:', code);
    return fallback;
  }

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
          else set(messageFor(j, 'That message was not accepted. Please check your details and try again.'), false);
        });
      }).catch(function (err) { clearTimeout(to); console.error('[portrox]', err); set('Network error. Please try later.', false); })
        .finally(function () { busy = false; if (btn) btn.disabled = false; });
    });
  }
  wire('contact-form', 'contact');

  /* The booking form must BOOK. It previously called portrox_submit with kind
     'booking', which only wrote a message: no appointment, no slot lock, no
     timestamp, and the whole paid-booking path was unreachable by visitors. */
  function wireBook() {
    var f = document.getElementById('book-form');
    if (!f) return;
    var t0 = Date.now(), busy = false;
    var st = f.querySelector('[data-status]');
    var hp = f.querySelector('input[name=honeypot]');
    function set(m, ok) { if (st) { st.textContent = m; st.className = 'status ' + (ok ? 'ok' : 'err'); } }
    function post(fn, body) {
      return fetch(cfg.url + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); });
    }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      if (hp && hp.value.trim() !== '') { set('Request sent — thank you!', true); f.reset(); return; }
      if (Date.now() - t0 < MIN_MS) { set('Please take a moment before sending.', false); return; }
      var fd = new FormData(f);
      var name = (fd.get('full_name') || '').toString().trim();
      var email = (fd.get('email') || '').toString().trim();
      var msg = (fd.get('message') || '').toString().trim() || 'Booking request';
      var raw = (fd.get('starts_at') || '').toString();
      if (!name || !email || !raw) { set('Name, email and a slot are required.', false); return; }
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) === false) { set('Please enter a valid email.', false); return; }
      var when = new Date(raw);
      if (isNaN(when.getTime())) { set('Please pick a valid date and time.', false); return; }
      if (when.getTime() <= Date.now()) { set('Please pick a future slot.', false); return; }
      var btn = f.querySelector('button[type=submit]');
      busy = true; if (btn) btn.disabled = true; set('Booking…', true);
      post('portrox_book', { p_site: cfg.site, p_full_name: name, p_email: email, p_message: msg,
        p_starts_at: when.toISOString(), p_minutes: cfg.minutes || 30 })
        .then(function (j) {
          if (j && j.ok && j.appointment_id) {
            set('Booked — ' + (j.status === 'pending' ? 'awaiting payment confirmation.' : 'confirmed.')
                + (j.local ? ' (' + j.local + ')' : ''), true);
            f.reset(); t0 = Date.now();
            var box = document.getElementById('pay-ref');
            if (box) { box.hidden = false; box.setAttribute('data-appt', j.appointment_id); }
          } else {
            set(messageFor(j, 'That booking was not accepted. Please check the slot and try again.'), false);
          }
        })
        .catch(function (err) { console.error('[portrox]', err); set('Network error. Please try later.', false); })
        .finally(function () { busy = false; if (btn) btn.disabled = false; });
    });
    var send = document.getElementById('pay-ref-send');
    if (send) send.addEventListener('click', function () {
      var box = document.getElementById('pay-ref');
      var rs = box ? box.querySelector('[data-ref-status]') : null;
      var appt = box ? box.getAttribute('data-appt') : '';
      var val = (document.getElementById('pay-ref-val') || {}).value || '';
      function rset(m, ok) { if (rs) { rs.textContent = m; rs.className = 'status ' + (ok ? 'ok' : 'err'); } }
      if (!appt) { rset('Book a slot first.', false); return; }
      if (val.trim().length < 4) { rset('Enter the reference from your payment.', false); return; }
      rset('Sending…', true);
      post('portrox_payment_ref', { p_appointment: appt, p_ref: val.trim() })
        .then(function (j) {
          if (j && j.ok) rset('Reference received. The owner will verify and confirm.', true);
          else rset(messageFor(j, 'Could not send the reference. Please use the contact form.'), false);
        })
        .catch(function () { rset('Network error. Please try later.', false); });
    });
  }
  wireBook();
})();
