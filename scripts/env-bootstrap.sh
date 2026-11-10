#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"
GITIGNORE=".gitignore"

touch "$GITIGNORE"
sed -i '/^sid \.env$/d' "$GITIGNORE"

ensure_line() {
  local line="$1"
  grep -Fxq "$line" "$GITIGNORE" || printf '%s\n' "$line" >> "$GITIGNORE"
}

ensure_line '.env'
ensure_line '.env.*'
ensure_line '!.env.example'
ensure_line 'assets/js/config.js'
ensure_line 'assets/js/config.js.tmp'
ensure_line '.sid.pid'
ensure_line '.sid.port'
ensure_line '.sid.log'

if [[ ! -f "$ENV_EXAMPLE" ]]; then
  cat > "$ENV_EXAMPLE" <<'INNER'
# Copy to .env for local development:
#   cp .env.example .env
# Never commit .env.
# Only the public anon/publishable Supabase key belongs in browser config.

SUPABASE_URL=
SUPABASE_ANON_KEY=
INNER
fi

git add -f "$ENV_EXAMPLE" >/dev/null 2>&1 || true

if git ls-files --error-unmatch "$ENV_FILE" >/dev/null 2>&1; then
  echo "ERROR: $ENV_FILE is tracked by Git. Run: git rm --cached $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE. Fill values, then rerun."
  exit 2
fi

chmod 600 "$ENV_FILE"

if ! (
  set -a; . "./$ENV_FILE"; set +a
  url="${SUPABASE_URL:-}"; key="${SUPABASE_ANON_KEY:-}"
  [[ "$url" =~ ^https://[A-Za-z0-9.-]+\.supabase\.(co|in)$ ]] || { echo "ERROR: bad SUPABASE_URL" >&2; exit 1; }
  [[ -n "$key" ]] || { echo "ERROR: empty SUPABASE_ANON_KEY" >&2; exit 1; }
  [[ "$key" == sb_secret_* || "$key" == sb_service_* ]] && { echo "ERROR: secret key detected" >&2; exit 1; }
  echo "✔ Environment validation passed."
); then
  exit 1
fi
