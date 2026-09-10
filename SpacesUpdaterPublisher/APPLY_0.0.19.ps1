$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $here 'FULL\src'
if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
if (-not (Test-Path $source)) { throw "Package source missing at $source" }
$required = @(
  'src\App.tsx',
  'src\features\shell\AppShell.tsx',
  'src\features\settings\SettingsView.tsx',
  'src\features\auth\LoginScreen.tsx',
  'src\features\support\SupportConsole.tsx',
  'src\styles\standalone-v18.css'
)
foreach ($rel in $required) { if (-not (Test-Path (Join-Path $project $rel))) { throw "Current source is incomplete: missing $rel. Stop before applying." } }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $project "_backup_before_0.0.19_$stamp"
Write-Host "Backing up current source to $backup" -ForegroundColor Cyan
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
Write-Host 'Installing full 0.0.19 frontend source...' -ForegroundColor Cyan
$null = robocopy $source (Join-Path $project 'src') /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
node (Join-Path $here 'scripts\sync-version.cjs') $project '0.0.19'
Write-Host '[OK] Spaces 0.0.19 source applied.' -ForegroundColor Green
Write-Host '[OK] Channel navigation now opens expanded and only collapses when the user presses the arrow.' -ForegroundColor Green
Write-Host '[OK] Space picture settings rebuilt with centered image fitting and responsive mobile/tablet layout.' -ForegroundColor Green
Write-Host '[OK] No Worker deploy or D1 migration is required.' -ForegroundColor Green
Write-Host "Backup: $backup"
