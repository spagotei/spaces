$ErrorActionPreference = 'Stop'
$backend = Join-Path $env:USERPROFILE 'OneDrive\Documents\spaces'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$worker = Join-Path $here 'BACKEND\src\worker.js'
$migration = Join-Path $here 'BACKEND\migrations\0016_public_ids_staff_chat.sql'

if (-not (Test-Path $backend)) { throw "Spaces backend not found at $backend" }
if (-not (Test-Path $worker)) { throw "Packaged Worker missing at $worker" }
if (-not (Test-Path $migration)) { throw "Packaged migration missing at $migration" }

$migrationDir = Join-Path $backend 'migrations'
New-Item -ItemType Directory -Force -Path $migrationDir | Out-Null
$migrationTarget = Join-Path $migrationDir '0016_public_ids_staff_chat.sql'
Copy-Item $migration $migrationTarget -Force

Set-Location $backend
Write-Host '[1/3] Applying required D1 migration 0016...' -ForegroundColor Cyan
Write-Host '      Adds generated public user IDs, atomic ID counter, and private Support staff chat.' -ForegroundColor DarkGray
Write-Host '      This uses direct D1 execute because that is the remote path that works for this Spaces database.' -ForegroundColor DarkGray

npx.cmd wrangler d1 execute scrounge-spaces --remote --file="./migrations/0016_public_ids_staff_chat.sql"
if ($LASTEXITCODE -ne 0) {
  throw 'D1 migration 0016 failed. Worker was NOT deployed. If it says public_user_id already exists, paste the exact output into ChatGPT before retrying.'
}
Write-Host '[OK] Migration 0016 applied.' -ForegroundColor Green

$target = Join-Path $backend 'src\worker.js'
if (-not (Test-Path (Split-Path -Parent $target))) { throw "Backend src folder missing: $(Split-Path -Parent $target)" }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (Test-Path $target) { Copy-Item $target (Join-Path $backend "src\worker.before-0.0.21-$stamp.js") -Force }
Copy-Item $worker $target -Force

Write-Host '[2/3] Checking staged Worker syntax...' -ForegroundColor Cyan
node --check .\src\worker.js
if ($LASTEXITCODE -ne 0) { throw 'Worker syntax check failed. Deploy stopped.' }

Write-Host '[3/3] Deploying Spaces 0.0.21 Worker...' -ForegroundColor Cyan
npm.cmd run deploy
if ($LASTEXITCODE -ne 0) { throw 'Worker deploy failed.' }

Write-Host '[OK] Spaces 0.0.21 backend deployed.' -ForegroundColor Green
Write-Host '[OK] Support account lookup, generated IDs, staff chat, and generated-only invite enforcement are live.' -ForegroundColor Green
