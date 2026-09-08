$ErrorActionPreference = 'Stop'
$backend = Join-Path $env:USERPROFILE 'OneDrive\Documents\spaces'
$app = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$installer = Join-Path $app 'src-tauri\target\release\bundle\nsis\Spaces_0.0.22_x64-setup.exe'
$sig = "$installer.sig"
$publisher = Join-Path $backend 'scripts\publish-desktop-update.mjs'

if (-not (Test-Path $publisher)) { throw "Updater publisher not found at $publisher" }
if (-not (Test-Path $installer)) { throw 'Signed 0.0.22 NSIS installer not found. Build it first.' }
if (-not (Test-Path $sig)) { throw '0.0.22 updater signature not found. Build with TAURI_SIGNING_PRIVATE_KEY first.' }

Set-Location $backend
$env:SPACES_PREVIOUS_VERSION = '0.0.21'
node '.\scripts\publish-desktop-update.mjs'
if ($LASTEXITCODE -ne 0) { throw 'Updater publish failed.' }

Write-Host '[OK] Spaces 0.0.22 published to spaces-desktop-releases.' -ForegroundColor Green
Write-Host '[INFO] 0.0.21 and older can discover this release through the old compatibility Worker.' -ForegroundColor Yellow
Write-Host '[INFO] After installing 0.0.22, future update checks go directly to spaces.spagotei.workers.dev.' -ForegroundColor Cyan
