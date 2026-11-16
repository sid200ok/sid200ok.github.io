import { readFileSync, existsSync } from 'node:fs';
const p = 'dist/index.html';
if (!existsSync(p)) { console.log('FAIL dist/index.html missing'); process.exit(1); }
const s = readFileSync(p, 'utf8');
const checks = [
  ['no malformed </div.>',        s.includes('</div.>') === false],
  ['no stray </a> on icon',       s.includes('text-cyan-400"></a>') === false],
  ['lucide pinned',               s.includes('lucide@latest') === false],
  ['hero </p> closed',            /for global clients\.<\/p>/.test(s)],
  ['no Tailwind Play CDN',        s.includes('cdn.tailwindcss.com') === false],
  ['compiled CSS linked',         s.includes('assets/css/app.css')],
  ['contact form present',        s.includes('id="contact-form"')],
  ['config.js before contact.js', s.indexOf('assets/js/config.js') < s.indexOf('assets/js/contact.js')],
];
let bad = 0;
for (const [name, ok] of checks) { if (ok === false) bad++; console.log((ok ? 'OK   ' : 'FAIL ') + name); }
console.log(bad === 0 ? 'DIST OK' : 'DIST BAD');
process.exit(bad === 0 ? 0 : 1);
