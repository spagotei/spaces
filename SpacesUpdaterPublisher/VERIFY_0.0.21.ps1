$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
Set-Location $project

Write-Host '============================================================' -ForegroundColor DarkGray
Write-Host ' Spaces 0.0.21 verification' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor DarkGray

$required = @(
  'src\App.tsx',
  'src\components\Avatar.tsx',
  'src\components\MemberProfileDrawer.tsx',
  'src\features\shell\AppShell.tsx',
  'src\features\notes\NotesView.tsx',
  'src\features\settings\SettingsView.tsx',
  'src\features\account\PersonalSettings.tsx',
  'src\features\members\MembersView.tsx',
  'src\features\support\SupportConsole.tsx',
  'src\styles\standalone-v21.css'
)
foreach ($rel in $required) { if (-not (Test-Path $rel)) { throw "Missing $rel" } }

node (Join-Path $here 'scripts\check-version.cjs') $project '0.0.21'
if ($LASTEXITCODE -ne 0) { throw 'Version verification failed.' }
Write-Host '[1/4] Required source + package/Tauri/Rust versions OK.' -ForegroundColor Green

if (Select-String -Path '.\src\features\settings\SettingsView.tsx' -Pattern 'LIVE PREVIEW|Live Preview' -Quiet) {
  throw 'Old Live Preview UI is still present in SettingsView.'
}
Write-Host '[2/4] 0.0.21 UI replacement checks OK.' -ForegroundColor Green

npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
Write-Host '[3/4] Typecheck OK.' -ForegroundColor Green

npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
Write-Host '[4/4] Production frontend build OK.' -ForegroundColor Green

node --check (Join-Path $here 'BACKEND\src\worker.js')
if ($LASTEXITCODE -ne 0) { throw 'Packaged Worker syntax check failed.' }
Write-Host '[OK] Packaged Worker syntax OK.' -ForegroundColor Green
Write-Host '0.0.21 is ready for local UI testing after the required backend deploy.' -ForegroundColor Cyan
