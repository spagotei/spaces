$ErrorActionPreference = 'Stop'
$backend = Join-Path $env:USERPROFILE 'OneDrive\Documents\spaces'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$packagedWorker = Join-Path $here 'BACKEND\src\worker.js'
$packagedMigration = Join-Path $here 'BACKEND\migrations\0017_direct_messages_privacy.sql'
$endpoint = 'https://spaces.spagotei.workers.dev'

if (-not (Test-Path $backend)) { throw "Spaces backend not found at $backend" }
if (-not (Test-Path $packagedWorker)) { throw "Packaged Worker missing: $packagedWorker" }
if (-not (Test-Path $packagedMigration)) { throw "Migration 0017 missing: $packagedMigration" }
Set-Location $backend

$configCandidates = @('wrangler.toml','wrangler.json','wrangler.jsonc') | ForEach-Object { Join-Path $backend $_ } | Where-Object { Test-Path $_ }
if (-not $configCandidates -or $configCandidates.Count -eq 0) { throw 'No Wrangler config found in the Spaces backend.' }
$joined = ($configCandidates | ForEach-Object { Get-Content $_ -Raw }) -join "`n"
if ($joined -match 'scrounge-spaces-api') { throw 'Wrangler still targets scrounge-spaces-api. 0.0.23 will NOT deploy there.' }
if ($joined -notmatch '(?m)name\s*=\s*["'']spaces["'']|"name"\s*:\s*"spaces"') { throw 'Could not confirm canonical Worker name "spaces" in Wrangler config.' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $backend "_backup_before_0.0.23_$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
if (Test-Path '.\src\worker.js') { Copy-Item '.\src\worker.js' (Join-Path $backup 'worker.js') -Force }
foreach ($cfg in $configCandidates) { Copy-Item $cfg (Join-Path $backup (Split-Path $cfg -Leaf)) -Force }

Write-Host '[1/5] Staging migration 0017 in the Spaces backend...' -ForegroundColor Cyan
$migrationsDir = Join-Path $backend 'migrations'
New-Item -ItemType Directory -Force -Path $migrationsDir | Out-Null
$migrationDest = Join-Path $migrationsDir '0017_direct_messages_privacy.sql'
Copy-Item $packagedMigration $migrationDest -Force

Write-Host '[2/5] Applying D1 tables for Message Requests and per-Space DM privacy...' -ForegroundColor Cyan
Write-Host '[INFO] The D1 resource is still named scrounge-spaces during the data-preserving cutover; requests are served by the Spaces Worker.' -ForegroundColor DarkYellow
& npx.cmd wrangler d1 execute scrounge-spaces --remote --file=$migrationDest
if ($LASTEXITCODE -ne 0) { throw 'D1 migration 0017 failed. Worker was NOT deployed.' }

Write-Host '[3/5] Staging the 0.0.23 Spaces Worker...' -ForegroundColor Cyan
Copy-Item $packagedWorker '.\src\worker.js' -Force
node --check '.\src\worker.js'
if ($LASTEXITCODE -ne 0) { throw 'Worker syntax check failed. Deploy stopped.' }

Write-Host '[4/5] Deploying ONLY to spaces.spagotei.workers.dev...' -ForegroundColor Cyan
npm.cmd run deploy
if ($LASTEXITCODE -ne 0) { throw 'Spaces Worker deploy failed.' }

Write-Host '[5/5] Verifying canonical Spaces Worker health...' -ForegroundColor Cyan
Start-Sleep -Seconds 2
$health = Invoke-RestMethod -Uri "$endpoint/health" -Method Get -TimeoutSec 20
if (-not $health.ok) { throw 'Spaces health endpoint did not report ok=true.' }
if ($health.service -ne 'Spaces') { throw "Unexpected service name: $($health.service)" }
if ($health.apiVersion -ne '6.4') { Write-Host "[WARN] Health apiVersion returned $($health.apiVersion), expected 6.4." -ForegroundColor Yellow }
Write-Host '[OK] Spaces 0.0.23 backend is live on the canonical Spaces Worker.' -ForegroundColor Green
Write-Host '[OK] scrounge-spaces-api was not changed.' -ForegroundColor Green
Write-Host "Backup: $backup"
