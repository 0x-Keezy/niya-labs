#!/usr/bin/env bash
# ==============================================================================
#  Niya Labs — pre-push safety gate
# ==============================================================================
#  Run this from the repo root before `git push origin main` to the public
#  repository. Exits 0 only if no secret-ish content leaks.
#
#  Intentionally conservative: false positives are better than a real leak.
#  Skip a check with `SKIP_<NAME>=1` in the env if you've reviewed it:
#    SKIP_BUILD=1 ./scripts/pre-push-check.sh   # skip `npm run build`
#    SKIP_EXT=1 ./scripts/pre-push-check.sh     # skip extension build
# ==============================================================================

set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

FAIL=0
fail() { echo "  FAIL: $1"; FAIL=1; }
pass() { echo "   ok : $1"; }
step() { echo; echo "== $1 =="; }

# ----------------------------------------------------------------------
step "1. Local branch topology"
# ----------------------------------------------------------------------
branch_count=$(git branch | wc -l)
if [ "$branch_count" -gt 1 ]; then
  fail "more than one local branch exists. Delete anything other than 'main' before pushing:"
  git branch | grep -v '^\* main$' | sed 's/^/    /'
else
  pass "only 'main' exists locally"
fi

# ----------------------------------------------------------------------
step "2. Secret files are NOT tracked"
# ----------------------------------------------------------------------
if git ls-files | grep -qE '^\.env(\.local|\.production|\.development)?$'; then
  fail ".env* file is tracked:"
  git ls-files | grep -E '^\.env' | sed 's/^/    /'
else
  pass ".env* files gitignored"
fi

if git ls-files | grep -q 'externalAPI/dataHandlerStorage/config\.json$'; then
  fail "config.json with real keys is tracked"
else
  pass "config.json gitignored"
fi

if git ls-files | grep -qiE '^\.replit|replit\.nix|replit\.md'; then
  fail "replit config files are tracked:"
  git ls-files | grep -iE '\.replit|replit\.nix|replit\.md' | sed 's/^/    /'
else
  pass "replit configs gitignored"
fi

# ----------------------------------------------------------------------
step "3. No API-key patterns in committed content"
# ----------------------------------------------------------------------
# Provider-prefixed keys (sk-, xai-, hel_, AIza...). Excludes *.md (docs can
# reference key formats) and .env.example (placeholders).
key_hits=$(git grep -IE 'sk-[a-zA-Z0-9]{20,}|xai-[a-zA-Z0-9]{20,}|hel_[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{20,}' \
  -- ':!*.md' ':!.env.example' 2>/dev/null | head -5)
if [ -n "$key_hits" ]; then
  fail "possible API key in committed files:"
  echo "$key_hits" | sed 's/^/    /'
else
  pass "no obvious API-key patterns"
fi

# ----------------------------------------------------------------------
step "4. No raw 64-char hex (potential private key)"
# ----------------------------------------------------------------------
# Excludes docs/migrations/env example. Real production keys are 64 hex chars
# prefixed with 0x. Placeholders like 0x0000...00 still match — triage manually.
pk_hits=$(git grep -IE '0x[a-fA-F0-9]{64}' \
  -- ':!*.md' ':!.env.example' ':!migrations/**' 2>/dev/null | head -5)
if [ -n "$pk_hits" ]; then
  fail "64-char hex found (private-key shape — verify each):"
  echo "$pk_hits" | sed 's/^/    /'
else
  pass "no private-key-shaped hex in code"
fi

# ----------------------------------------------------------------------
step "5. package.json identity"
# ----------------------------------------------------------------------
if grep -q '"name": "amica"' package.json; then
  fail "package.json still says \"amica\" (should be \"niya-labs\")"
else
  pass "package.json name is niya-labs"
fi

if ! grep -q '"repository"' package.json; then
  fail "package.json has no repository field"
else
  pass "package.json has repository field"
fi

# ----------------------------------------------------------------------
step "6. Required OSS files present"
# ----------------------------------------------------------------------
for f in README.md LICENSE SECURITY.md CONTRIBUTING.md CODE_OF_CONDUCT.md \
         CHANGELOG.md .env.example docs/DEPLOYMENT.md \
         .github/PULL_REQUEST_TEMPLATE.md .github/dependabot.yml; do
  if [ -f "$f" ]; then
    pass "$f"
  else
    fail "missing: $f"
  fi
done

# ----------------------------------------------------------------------
step "7. No personal email in SECURITY.md / CODE_OF_CONDUCT.md"
# ----------------------------------------------------------------------
for f in SECURITY.md CODE_OF_CONDUCT.md; do
  if grep -qE '[a-zA-Z0-9._-]+@(gmail|outlook|protonmail|yahoo|hotmail|live)\.com' "$f" 2>/dev/null; then
    fail "personal email in $f (use GitHub advisory flow instead):"
    grep -nE '[a-zA-Z0-9._-]+@(gmail|outlook|protonmail|yahoo|hotmail|live)\.com' "$f" | sed 's/^/    /'
  else
    pass "$f has no personal email"
  fi
done

# ----------------------------------------------------------------------
step "8. .env.example has the NEXT_PUBLIC warning banner"
# ----------------------------------------------------------------------
if grep -q 'NEXT_PUBLIC_\* WARNING' .env.example 2>/dev/null; then
  pass "warning banner present"
else
  fail ".env.example is missing the NEXT_PUBLIC_* warning banner"
fi

# ----------------------------------------------------------------------
step "9. Root build passes"
# ----------------------------------------------------------------------
if [ "${SKIP_BUILD:-}" = "1" ]; then
  echo "   skipped via SKIP_BUILD=1"
else
  if npm run build --silent >/tmp/niya-build.log 2>&1; then
    pass "npm run build"
  else
    fail "npm run build failed — see /tmp/niya-build.log"
  fi
fi

# ----------------------------------------------------------------------
step "10. Extension build passes"
# ----------------------------------------------------------------------
if [ "${SKIP_EXT:-}" = "1" ]; then
  echo "   skipped via SKIP_EXT=1"
else
  if (cd extension && npm run build --silent >/tmp/niya-ext-build.log 2>&1); then
    pass "cd extension && npm run build"
  else
    fail "extension build failed — see /tmp/niya-ext-build.log"
  fi
fi

# ----------------------------------------------------------------------
echo
echo "=============================================================="
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL CHECKS PASSED — safe to:  git push origin main"
  echo "=============================================================="
  exit 0
else
  echo "  FAILURES ABOVE — fix before pushing."
  echo "=============================================================="
  exit 1
fi
