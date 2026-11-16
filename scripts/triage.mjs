import { readFileSync, existsSync } from 'node:fs';
for (const [label, p] of [['TREE','/tmp/gl-tree.json'],['HISTORY','/tmp/gl-hist.json']]) {
  console.log('\n=== ' + label + ' ===');
  if (!existsSync(p)) { console.log('(no report)'); continue; }
  let rows = [];
  try { rows = JSON.parse(readFileSync(p,'utf8')) || []; } catch { console.log('(unparsable)'); continue; }
  if (rows.length === 0) { console.log('clean'); continue; }
  for (const r of rows) {
    console.log([
      'rule=' + r.RuleID,
      'file=' + r.File,
      'line=' + r.StartLine,
      'commit=' + (r.Commit || '-').slice(0,8),
      'entropy=' + Number(r.Entropy || 0).toFixed(2)
    ].join('  '));
    console.log('  match: ' + String(r.Match || '').replace(/\s+/g,' ').slice(0,160));
    console.log('  fingerprint: ' + (r.Fingerprint || '-'));
  }
}
