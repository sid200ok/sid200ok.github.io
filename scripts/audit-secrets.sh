#!/usr/bin/env bash
# Phase 0 positive control | Phase 1 tree | Phase 2 full history
# Native binary. Probe assembled at RUNTIME from fragments on SEPARATE lines,
# so this source file never contains a detectable literal.
# Exit: 0 clean | 1 leak | 2 harness failure
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
CFG="$PWD/.gitleaks.toml"
log(){ printf '%s\n' "$*" >&2; }
hdr(){ printf '\n== %s ==\n' "$*" >&2; }
die(){ log "audit: $*"; exit 2; }
command -v gitleaks >/dev/null 2>&1 || die "gitleaks not on PATH"
[ -f "$CFG" ] || die "missing $CFG"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git repo"

W="$(mktemp -d "${TMPDIR:-/tmp}/gl-audit.XXXXXX")"
trap 'rm -rf "$W"' EXIT INT TERM
overall=0

hdr "Phase 0 - positive control (MUST fire)"
mkdir -p "$W/probe"
# High-entropy, non-dictionary, NOT in stopwords -> trips postgres-dsn-password,
# a custom rule with no allowlist. AWS docs example key is NOT usable as a probe.
P1='postgres://probe_user'
P2=':K7qR2mX9vT4wZ8pL'
P3='@db.example.invalid:5432/postgres'
printf 'DATABASE_URL=%s%s%s\n' "$P1" "$P2" "$P3" > "$W/probe/planted.txt"
set +e
gitleaks dir "$W/probe" --config "$CFG" --redact --no-banner --exit-code 1 >/dev/null 2>&1
p=$?
set -e
if [ "$p" -eq 1 ]; then log "OK probe fired"
elif [ "$p" -eq 0 ]; then log "FAIL probe silent - allowlist too broad"; exit 2
else log "FAIL probe harness error ($p)"; exit 2; fi

hdr "Phase 1 - working tree"
set +e
gitleaks dir "$PWD" --config "$CFG" --redact --no-banner --exit-code 1 \
  --report-format json --report-path "$W/tree.json" >&2
rc=$?
set -e
cp -f "$W/tree.json" /tmp/gl-tree.json 2>/dev/null || true
case "$rc" in
  0) log "OK tree clean" ;;
  1) log "FAIL leak in tree"; overall=1 ;;
  *) log "FAIL tree harness ($rc)"; overall=2 ;;
esac

hdr "Phase 2 - full git history"
set +e
gitleaks git "$PWD" --config "$CFG" --log-opts=--all --redact --no-banner --exit-code 1 \
  --report-format json --report-path "$W/hist.json" >&2
h=$?
set -e
cp -f "$W/hist.json" /tmp/gl-hist.json 2>/dev/null || true
case "$h" in
  0) log "OK history clean" ;;
  1) log "FAIL leak in history"; overall=1 ;;
  *) log "FAIL history harness ($h)"; overall=2 ;;
esac

hdr "Summary"
if [ "$overall" -eq 0 ]; then log "AUDIT CLEAN"
elif [ "$overall" -eq 1 ]; then log "AUDIT FAILED - run: node scripts/triage.mjs"
else log "AUDIT INVALID"; fi
exit "$overall"
