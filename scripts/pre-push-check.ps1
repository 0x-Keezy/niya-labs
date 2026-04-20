# =============================================================================
#  Niya Labs -- pre-push safety gate (PowerShell version)
# =============================================================================
#  Run this from the repo root before: git push origin main
#  Mirrors scripts/pre-push-check.sh for Windows users.
#
#  Usage from an open PowerShell session:
#    .\scripts\pre-push-check.ps1
#
#  If blocked by execution policy, run once per session first:
#    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
#
#  Skip a slow check with an env var:
#    $env:SKIP_BUILD = "1"   # skip npm run build (root)
#    $env:SKIP_EXT   = "1"   # skip extension build
# =============================================================================

$ErrorActionPreference = "Continue"
Set-Location (git rev-parse --show-toplevel)

$script:Fail = 0
function Fail($msg) { Write-Host ("  FAIL: " + $msg) -ForegroundColor Red; $script:Fail = 1 }
function Pass($msg) { Write-Host ("   ok : " + $msg) -ForegroundColor Green }
function Step($msg) { Write-Host ""; Write-Host ("== " + $msg + " ==") -ForegroundColor Cyan }

# ---------------------------------------------------------------------
Step "1. Local branch topology"
# ---------------------------------------------------------------------
$branches = git branch
$branchCount = ($branches | Measure-Object -Line).Lines
if ($branchCount -gt 1) {
  Fail "more than one local branch exists. Keep only 'main' before pushing."
  $branches | Where-Object { $_ -notmatch '^\* main$' } | ForEach-Object { Write-Host ("    " + $_) }
} else {
  Pass "only 'main' exists locally"
}

# ---------------------------------------------------------------------
Step "2. Hidden refs that could leak on --all / --mirror"
# ---------------------------------------------------------------------
$refs = git for-each-ref --format="%(refname)"
$dirtyRefs = $refs | Where-Object { $_ -match 'replit|notes' }
if ($dirtyRefs) {
  Fail "hidden refs still present. Remove each with: git update-ref -d <name>"
  $dirtyRefs | ForEach-Object { Write-Host ("    " + $_) }
} else {
  Pass "no replit or notes refs"
}

# ---------------------------------------------------------------------
Step "3. Secret files are NOT tracked"
# ---------------------------------------------------------------------
$trackedEnv = git ls-files | Where-Object { $_ -match '^\.env(\.local|\.production|\.development)?$' }
if ($trackedEnv) {
  Fail ".env file is tracked"
  $trackedEnv | ForEach-Object { Write-Host ("    " + $_) }
} else {
  Pass ".env files gitignored"
}

$trackedConfig = git ls-files | Where-Object { $_ -match 'externalAPI/dataHandlerStorage/config\.json$' }
if ($trackedConfig) {
  Fail "config.json with real keys is tracked"
} else {
  Pass "config.json gitignored"
}

$trackedReplit = git ls-files | Where-Object { $_ -match '(?i)^\.replit|replit\.nix|replit\.md' }
if ($trackedReplit) {
  Fail "replit config files are tracked"
  $trackedReplit | ForEach-Object { Write-Host ("    " + $_) }
} else {
  Pass "replit configs gitignored"
}

# ---------------------------------------------------------------------
Step "4. No API-key patterns in committed content"
# ---------------------------------------------------------------------
$keyHits = git grep -IE 'sk-[a-zA-Z0-9]{20,}|xai-[a-zA-Z0-9]{20,}|hel_[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{20,}' -- ':!*.md' ':!.env.example' 2>$null | Select-Object -First 5
if ($keyHits) {
  Fail "possible API key in committed files"
  $keyHits | ForEach-Object { Write-Host ("    " + $_) }
} else {
  Pass "no obvious API-key patterns"
}

