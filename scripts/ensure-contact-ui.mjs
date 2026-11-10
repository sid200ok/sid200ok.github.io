// scripts/ensure-contact-ui.mjs
// Idempotently ensures:
// 1. A contact form with id="contact-form" exists.
// 2. assets/js/config.js loads before assets/js/contact.js.
// It removes duplicate/incorrect config/contact script tags and reinserts canonical ones.

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const filePath = join(process.cwd(), 'index.html');
const original = readFileSync(filePath, 'utf8');

let html = original;

// Remove existing config.js / contact.js script tags to normalize order.
html = html.replace(
  /<script[^>]*\bsrc=["'][^"']*assets\/js\/(?:config|contact)\.js[^"']*["'][^>]*>\s*<\/script>/gi,
  ''
);

const contactSection = `
<section id="contact" class="contact-section" aria-labelledby="contact-heading">
  <h2 id="contact-heading">Contact</h2>
  <form id="contact-form" novalidate>
    <label for="contact-name">Name</label>
    <input id="contact-name" name="name" required maxlength="120" autocomplete="name">

    <label for="contact-email">Email</label>
    <input id="contact-email" name="email" type="email" required maxlength="254" autocomplete="email">

    <label for="contact-message">Message</label>
    <textarea id="contact-message" name="message" required maxlength="5000" rows="5"></textarea>

    <!-- Honeypot field: humans do not see/fill this -->
    <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"
           style="position:absolute;left:-9999px;top:-9999px;height:0;width:0;opacity:0">

    <button type="submit">Send message</button>
    <p data-contact-status role="status" aria-live="polite"></p>
  </form>
</section>
`;

// Insert contact section only if missing.
if (!/id=["']contact-form["']/i.test(html)) {
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${contactSection}\n</body>`);
  } else {
    html += `\n${contactSection}\n`;
  }
}

// Insert canonical scripts before </body>.
const scripts = `
<script src="assets/js/config.js"></script>
<script src="assets/js/contact.js"></script>
`;

if (/<\/body>/i.test(html)) {
  html = html.replace(/<\/body>/i, `${scripts}\n</body>`);
} else {
  html += scripts;
}

if (html !== original) {
  const tmp = filePath + '.tmp';
  writeFileSync(tmp, html, 'utf8');
  renameSync(tmp, filePath);
  console.log('index.html updated with contact form and correct script order.');
} else {
  console.log('index.html already ready.');
}
