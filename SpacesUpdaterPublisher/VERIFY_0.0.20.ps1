$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
Set-Location $project
Write-Host '============================================================' -ForegroundColor DarkGray
Write-Host ' Spaces 0.0.20 verification' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor DarkGray
$required = @(
  'src\App.tsx',
  'src\components\Avatar.tsx',
  'src\features\shell\AppShell.tsx',
  'src\features\notes\NotesView.tsx',
  'src\features\settings\SettingsView.tsx',
  'src\features\account\PersonalSettings.tsx',
  'src\features\support\SupportConsole.tsx',
  'src\styles\standalone-v20.css'
)
foreach ($rel in $required) { if (-not (Test-Path $rel)) { throw "Missing $rel" } }
node (Join-Path $here 'scripts\check-version.cjs') $project '0.0.20'
if ($LASTEXITCODE -ne 0) { throw 'Version verification failed.' }
Write-Host '[1/3] Required source + version metadata OK.' -ForegroundColor Green
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
Write-Host '[2/3] Typecheck OK.' -ForegroundColor Green
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
Write-Host '[3/3] Production frontend build OK.' -ForegroundColor Green
Write-Host '0.0.20 is ready for desktop testing. Do not publish until the UI pass is approved.' -ForegroundColor Cyan