# ---------------------------------------------------------------------
Step "5. No raw 64-char hex (potential private key)"
# ---------------------------------------------------------------------
$pkHits = git grep -IE '0x[a-fA-F0-9]{64}' -- ':!*.md' ':!.env.example' ':!migrations/**' 2>$null | Select-Object -First 5
if ($pkHits) {
  Fail "64-char hex found. Private-key shape, verify each."
  $pkHits | ForEach-Object { Write-Host ("    " + $_) }
} else {
  Pass "no private-key-shaped hex in code"
}

# ---------------------------------------------------------------------
Step "6. package.json identity"
# ---------------------------------------------------------------------
$pkg = Get-Content package.json -Raw
if ($pkg -match '"name": "amica"') {
  Fail "package.json still says amica. Should be niya-labs."
} else {
  Pass "package.json name is niya-labs"
}

if ($pkg -notmatch '"repository"') {
  Fail "package.json has no repository field"
} else {
  Pass "package.json has repository field"
}

# ---------------------------------------------------------------------
Step "7. Required OSS files present"
# ---------------------------------------------------------------------
$required = @(
  "README.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md", "CHANGELOG.md", ".env.example",
  "docs/DEPLOYMENT.md", ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/dependabot.yml"
)
foreach ($f in $required) {
  if (Test-Path $f) { Pass $f } else { Fail ("missing: " + $f) }
}

# ---------------------------------------------------------------------
Step "8. No personal email in SECURITY.md / CODE_OF_CONDUCT.md"
# ---------------------------------------------------------------------
$emailPattern = '[a-zA-Z0-9._-]+@(gmail|outlook|protonmail|yahoo|hotmail|live)\.com'
foreach ($f in @("SECURITY.md", "CODE_OF_CONDUCT.md")) {
  if (-not (Test-Path $f)) { continue }
  $hit = Select-String -Path $f -Pattern $emailPattern
  if ($hit) {
    Fail ($f + " contains a personal email. Use GitHub advisory flow.")
    $hit | ForEach-Object { Write-Host ("    " + $_.Line) }
  } else {
    Pass ($f + " has no personal email")
  }
}

# ---------------------------------------------------------------------
Step "9. .env.example has the NEXT_PUBLIC warning banner"
# ---------------------------------------------------------------------
if (Select-String -Path .env.example -Pattern 'NEXT_PUBLIC_\* WARNING' -Quiet) {
  Pass "warning banner present"
} else {
  Fail ".env.example is missing the NEXT_PUBLIC_* warning banner"
}

# ---------------------------------------------------------------------
Step "10. Root build passes"
# ---------------------------------------------------------------------
if ($env:SKIP_BUILD -eq "1") {
  Write-Host "   skipped via SKIP_BUILD=1"
} else {
  $logPath = Join-Path $env:TEMP "niya-build.log"
  npm run build 2>&1 | Out-File -FilePath $logPath -Encoding utf8
  if ($LASTEXITCODE -eq 0) {
    Pass "npm run build"
  } else {
    Fail ("npm run build failed. Log: " + $logPath)
  }
}

# ---------------------------------------------------------------------
Step "11. Extension build passes"
# ---------------------------------------------------------------------
if ($env:SKIP_EXT -eq "1") {
  Write-Host "   skipped via SKIP_EXT=1"
} else {
  $logPath = Join-Path $env:TEMP "niya-ext-build.log"
  Push-Location extension
  npm run build 2>&1 | Out-File -FilePath $logPath -Encoding utf8
  $extExit = $LASTEXITCODE
  Pop-Location
  if ($extExit -eq 0) {
    Pass "cd extension; npm run build"
  } else {
    Fail ("extension build failed. Log: " + $logPath)
  }
}

# ---------------------------------------------------------------------
Write-Host ""
Write-Host "=============================================================="
if ($script:Fail -eq 0) {
  Write-Host "  ALL CHECKS PASSED. Safe to: git push origin main" -ForegroundColor Green
  Write-Host "=============================================================="
  exit 0
} else {
  Write-Host "  FAILURES ABOVE. Fix before pushing." -ForegroundColor Red
  Write-Host "=============================================================="
  exit 1
}
