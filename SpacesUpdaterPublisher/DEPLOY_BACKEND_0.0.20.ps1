$ErrorActionPreference = 'Stop'
$backend = Join-Path $env:USERPROFILE 'OneDrive\Documents\spaces'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$worker = Join-Path $here 'BACKEND\src\worker.js'
if (-not (Test-Path $backend)) { throw "Spaces backend not found at $backend" }
if (-not (Test-Path $worker)) { throw "Packaged Worker missing at $worker" }
$target = Join-Path $backend 'src\worker.js'
if (-not (Test-Path (Split-Path -Parent $target))) { throw "Backend src folder missing: $(Split-Path -Parent $target)" }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (Test-Path $target) { Copy-Item $target (Join-Path $backend "src\worker.before-0.0.20-$stamp.js") -Force }
Copy-Item $worker $target -Force
Set-Location $backend
node --check .\src\worker.js
if ($LASTEXITCODE -ne 0) { throw 'Worker syntax check failed.' }
Write-Host '[OK] Worker staged. Deploying Founder-only Space banner enforcement...' -ForegroundColor Cyan
npm.cmd run deploy
if ($LASTEXITCODE -ne 0) { throw 'Worker deploy failed.' }
Write-Host '[OK] Spaces Worker deployed. No D1 migration was required.' -ForegroundColor Green
