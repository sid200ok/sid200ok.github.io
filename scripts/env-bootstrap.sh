#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"
GITIGNORE=".gitignore"

touch "$GITIGNORE"
sed -i '/^sid \.env$/d' "$GITIGNORE"

grep -Fxq '.env' "$GITIGNORE" || printf '.env\n' >> "$GITIGNORE"
grep -Fxq '.env.*' "$GITIGNORE" || printf '.env.*\n' >> "$GITIGNORE"
grep -Fxq '!.env.example' "$GITIGNORE" || printf '!.env.example\n' >> "$GITIGNORE"

if [[ ! -f "$ENV_EXAMPLE" ]]; then
  cat > "$ENV_EXAMPLE" <<'EXAMPLE'
SUPABASE_URL=
SUPABASE_ANON_KEY=
EXAMPLE
fi

git add -f "$ENV_EXAMPLE"

if git ls-files --error-unmatch "$ENV_FILE" >/dev/null 2>&1; then
  echo "ERROR: $ENV_FILE is tracked by Git." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE does not exist." >&2
  echo "Run: cp $ENV_EXAMPLE $ENV_FILE and fill values." >&2
  exit 1
fi

chmod 600 "$ENV_FILE"

bash -c '
  set -a
  . ./"$1"
  set +a
  : "${SUPABASE_URL:?SUPABASE_URL is missing}"
  : "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is missing}"
  echo "Environment validation passed."
' _ "$ENV_FILE"
