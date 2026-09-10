$ErrorActionPreference = 'Stop'
$backend = Join-Path $env:USERPROFILE 'OneDrive\Documents\spaces'
$app = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$installer = Join-Path $app 'src-tauri\target\release\bundle\nsis\Spaces_0.0.23_x64-setup.exe'
$sig = "$installer.sig"
$publisher = Join-Path $backend 'scripts\publish-desktop-update.mjs'
if (-not (Test-Path $publisher)) { throw "Updater publisher not found at $publisher" }
if (-not (Test-Path $installer)) { throw 'Signed 0.0.23 NSIS installer not found. Build it first.' }
if (-not (Test-Path $sig)) { throw '0.0.23 updater signature not found. Build with the Spaces signing key first.' }
Set-Location $backend
$env:SPACES_PREVIOUS_VERSION = '0.0.22'
node '.\scripts\publish-desktop-update.mjs'
if ($LASTEXITCODE -ne 0) { throw 'Updater publish failed.' }
Write-Host '[OK] Spaces 0.0.23 published to spaces-desktop-releases.' -ForegroundColor Green
Write-Host '[OK] 0.0.22+ clients discover releases through spaces.spagotei.workers.dev.' -ForegroundColor Cyan
