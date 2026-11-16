#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node scripts/prepare-html.mjs
node scripts/inject-config.mjs
npx tailwindcss -i assets/css/input.css -o assets/css/app.css --minify

rm -rf dist && mkdir -p dist/assets/css dist/assets/js
cp index.html dist/
cp assets/css/app.css dist/assets/css/
cp assets/js/config.js assets/js/contact.js dist/assets/js/
[ -d assets/media ] && cp -R assets/media dist/assets/media || true
[ -d public ] && cp -R public/. dist/ || true
for f in CNAME robots.txt sitemap.xml; do [ -f "$f" ] && cp "$f" dist/ || true; done
touch dist/.nojekyll

[ -s dist/assets/css/app.css ] || { echo "ERROR: app.css missing/empty" >&2; exit 1; }
[ -s dist/assets/js/config.js ] || { echo "ERROR: config.js missing/empty" >&2; exit 1; }
grep -q '__SUPABASE' dist/assets/js/config.js && { echo "ERROR: placeholders remain" >&2; exit 1; } || true
grep -qE 'sb_(secret|service)_' dist/assets/js/config.js && { echo "ERROR: secret key in bundle" >&2; exit 1; } || true
grep -q 'cdn.tailwindcss.com' dist/index.html && { echo "ERROR: Tailwind CDN still present" >&2; exit 1; } || true
[ -f dist/assets/js/config.template.js ] && { echo "ERROR: template leaked" >&2; exit 1; } || true

echo "✔ dist built: $(find dist -type f | wc -l) files, $(du -sb dist | cut -f1) bytes"
