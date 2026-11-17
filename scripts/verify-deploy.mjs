import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const sh = (c, a) => spawnSync(c, a, { encoding: 'utf8' });
const sha = sh('git', ['rev-parse', 'HEAD']).stdout.trim();
if (sha.length < 7) { console.log('FAIL cannot read HEAD'); process.exit(1); }
console.log('HEAD ' + sha.slice(0, 8));

let run = null;
for (let i = 0; i < 40; i++) {
  const r = sh('gh', ['run','list','--workflow=deploy-pages.yml','--limit','20',
    '--json','databaseId,headSha,status,conclusion']);
  let rows = []; try { rows = JSON.parse(r.stdout || '[]'); } catch {}
  run = rows.find(x => x.headSha === sha) || null;
  if (run) break;
  await new Promise(r => setTimeout(r, 3000));
}
if (run === null) { console.log('FAIL no run matched HEAD after 120s'); process.exit(1); }
console.log('matched run ' + run.databaseId);
const w = sh('gh', ['run','watch',String(run.databaseId),'--exit-status']);
process.stdout.write(w.stdout || ''); process.stderr.write(w.stderr || '');
if (w.status !== 0) { console.log('FAIL deploy run failed'); process.exit(1); }

const page = sh('curl', ['-fsS','https://sid200ok.github.io/']);
if (page.status !== 0) { console.log('FAIL cannot fetch live page'); process.exit(1); }
writeFileSync('/tmp/live.html', page.stdout);
const s = page.stdout;
const checks = [
  ['new UI live (Basal Analytics)', s.includes('Basal Analytics')],
  ['no Tailwind Play CDN',          s.includes('cdn.tailwindcss.com') === false],
  ['compiled CSS linked',           s.includes('assets/css/app.css')],
  ['contact form present',          s.includes('id="contact-form"')],
  ['no malformed </div.>',          s.includes('</div.>') === false],
];
let bad = 0;
for (const [n, ok] of checks) { if (ok === false) bad++; console.log((ok ? 'OK   ' : 'FAIL ') + n); }
console.log(bad === 0 ? 'LIVE OK' : 'LIVE BAD');
process.exit(bad === 0 ? 0 : 1);
