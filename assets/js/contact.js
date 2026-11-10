// assets/js/contact.js
(function () {
  'use strict';

  const cfg = window.SID_CONFIG;

  if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error('[contact] SID_CONFIG missing — check config.js load order');
    return;
  }

  if (
    cfg.SUPABASE_ANON_KEY.startsWith('sb_secret_') ||
    cfg.SUPABASE_ANON_KEY.startsWith('sb_service_')
  ) {
    console.error('[contact] Refusing to run: secret/service key in browser config');
    return;
  }

  const form = document.getElementById('contact-form');
  if (!form) return;

  const FORM_OPEN_TS = Date.now();
  const MIN_ELAPSED_MS = 3000;

  let honeypot = form.querySelector('input[name="website"]');
  if (!honeypot) {
    honeypot = document.createElement('input');
    honeypot.type = 'text';
    honeypot.name = 'website';
    honeypot.tabIndex = -1;
    honeypot.autocomplete = 'off';
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.style.cssText = 'position:absolute;left:-9999px;top:-9999px;height:0;width:0;opacity:0;pointer-events:none';
    form.appendChild(honeypot);
  }

  let statusEl = form.querySelector('[data-contact-status]');
  if (!statusEl) {
    statusEl = document.createElement('p');
    statusEl.setAttribute('data-contact-status', '');
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.style.marginTop = '.5rem';
    form.appendChild(statusEl);
  }

  function setStatus(msg, ok) {
    statusEl.textContent = msg;
    statusEl.style.color = ok ? '#16a34a' : '#dc2626';
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  let submitting = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;

    const fd = new FormData(form);

    if (honeypot && honeypot.value.trim() !== '') {
      setStatus('Message sent — thank you!', true);
      form.reset();
      return;
    }

    if (Date.now() - FORM_OPEN_TS < MIN_ELAPSED_MS) {
      setStatus('Please take a moment before sending.', false);
      return;
    }

    const name    = (fd.get('name')    || '').toString().trim();
    const email   = (fd.get('email')   || '').toString().trim();
    const message = (fd.get('message') || '').toString().trim();

    if (!name || !email || !message) { setStatus('All fields are required.', false); return; }
    if (name.length > 120)           { setStatus('Name is too long.', false); return; }
    if (email.length > 254 || !validateEmail(email)) { setStatus('Please enter a valid email.', false); return; }
    if (message.length > 5000)       { setStatus('Message is too long.', false); return; }

    const btn = form.querySelector('button[type="submit"]');
    submitting = true;
    if (btn) btn.disabled = true;
    setStatus('Sending…', true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/contact_messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'apikey': cfg.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${cfg.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ name, email, message }),
      });

      clearTimeout(timeoutId);

      if (res.status === 201 || res.status === 204 || res.ok) {
        setStatus('Message sent — thank you!', true);
        form.reset();
      } else {
        const body = await res.text().catch(() => '');
        console.error('[contact] HTTP', res.status, body.slice(0, 300));
        if (res.status === 429)         setStatus('Too many requests. Try again later.', false);
        else if (res.status === 401 || res.status === 403) setStatus('Config error. Try again later.', false);
        else if (res.status === 404)    setStatus('Endpoint not found. Try again later.', false);
        else                            setStatus('Send failed. Try again later.', false);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[contact]', err);
      setStatus('Network error. Try again later.', false);
    } finally {
      submitting = false;
      if (btn) btn.disabled = false;
    }
  });
})();
