#!/usr/bin/env bash
# audit-secrets.sh — Phase0 positive control | Phase1 tree (dir) | Phase2 history (git)
# Exit: 0 clean | 1 leak found | 2 harness failure (results untrustworthy)
set -euo pipefail

GITLEAKS_VERSION="${GITLEAKS_VERSION:-latest}"
TZ="${TZ:-Asia/Kolkata}"
MIN_BYTES="${MIN_BYTES:-200000}"
readonly IMAGE="zricethezav/gitleaks:${GITLEAKS_VERSION}"
readonly REPO_DIR="$(pwd)"
readonly CONFIG_ABS="${REPO_DIR}/.gitleaks.toml"

log() { printf '%s\n' "$*" >&2; }
hdr() { printf '\n\033[1m── %s ──\033[0m\n' "$*" >&2; }
die() { log "audit-secrets: $*"; exit 2; }

command -v docker >/dev/null 2>&1 || die "docker not found"
command -v git    >/dev/null 2>&1 || die "git not found"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git work tree"
[ -f "$CONFIG_ABS" ] || die "missing ${CONFIG_ABS}"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gitleaks-audit.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT INT TERM

gl_dir() {
  docker run --rm -e "TZ=${TZ}" -v "$1:/scan:ro" -v "${CONFIG_ABS}:/cfg/.gitleaks.toml:ro" \
    "$IMAGE" dir /scan --config /cfg/.gitleaks.toml --redact --no-banner --exit-code 1
}
gl_git() {
  docker run --rm -e "TZ=${TZ}" -v "$1:/scan:ro" -v "${CONFIG_ABS}:/cfg/.gitleaks.toml:ro" \
    "$IMAGE" git /scan --config /cfg/.gitleaks.toml --log-opts=--all --redact --no-banner --exit-code 1
}

overall=0

hdr "Phase 0 — positive control (MUST fire, else every clean result is worthless)"
probe="${WORK_DIR}/probe"; mkdir -p "$probe"
cat > "${probe}/planted.txt" <<'PLANT'
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
supabase_service_role = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PLANTCTRL.PLANTCTRLSIGNATUREVALUE00
postgres://audit_user:Sup3rS3cretPassw0rd@dbs.example.supabase.co:5432/postgres
PLANT
set +e; gl_dir "$probe" >/dev/null 2>&1; probe_rc=$?; set -e
if [ "$probe_rc" -eq 1 ]; then
  log "✔ positive control fired (exit 1) — scanner is working"
elif [ "$probe_rc" -eq 0 ]; then
  log "✖ POSITIVE CONTROL PASSED SILENTLY — scanner is NOT detecting."; log "  Over-broad allowlist in .gitleaks.toml. Aborting."; exit 2
else
  log "✖ harness failure during positive control (exit ${probe_rc}) — config likely does not parse."; exit 2
fi

hdr "Phase 1 — working tree (gitleaks dir)"
set +e; tree_out="$(gl_dir "$REPO_DIR" 2>&1)"; tree_rc=$?; set -e
printf '%s\n' "$tree_out" >&2
scanned_bytes="$(printf '%s' "$tree_out" | sed -n 's/.*scanned ~\([0-9]*\) bytes.*/\1/p' | head -n1)"
if [ -n "$scanned_bytes" ]; then
  log "bytes scanned: ${scanned_bytes} (floor ${MIN_BYTES})"
  [ "$scanned_bytes" -ge "$MIN_BYTES" ] || log "⚠ scan very small — confirm you are not allowlisting real source"
fi
case "$tree_rc" in
  0) log "✔ working tree clean" ;;
  1) log "✖ LEAK IN WORKING TREE"; overall=1 ;;
  *) log "✖ harness failure phase 1 (exit ${tree_rc})"; overall=2 ;;
esac

hdr "Phase 2 — full git history (gitleaks git --log-opts=--all)"
if [ -d "${REPO_DIR}/.git" ]; then
  set +e; gl_git "$REPO_DIR" >&2; hist_rc=$?; set -e
  case "$hist_rc" in
    0) log "✔ history clean" ;;
    1) log "✖ LEAK IN GIT HISTORY — deleting the file does NOT remove it."; log "  Rotate the key, then git filter-repo + force-push."; overall=1 ;;
    *) log "✖ harness failure phase 2 (exit ${hist_rc})"; overall=2 ;;
  esac
else
  log "⚠ no .git — history scan skipped"
fi

hdr "Summary"
case "$overall" in
  0) log "✔ AUDIT CLEAN — tree + history + positive control all verified" ;;
  1) log "✖ AUDIT FAILED — secret material found" ;;
  2) log "✖ AUDIT INVALID — harness problem, do not trust results" ;;
esac
exit "$overall"
