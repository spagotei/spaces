$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $here 'FULL\src'
$canonicalApi = 'https://spaces.spagotei.workers.dev'
$oldHost = 'scrounge-spaces-api.spagotei.workers.dev'

if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
if (-not (Test-Path $source)) { throw "Package source missing at $source" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $project "_backup_before_0.0.23_$stamp"
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

Write-Host '[1/4] Installing full Spaces 0.0.23 frontend source...' -ForegroundColor Cyan
$null = robocopy $source (Join-Path $project 'src') /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

Write-Host '[2/4] Keeping the client on the canonical Spaces Worker...' -ForegroundColor Cyan
$apiConfig = Join-Path $project 'src\api\config.ts'
if (-not (Test-Path $apiConfig)) { throw 'src\api\config.ts is missing after install.' }
$rawApi = Get-Content $apiConfig -Raw
if ($rawApi -notmatch [regex]::Escape($canonicalApi)) { throw 'Canonical Spaces API URL is missing from src\api\config.ts.' }
if ($rawApi -match [regex]::Escape($oldHost)) { throw 'Old scrounge-spaces-api hostname remains in src\api\config.ts.' }

$tauri = Join-Path $project 'src-tauri\tauri.conf.json'
if (Test-Path $tauri) {
  $raw = Get-Content $tauri -Raw
  $raw = $raw.Replace('https://scrounge-spaces-api.spagotei.workers.dev', $canonicalApi)
  [System.IO.File]::WriteAllText($tauri, $raw, (New-Object System.Text.UTF8Encoding($false)))
}
foreach ($envFile in Get-ChildItem $project -File -Filter '.env*' -ErrorAction SilentlyContinue) {
  $raw = Get-Content $envFile.FullName -Raw
  if ($raw.Contains('https://scrounge-spaces-api.spagotei.workers.dev')) {
    $raw = $raw.Replace('https://scrounge-spaces-api.spagotei.workers.dev', $canonicalApi)
    [System.IO.File]::WriteAllText($envFile.FullName, $raw, (New-Object System.Text.UTF8Encoding($false)))
  }
}

Write-Host '[3/4] Synchronizing package, Tauri and Rust metadata to 0.0.23...' -ForegroundColor Cyan
node (Join-Path $here 'scripts\sync-version.cjs') $project '0.0.23'
if ($LASTEXITCODE -ne 0) { throw 'Version synchronization failed.' }

Write-Host '[4/4] Checking new 0.0.23 surfaces...' -ForegroundColor Cyan
$required = @(
  'src\components\DirectMessagesCenter.tsx',
  'src\components\WorkspacePrivacyModal.tsx',
  'src\styles\standalone-v23.css',
  'src\features\settings\SettingsView.tsx',
  'src\features\account\PersonalSettings.tsx'
)
foreach ($rel in $required) {
  if (-not (Test-Path (Join-Path $project $rel))) { throw "0.0.23 source is incomplete: missing $rel" }
}

Write-Host '[OK] Spaces 0.0.23 frontend applied.' -ForegroundColor Green
Write-Host '[OK] Full post-login boot animation is enabled before AppShell is shown.' -ForegroundColor Green
Write-Host '[INFO] Worker migration/deploy is separate because Message Requests use D1.' -ForegroundColor Yellow
Write-Host "Backup: $backup"
