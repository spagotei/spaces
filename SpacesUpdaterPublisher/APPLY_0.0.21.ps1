$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $here 'FULL\src'

if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
if (-not (Test-Path $source)) { throw "Package source missing at $source" }

$requiredCurrent = @(
  'src\App.tsx',
  'src\features\shell\AppShell.tsx',
  'src\features\notes\NotesView.tsx',
  'src\features\settings\SettingsView.tsx',
  'src\features\account\PersonalSettings.tsx',
  'src\features\support\SupportConsole.tsx',
  'src\styles\standalone-v20.css'
)
foreach ($rel in $requiredCurrent) {
  if (-not (Test-Path (Join-Path $project $rel))) {
    throw "Current Spaces source is incomplete: missing $rel. Stop before applying."
  }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $project "_backup_before_0.0.21_$stamp"
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

Write-Host 'Installing full Spaces 0.0.21 frontend source...' -ForegroundColor Cyan
$null = robocopy $source (Join-Path $project 'src') /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

node (Join-Path $here 'scripts\sync-version.cjs') $project '0.0.21'
if ($LASTEXITCODE -ne 0) { throw 'Version synchronization failed.' }

Write-Host '[OK] Spaces 0.0.21 source applied.' -ForegroundColor Green
Write-Host '[OK] Compact Space identity editor; no Live Preview block.' -ForegroundColor Green
Write-Host '[OK] Developer mode + generated Spaces IDs + Support account lookup/staff chat installed.' -ForegroundColor Green
Write-Host '[OK] Invite codes remain Spaces-generated only; category label font normalized.' -ForegroundColor Green
Write-Host '[INFO] 0016 D1 migration + Worker deploy are REQUIRED before testing Support IDs/staff chat.' -ForegroundColor Yellow
Write-Host "Backup: $backup"
