$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $here 'FULL\src'
$oldApi = 'https://scrounge-spaces-api.spagotei.workers.dev'
$newApi = 'https://spaces.spagotei.workers.dev'

if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
if (-not (Test-Path $source)) { throw "Package source missing at $source" }

$requiredCurrent = @(
  'src\App.tsx',
  'src\api\config.ts',
  'src\features\shell\AppShell.tsx',
  'src\features\support\SupportConsole.tsx',
  'src\styles\standalone-v21.css'
)
foreach ($rel in $requiredCurrent) {
  if (-not (Test-Path (Join-Path $project $rel))) {
    throw "Current Spaces source is incomplete: missing $rel"
  }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $project "_backup_before_0.0.22_$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item (Join-Path $project 'src') (Join-Path $backup 'src') -Recurse -Force
foreach ($rel in @('package.json','package-lock.json','src-tauri\tauri.conf.json','src-tauri\Cargo.toml','src-tauri\Cargo.lock')) {
  $src = Join-Path $project $rel
  if (Test-Path $src) {
    $dst = Join-Path $backup $rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
    Copy-Item $src $dst -Force
  }
}
foreach ($envFile in Get-ChildItem $project -File -Filter '.env*' -ErrorAction SilentlyContinue) {
  Copy-Item $envFile.FullName (Join-Path $backup $envFile.Name) -Force
}

Write-Host '[1/4] Installing Spaces-only 0.0.22 frontend source...' -ForegroundColor Cyan
$null = robocopy $source (Join-Path $project 'src') /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

Write-Host '[2/4] Switching API host to spaces.spagotei.workers.dev...' -ForegroundColor Cyan
$tauri = Join-Path $project 'src-tauri\tauri.conf.json'
if (Test-Path $tauri) {
  $raw = Get-Content $tauri -Raw
  $raw = $raw.Replace($oldApi, $newApi)
  [System.IO.File]::WriteAllText($tauri, $raw, (New-Object System.Text.UTF8Encoding($false)))
}
foreach ($envFile in Get-ChildItem $project -File -Filter '.env*' -ErrorAction SilentlyContinue) {
  $raw = Get-Content $envFile.FullName -Raw
  if ($raw.Contains($oldApi)) {
    $raw = $raw.Replace($oldApi, $newApi)
    [System.IO.File]::WriteAllText($envFile.FullName, $raw, (New-Object System.Text.UTF8Encoding($false)))
  }
}

Write-Host '[3/4] Synchronizing version 0.0.22 across package/Tauri/Rust...' -ForegroundColor Cyan
node (Join-Path $here 'scripts\sync-version.cjs') $project '0.0.22'
if ($LASTEXITCODE -ne 0) { throw 'Version synchronization failed.' }

Write-Host '[4/4] Checking the old Worker hostname is gone from active client config...' -ForegroundColor Cyan
$activeFiles = @(
  (Join-Path $project 'src\api\config.ts'),
  (Join-Path $project 'src-tauri\tauri.conf.json')
)
$activeFiles += (Get-ChildItem $project -File -Filter '.env*' -ErrorAction SilentlyContinue | ForEach-Object FullName)
foreach ($file in $activeFiles) {
  if ((Test-Path $file) -and (Select-String -Path $file -SimpleMatch $oldApi -Quiet)) {
    throw "Old Scrounge Worker URL still exists in $file"
  }
}

Write-Host '[OK] SpacesApp now targets https://spaces.spagotei.workers.dev' -ForegroundColor Green
Write-Host '[OK] Future updater checks from 0.0.22 use the Spaces Worker.' -ForegroundColor Green
Write-Host '[INFO] The old scrounge-spaces-api Worker is intentionally left untouched so 0.0.21 and older can discover 0.0.22.' -ForegroundColor Yellow
Write-Host "Backup: $backup"
