import { readFileSync } from 'node:fs';
const s = readFileSync('/tmp/live.html','utf8');
const t = [
  ['new UI live (Basal Analytics)', s.includes('Basal Analytics')],
  ['no Tailwind CDN live',          s.includes('cdn.tailwindcss.com') === false],
  ['compiled CSS live',             s.includes('assets/css/app.css')],
];
let bad = 0;
for (const [n, ok] of t) { if (ok === false) bad++; console.log((ok ? 'OK   ' : 'FAIL ') + n); }
process.exit(bad === 0 ? 0 : 1);
