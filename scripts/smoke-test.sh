#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-https://sid200ok.github.io}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "═══ Smoke test: $BASE ═══"

tmpl_code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/assets/js/config.template.js" || true)"
if [[ "$tmpl_code" == "200" ]]; then
  echo "FAIL: config.template.js is publicly served"
  exit 1
fi
echo "PASS: config.template.js not exposed"

cfg_code="$(curl -sS -o "$TMP/config.js" -w '%{http_code}' "$BASE/assets/js/config.js")"
if [[ "$cfg_code" != "200" ]]; then
  echo "FAIL: config.js returned HTTP $cfg_code"; exit 1
fi
if grep -q '__SUPABASE' "$TMP/config.js"; then
  echo "FAIL: config.js still has placeholders"; exit 1
fi

URL="$(sed -n 's/.*SUPABASE_URL:[[:space:]]*"\([^"]*\)".*/\1/p' "$TMP/config.js")"
KEY="$(sed -n 's/.*SUPABASE_ANON_KEY:[[:space:]]*"\([^"]*\)".*/\1/p' "$TMP/config.js")"

if [[ -z "$URL" || -z "$KEY" ]]; then
  echo "FAIL: empty injected values"; exit 1
fi
if [[ "$KEY" == sb_secret_* || "$KEY" == sb_service_* ]]; then
  echo "FAIL: secret key in public config"; exit 1
fi
echo "PASS: config.js loaded"

email="smoke-$(date +%s)-$RANDOM@example.com"
payload="$(printf '{"name":"smoke","email":"%s","message":"deploy smoke test"}' "$email")"

insert_code="$(
  curl -sS -o "$TMP/insert.out" -w '%{http_code}' \
    -X POST "$URL/rest/v1/contact_messages" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H 'Content-Type: application/json' -H 'Prefer: return=minimal' \
    --data-binary "$payload"
)"

if [[ "$insert_code" != "201" && "$insert_code" != "204" ]]; then
  echo "FAIL: insert HTTP $insert_code"; cat "$TMP/insert.out"; exit 1
fi
echo "PASS: insert HTTP $insert_code"

read_code="$(
  curl -sS -o "$TMP/read.out" -w '%{http_code}' \
    "$URL/rest/v1/contact_messages?select=id&limit=5" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
)"
read_body="$(tr -d '[:space:]' < "$TMP/read.out")"

if [[ "$read_code" != "200" || "$read_body" != "[]" ]]; then
  echo "FAIL: read HTTP $read_code body: $read_body"; exit 1
fi
echo "PASS: anon read returns []"

curl -fsS "$BASE/" -o "$TMP/index.html"
if ! grep -Eq 'id="contact-form"' "$TMP/index.html"; then
  echo "FAIL: contact-form missing"; exit 1
fi

config_pos="$(grep -ob 'assets/js/config.js' "$TMP/index.html" | head -n1 | cut -d: -f1 || true)"
contact_pos="$(grep -ob 'assets/js/contact.js' "$TMP/index.html" | head -n1 | cut -d: -f1 || true)"

if [[ -z "$config_pos" || -z "$contact_pos" ]]; then
  echo "FAIL: script tags missing"; exit 1
fi
if [[ "$config_pos" -ge "$contact_pos" ]]; then
  echo "FAIL: config.js must load before contact.js"; exit 1
fi

echo "PASS: index.html correct"
echo ""
echo "═══ ALL SMOKE TESTS PASSED ═══"
