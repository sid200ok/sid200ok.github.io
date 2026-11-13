// assets/js/contact.js
// Final production-ready contact form handler with bot protection and correct schema mapping.
(function () {
  'use strict';

  const cfg = window.SID_CONFIG;

  if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error('[contact] SID_CONFIG missing — check config.js load order');
    return;
  }

  if (cfg.SUPABASE_ANON_KEY.startsWith('sb_secret_') || cfg.SUPABASE_ANON_KEY.startsWith('sb_service_')) {
    console.error('[contact] Refusing to run: secret/service key detected in browser config');
    return;
  }

  const form = document.getElementById('contact-form');
  if (!form) return;

  // Bot guard: record when form became interactive (min 3s required)
  const FORM_OPEN_TS = Date.now();
  const MIN_ELAPSED_MS = 3000;

  // Ensure honeypot exists (invisible to humans, filled by dumb bots)
  let honeypot = form.querySelector('input[name="honeypot"], input[name="website"]');
  if (!honeypot) {
    honeypot = document.createElement('input');
    honeypot.type = 'text';
    honeypot.name = 'honeypot';
    honeypot.tabIndex = -1;
    honeypot.autocomplete = 'off';
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.style.cssText = 'position:absolute;left:-9999px;top:-9999px;height:0;width:0;opacity:0;pointer-events:none';
    form.appendChild(honeypot);
  }

  // Ensure status element exists
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

    // Honeypot: if filled, behave as success but do NOT send to DB
    if (honeypot && honeypot.value.trim() !== '') {
      setStatus('Message sent — thank you!', true);
      form.reset();
      return;
    }

    // Timing guard: reject instant submissions (bots)
    if (Date.now() - FORM_OPEN_TS < MIN_ELAPSED_MS) {
      setStatus('Please take a moment before sending.', false);
      return;
    }

    // Accept 'full_name' or 'name' from HTML, but we will send 'full_name' to DB
    const fullName  = (fd.get('full_name') || fd.get('name') || '').toString().trim();
    const email     = (fd.get('email') || '').toString().trim();
    const message   = (fd.get('message') || '').toString().trim();

    if (!fullName || !email || !message) {
      setStatus('All fields are required.', false);
      return;
    }

    if (fullName.length > 120) {
      setStatus('Name is too long.', false);
      return;
    }

    if (email.length > 254 || !validateEmail(email)) {
      setStatus('Please enter a valid email.', false);
      return;
    }

    if (message.length > 5000) {
      setStatus('Message is too long.', false);
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    submitting = true;
    if (btn) btn.disabled = true;
    setStatus('Sending…', true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // CRITICAL: The database column is 'full_name', NOT 'name'
      const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/contact_messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'apikey': cfg.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${cfg.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ 
          full_name: fullName, 
          email: email, 
          message: message 
        }),
      });

      clearTimeout(timeoutId);

      if (res.status === 201 || res.status === 204 || res.ok) {
        setStatus('Message sent — thank you!', true);
        form.reset();
      } else {
        const body = await res.text().catch(() => '');
        console.error('[contact] HTTP', res.status, body.slice(0, 300));

        if (res.status === 429) {
          setStatus('Too many requests. Please try again later.', false);
        } else if (res.status === 401 || res.status === 403) {
          setStatus('Send failed due to configuration. Please try again later.', false);
        } else if (res.status === 404) {
          setStatus('Send failed: endpoint not found. Please try again later.', false);
        } else {
          setStatus('Send failed. Please try again later.', false);
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[contact]', err);
      setStatus('Network error. Please try again later.', false);
    } finally {
      submitting = false;
      if (btn) btn.disabled = false;
    }
  });
})();
