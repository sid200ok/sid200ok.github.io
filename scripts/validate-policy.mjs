import { readFileSync } from 'node:fs';
const t = readFileSync('.gitleaks.toml','utf8');
const ruleBlocks = t.split('[[rules]]').slice(1);
let bad = 0;
for (const b of ruleBlocks) {
  const id = (b.match(/id\s*=\s*"([^"]+)"/) || [])[1] || '?';
  const rx = (b.match(/regex\s*=\s*'''([\s\S]*?)'''/) || [])[1] || '';
  const capturing = /\((?!\?:)/.test(rx);
  if (capturing) { bad++; console.log('FAIL capturing group in rule: ' + id); }
  else console.log('OK   non-capturing: ' + id);
}
const forbidden = ['(^|/)\\.env$','(^|/)dist/','assets/js/config\\.js$','supabase/config\\.toml$'];
for (const f of forbidden) {
  if (t.includes(f)) { bad++; console.log('FAIL forbidden path allowlist present: ' + f); }
}
console.log(bad === 0 ? 'POLICY OK' : 'POLICY BAD');
process.exit(bad === 0 ? 0 : 1);
