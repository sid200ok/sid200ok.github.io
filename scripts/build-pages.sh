#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# 1. Ensure contact form + script order in index.html
if [[ -f scripts/ensure-contact-ui.mjs ]]; then
  node scripts/ensure-contact-ui.mjs
fi

# 2. Generate fresh config.js (fails hard if env/keys missing)
rm -f assets/js/config.js assets/js/config.js.tmp
node scripts/inject-config.mjs

# 3. Build dist/
rm -rf dist
mkdir -p dist

cp index.html dist/

mkdir -p dist/assets/js
cp assets/js/contact.js   dist/assets/js/
cp assets/js/config.js    dist/assets/js/

for item in assets/*/; do
  [[ "$item" == "assets/js/" ]] && continue
  cp -R "$item" "dist/${item}"
done

for f in assets/js/*; do
  base="$(basename "$f")"
  [[ "$base" == "config.template.js" ]] && continue
  [[ "$base" == "config.js.tmp" ]]      && continue
  [[ "$base" == "contact.js" ]]         && continue
  [[ "$base" == "config.js" ]]          && continue
  cp "$f" "dist/assets/js/$base"
done

if [[ -d public ]]; then
  cp -R public/. dist/
fi

[[ -f CNAME ]]       && cp CNAME dist/       || true
[[ -f robots.txt ]]  && cp robots.txt dist/  || true
[[ -f sitemap.xml ]] && cp sitemap.xml dist/ || true

touch dist/.nojekyll

# 4. Validate
if [[ ! -s dist/assets/js/config.js ]]; then
  echo "ERROR: dist/assets/js/config.js is missing or empty." >&2
  exit 1
fi

if grep -q '__SUPABASE' dist/assets/js/config.js; then
  echo "ERROR: dist/assets/js/config.js still contains placeholders." >&2
  exit 1
fi

if [[ -f dist/assets/js/config.template.js ]]; then
  echo "ERROR: config.template.js must not be in dist/." >&2
  rm -f dist/assets/js/config.template.js
  exit 1
fi

echo "✔ Built clean static artifact in dist/"
