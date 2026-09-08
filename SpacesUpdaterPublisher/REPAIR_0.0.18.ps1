$ErrorActionPreference = 'Stop'
$app = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$full = Join-Path $here 'FULL\src'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $app "_broken_0.0.18_$stamp"

Write-Host '============================================================'
Write-Host ' Spaces 0.0.18 Full Source Repair'
Write-Host '============================================================'

if (-not (Test-Path (Join-Path $app 'package.json'))) { throw "SpacesApp not found at $app" }
if (-not (Test-Path $full)) { throw "Repair source payload missing at $full" }

Write-Host '[1/4] Backing up currently broken src...'
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item (Join-Path $app 'src') (Join-Path $backup 'src') -Recurse -Force
Copy-Item (Join-Path $app 'src-tauri\Cargo.toml') $backup -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $app 'src-tauri\Cargo.lock') $backup -Force -ErrorAction SilentlyContinue

Write-Host '[2/4] Restoring the complete 0.0.18 source tree...'
Copy-Item (Join-Path $full '*') (Join-Path $app 'src') -Recurse -Force

Write-Host '[3/4] Synchronizing package, Tauri and Rust versions...'
& node (Join-Path $here 'scripts\sync-version.cjs') $app '0.0.18'
if ($LASTEXITCODE -ne 0) { throw 'Version synchronization failed.' }

Write-Host '[4/4] Checking restored feature files...'
& node (Join-Path $here 'scripts\check-source.cjs') $app
if ($LASTEXITCODE -ne 0) { throw 'Source validation failed.' }

Write-Host ''
Write-Host '[OK] Full source repair applied.' -ForegroundColor Green
Write-Host "Backup: $backup"
Write-Host ''
Write-Host 'Next run:'
Write-Host '  cd "$env:USERPROFILE\OneDrive\Documents\SpacesApp"'
Write-Host '  npm.cmd run typecheck'
Write-Host '  npm.cmd run build'
