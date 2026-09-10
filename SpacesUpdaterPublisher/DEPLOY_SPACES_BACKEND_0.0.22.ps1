$ErrorActionPreference = 'Stop'
$backend = Join-Path $env:USERPROFILE 'OneDrive\Documents\spaces'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$worker = Join-Path $here 'BACKEND\src\worker.js'
$newEndpoint = 'https://spaces.spagotei.workers.dev'

if (-not (Test-Path $backend)) { throw "Spaces backend not found at $backend" }
if (-not (Test-Path $worker)) { throw "Packaged Worker missing at $worker" }

Set-Location $backend
$configCandidates = @('wrangler.toml','wrangler.json','wrangler.jsonc') | ForEach-Object { Join-Path $backend $_ } | Where-Object { Test-Path $_ }
if (-not $configCandidates -or $configCandidates.Count -eq 0) { throw 'No wrangler.toml, wrangler.json, or wrangler.jsonc found in the Spaces backend.' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $backend "_backup_before_spaces_cutover_$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
foreach ($cfg in $configCandidates) { Copy-Item $cfg (Join-Path $backupDir (Split-Path $cfg -Leaf)) -Force }
if (Test-Path '.\src\worker.js') { Copy-Item '.\src\worker.js' (Join-Path $backupDir 'worker.js') -Force }
if (Test-Path '.\scripts\publish-desktop-update.mjs') { Copy-Item '.\scripts\publish-desktop-update.mjs' (Join-Path $backupDir 'publish-desktop-update.mjs') -Force }

Write-Host '[1/5] Repointing Wrangler from scrounge-spaces-api to the existing Spaces Worker...' -ForegroundColor Cyan
foreach ($cfg in $configCandidates) {
  $raw = Get-Content $cfg -Raw
  $raw = $raw.Replace('scrounge-spaces-api', 'spaces')
  $raw = $raw.Replace('Scrounge Spaces', 'Spaces')
  [System.IO.File]::WriteAllText($cfg, $raw, (New-Object System.Text.UTF8Encoding($false)))
}

# Keep the existing D1 database binding during the hostname cutover so old and new clients share one live dataset.
# We intentionally do NOT replace database_name = "scrounge-spaces" in this release.
Write-Host '[2/5] Staging the Spaces-branded Worker...' -ForegroundColor Cyan
Copy-Item $worker '.\src\worker.js' -Force
node --check '.\src\worker.js'
if ($LASTEXITCODE -ne 0) { throw 'Worker syntax check failed. Deploy stopped.' }

# Make the existing publisher verify the canonical Spaces endpoint when it contains the old hard-coded host.
if (Test-Path '.\scripts\publish-desktop-update.mjs') {
  $publisher = Get-Content '.\scripts\publish-desktop-update.mjs' -Raw
  $publisher = $publisher.Replace('https://scrounge-spaces-api.spagotei.workers.dev', $newEndpoint)
  $publisher = $publisher.Replace('scrounge-spaces-api.spagotei.workers.dev', 'spaces.spagotei.workers.dev')
  [System.IO.File]::WriteAllText((Resolve-Path '.\scripts\publish-desktop-update.mjs'), $publisher, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Host '[3/5] Confirming Wrangler config targets Worker name "spaces"...' -ForegroundColor Cyan
$joined = ($configCandidates | ForEach-Object { Get-Content $_ -Raw }) -join "`n"
if ($joined -match 'scrounge-spaces-api') { throw 'Wrangler config still targets scrounge-spaces-api. Deploy stopped.' }
if ($joined -notmatch '(?m)\bspaces\b') { throw 'Could not confirm Spaces Worker name in Wrangler config.' }
Write-Host '[OK] D1 binding is intentionally preserved during this cutover.' -ForegroundColor Green

Write-Host '[4/5] Deploying current Spaces backend to spaces.spagotei.workers.dev...' -ForegroundColor Cyan
npm.cmd run deploy
if ($LASTEXITCODE -ne 0) { throw 'Spaces Worker deploy failed.' }

Write-Host '[5/5] Verifying canonical Spaces Worker health...' -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
  $health = Invoke-RestMethod -Uri "$newEndpoint/health" -Method Get -TimeoutSec 20
} catch {
  throw "Spaces Worker deployed, but health verification failed: $($_.Exception.Message)"
}
if (-not $health.ok) { throw 'Spaces Worker health endpoint did not report ok=true.' }
if ($health.service -ne 'Spaces') { throw "Unexpected service name from Spaces Worker: $($health.service)" }

Write-Host '[OK] Canonical Spaces backend is LIVE at https://spaces.spagotei.workers.dev' -ForegroundColor Green
Write-Host '[OK] New 0.0.22 clients will no longer send normal API traffic to scrounge-spaces-api.' -ForegroundColor Green
Write-Host '[INFO] scrounge-spaces-api remains frozen only as a temporary updater/API compatibility path for older installs.' -ForegroundColor Yellow
Write-Host '[INFO] No D1 migration was performed; both Workers still share the same current D1 dataset during cutover.' -ForegroundColor Yellow
Write-Host "Backup: $backupDir"
