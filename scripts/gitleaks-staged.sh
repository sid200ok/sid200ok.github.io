#!/usr/bin/env bash
# Scan ONLY the git index (what becomes immutable history).
# Native gitleaks binary; no Docker; no dependence on deprecated protect/--staged.
# Exit: 0 clean | 1 leak (commit blocked) | 2 harness failure
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
log(){ printf '%s\n' "$*" >&2; }
die(){ log "gitleaks-staged: $*"; exit 2; }

command -v gitleaks >/dev/null 2>&1 || die "gitleaks not on PATH (run Step 2)"
command -v git      >/dev/null 2>&1 || die "git not found"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git work tree"
[ -f .gitleaks.toml ] || die "missing .gitleaks.toml"

files=()
if [ "$#" -gt 0 ]; then files=("$@")
else
  while IFS= read -r l; do [ -n "$l" ] && files+=("$l"); done \
    < <(git diff --cached --name-only --diff-filter=ACMR)
fi
[ "${#files[@]}" -gt 0 ] || { log "gitleaks-staged: nothing staged."; exit 0; }

stage="$(mktemp -d "${TMPDIR:-/tmp}/gl-staged.XXXXXX")"
trap 'rm -rf "$stage"' EXIT INT TERM

n=0
for f in "${files[@]}"; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 || continue
  mode="$(git ls-files -s -- "$f" | awk '{print $1; exit}')"
  case "$mode" in 100644|100755|100664) : ;; *) continue ;; esac
  out="$stage/$f"; mkdir -p "$(dirname "$out")"
  if git show ":$f" >"$out" 2>/dev/null; then n=$(( n + 1 )); fi
done
[ "$n" -gt 0 ] || { log "gitleaks-staged: no scannable blobs."; exit 0; }

log "gitleaks-staged: scanning $n staged file(s)"
set +e
gitleaks dir "$stage" --config "$PWD/.gitleaks.toml" --redact --no-banner --exit-code 1
rc=$?
set -e
case "$rc" in
  0) log "✔ clean ($n files)"; exit 0 ;;
  1) log "✖ SECRET IN STAGED CONTENT — COMMIT BLOCKED."
     log "  real credential -> rotate, remove, load from gitignored .env"
     log "  false positive  -> targeted regex allowlist, NEVER a secret-bearing path"
     exit 1 ;;
  *) log "✖ harness failure (exit $rc)"; exit 2 ;;
esac
