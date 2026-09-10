$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$patch = Join-Path $here 'PATCH'
if (-not (Test-Path $project)) { throw "SpacesApp not found: $project" }
$files = @(
  'src\features\shell\AppShell.tsx',
  'src\styles\standalone-v17.css'
)
$backup = Join-Path $project ('_backup_account_quick_status_' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($rel in $files) {
  $src = Join-Path $patch $rel
  $dst = Join-Path $project $rel
  if (-not (Test-Path $src)) { throw "Patch file missing: $src" }
  if (Test-Path $dst) {
    $backupFile = Join-Path $backup $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $backupFile) -Force | Out-Null
    Copy-Item $dst $backupFile -Force
  }
  New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
  Copy-Item $src $dst -Force
}
Write-Host '[OK] Account quick-menu presence indicator patched.' -ForegroundColor Green
Write-Host "Backup: $backup"
Write-Host 'No Worker deploy, D1 migration, or version bump is required.'
