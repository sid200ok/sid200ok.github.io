#!/usr/bin/env bash
# gitleaks-staged.sh — scan ONLY the git index (what becomes immutable history)
# Exit: 0 clean | 1 leak (commit blocked) | 2 harness failure
set -euo pipefail

GITLEAKS_VERSION="${GITLEAKS_VERSION:-latest}"
TZ="${TZ:-Asia/Kolkata}"
readonly IMAGE="zricethezav/gitleaks:${GITLEAKS_VERSION}"
readonly CONFIG_REL=".gitleaks.toml"

log() { printf '%s\n' "$*" >&2; }
die() { log "gitleaks-staged: $*"; exit 2; }

command -v git    >/dev/null 2>&1 || die "git not found"
command -v docker >/dev/null 2>&1 || die "docker not found"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git work tree"

files=()
if [ "$#" -gt 0 ]; then
  for f in "$@"; do files+=("$f"); done
else
  while IFS= read -r line; do [ -n "$line" ] && files+=("$line"); done \
    < <(git diff --cached --name-only --diff-filter=ACMR)
fi
[ "${#files[@]}" -gt 0 ] || { log "gitleaks-staged: nothing staged — skipping."; exit 0; }

stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/gitleaks-staged.XXXXXX")"
trap 'rm -rf "$stage_dir"' EXIT INT TERM

count=0
for f in "${files[@]}"; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 || continue
  mode="$(git ls-files -s -- "$f" | awk '{print $1; exit}')"
  case "$mode" in
    100644|100755|100664) : ;;
    *) continue ;;
  esac
  out="${stage_dir}/${f}"
  mkdir -p "$(dirname "$out")"
  if git show ":${f}" >"$out" 2>/dev/null; then
    # Safe increment: $(( )) always returns 0; (( count++ )) returns 1 at 0->1
    # boundary and would abort under set -e.
    count=$(( count + 1 ))
  fi
done
[ "$count" -gt 0 ] || { log "gitleaks-staged: no scannable staged blobs — skipping."; exit 0; }

[ -f "$CONFIG_REL" ] || die "missing ${CONFIG_REL} at repo root"
config_abs="$(pwd)/${CONFIG_REL}"
log "gitleaks-staged: scanning ${count} staged file(s) via ${IMAGE}"

set +e
docker run --rm -e "TZ=${TZ}" \
  -v "${stage_dir}:/scan:ro" \
  -v "${config_abs}:/cfg/.gitleaks.toml:ro" \
  "$IMAGE" dir /scan --config /cfg/.gitleaks.toml --redact --no-banner --exit-code 1
rc=$?
set -e

case "$rc" in
  0) log "✔ gitleaks-staged: clean (${count} file(s))"; exit 0 ;;
  1) log ""; log "✖ SECRET IN STAGED CONTENT — COMMIT BLOCKED."
     log "  Real credential -> rotate, delete, load from gitignored .env."
     log "  False positive  -> TARGETED rule-level allowlist in .gitleaks.toml."
     log "  NEVER blanket-allowlist .env / config.js / dist/: it blinds the whole scan."
     exit 1 ;;
  *) log "✖ gitleaks-staged: harness failure (exit ${rc}) — config or Docker problem."; exit 2 ;;
esac
