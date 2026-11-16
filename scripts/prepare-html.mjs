// Idempotent: remove Tailwind Play CDN + inline config, link compiled CSS,
// make Lucide non-blocking. Runs BEFORE tailwind build in CI.
import { readFileSync, writeFileSync } from 'node:fs';
const p = 'index.html';
let s = readFileSync(p, 'utf8');
const before = s;
const done = [];

if (s.includes('cdn.tailwindcss.com')) {
  s = s.replace(/[ \t]*<!--\s*Tailwind CSS[^>]*-->\s*\n?/g, '');
  s = s.replace(/[ \t]*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*\n?/g, '');
  s = s.replace(/[ \t]*<script>\s*tailwind\.config[\s\S]*?<\/script>\s*\n?/g, '');
  done.push('removed Tailwind Play CDN + inline config');
}
if (!s.includes('assets/css/app.css')) {
  s = s.replace(/([ \t]*<!-- Lucide Icons -->)/, '    <link rel="stylesheet" href="assets/css/app.css">\n\n$1');
  done.push('linked compiled assets/css/app.css');
}
if (/<script src="https:\/\/unpkg\.com\/lucide@[^"]+"><\/script>/.test(s) && !/<script defer src="https:\/\/unpkg\.com\/lucide@/.test(s)) {
  s = s.replace(/<script (src="https:\/\/unpkg\.com\/lucide@[^"]+")><\/script>/, '<script defer $1></script>');
  done.push('lucide -> defer');
}
if (/lucide\.createIcons\(\);/.test(s) && !s.includes('DOMContentLoaded')) {
  s = s.replace(/lucide\.createIcons\(\);/, "window.addEventListener('DOMContentLoaded', () => lucide.createIcons());");
  done.push('icon init deferred to DOMContentLoaded');
}
if (s !== before) { writeFileSync(p, s); console.log('PREPARED:\n - ' + done.join('\n - ')); }
else console.log('index.html already prepared');
