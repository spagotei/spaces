$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$backup = Join-Path $project ("_backup_status_pfp_fix_" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path (Join-Path $backup 'src\features\shell') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $backup 'src\styles') | Out-Null
Copy-Item (Join-Path $project 'src\features\shell\AppShell.tsx') (Join-Path $backup 'src\features\shell\AppShell.tsx') -Force
Copy-Item (Join-Path $project 'src\styles\standalone-v17.css') (Join-Path $backup 'src\styles\standalone-v17.css') -Force
Copy-Item (Join-Path $here 'PATCH\src\features\shell\AppShell.tsx') (Join-Path $project 'src\features\shell\AppShell.tsx') -Force
Copy-Item (Join-Path $here 'PATCH\src\styles\standalone-v17.css') (Join-Path $project 'src\styles\standalone-v17.css') -Force
Write-Host "[OK] Removed the right-side presence pill." -ForegroundColor Green
Write-Host "[OK] Presence now lives only on the profile picture bottom-right." -ForegroundColor Green
Write-Host "Backup: $backup"
