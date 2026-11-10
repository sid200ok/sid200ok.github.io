// scripts/inject-config.mjs
// Generates assets/js/config.js from assets/js/config.template.js.
// Reads SUPABASE_URL / SUPABASE_ANON_KEY from:
//   1. process.env  (CI — GitHub Actions secrets)
//   2. .env file    (local dev — fallback)

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const tplPath = join(root, 'assets/js/config.template.js');

if (!existsSync(tplPath)) {
  throw new Error('missing assets/js/config.template.js');
}

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const dotenv = loadDotEnv(join(root, '.env'));

const url = (process.env.SUPABASE_URL ?? dotenv.SUPABASE_URL ?? '').trim();
const key = (process.env.SUPABASE_ANON_KEY ?? dotenv.SUPABASE_ANON_KEY ?? '').trim();

if (!url) throw new Error('SUPABASE_URL is empty — set it in .env or as an env var');
if (!key) throw new Error('SUPABASE_ANON_KEY is empty — set it in .env or as an env var');

if (!/^https:\/\/[A-Za-z0-9.-]+\.supabase\.(co|in)$/.test(url)) {
  throw new Error(`bad SUPABASE_URL: "${url}"`);
}

let role = 'unknown';

if (/^sb_(secret|service)_/.test(key)) {
  throw new Error('REFUSING: key is a SECRET / service key — never ship this to the browser');
}

if (/^sb_publishable_/.test(key)) {
  role = 'publishable';
} else if (/^sb_anon_/.test(key)) {
  role = 'anon';
} else if (key.startsWith('eyJ') && key.split('.').length === 3) {
  const seg = key.split('.');
  let payload;
  try {
    payload = JSON.parse(Buffer.from(seg[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('SUPABASE_ANON_KEY looks like a JWT but payload is unparseable');
  }
  if (!['anon', 'publishable', 'anonymous'].includes(payload.role)) {
    throw new Error(`REFUSING: JWT role=${payload.role} — must be anon/publishable`);
  }
  role = payload.role;
} else {
  throw new Error(
    `SUPABASE_ANON_KEY is neither a sb_publishable_…/sb_anon_… key nor a valid JWT (len=${key.length})`
  );
}

const destArg = process.argv[2];
const dest = destArg ? resolve(root, destArg) : join(root, 'assets/js/config.js');

const tpl = readFileSync(tplPath, 'utf8');
const out = tpl
  .replaceAll('__SUPABASE_URL__', url)
  .replaceAll('__SUPABASE_ANON_KEY__', key);

if (out.includes('__SUPABASE')) {
  throw new Error('unsubstituted placeholder remains in output');
}

mkdirSync(dirname(dest), { recursive: true });
const tmp = dest + '.tmp';
writeFileSync(tmp, out, 'utf8');
renameSync(tmp, dest);

console.log(`✔ config.js generated  (role=${role}, host=${new URL(url).hostname})`);
