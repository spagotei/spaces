$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$oldHost = 'scrounge-spaces-api.spagotei.workers.dev'
$newHost = 'spaces.spagotei.workers.dev'
if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
Set-Location $project

Write-Host '============================================================' -ForegroundColor DarkGray
Write-Host ' Spaces 0.0.23 Verification' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor DarkGray

node (Join-Path $here 'scripts\check-version.cjs') $project '0.0.23'
if ($LASTEXITCODE -ne 0) { throw 'Version verification failed.' }
Write-Host '[1/6] Version metadata is synchronized.' -ForegroundColor Green

$required = @(
  '.\src\components\DirectMessagesCenter.tsx',
  '.\src\components\WorkspacePrivacyModal.tsx',
  '.\src\styles\standalone-v23.css'
)
foreach ($file in $required) { if (-not (Test-Path $file)) { throw "Missing required source: $file" } }
if (-not (Select-String -Path '.\src\App.tsx' -SimpleMatch "standalone-v23.css" -Quiet)) { throw 'standalone-v23.css is not imported.' }
if (-not (Select-String -Path '.\src\App.tsx' -SimpleMatch 'useLayoutEffect' -Quiet)) { throw 'Post-login boot gate is missing.' }
Write-Host '[2/6] Identity, messages, privacy and boot source is present.' -ForegroundColor Green

if (-not (Select-String -Path '.\src\api\config.ts' -SimpleMatch $newHost -Quiet)) { throw 'Frontend is not targeting the Spaces Worker.' }
if (Select-String -Path '.\src\api\config.ts' -SimpleMatch $oldHost -Quiet) { throw 'Old Scrounge Worker remains in frontend API config.' }
if (Select-String -Path '.\src\features\account\PersonalSettings.tsx' -SimpleMatch 'Public profile' -Quiet) { throw 'Legacy Public profile setting is still visible.' }
Write-Host '[3/6] Canonical Spaces host + account UI checks passed.' -ForegroundColor Green

npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
Write-Host '[4/6] Typecheck OK.' -ForegroundColor Green

npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
Write-Host '[5/6] Production frontend build OK.' -ForegroundColor Green

node --check (Join-Path $here 'BACKEND\src\worker.js')
if ($LASTEXITCODE -ne 0) { throw 'Packaged Worker syntax check failed.' }
Write-Host '[6/6] Packaged Spaces Worker syntax OK.' -ForegroundColor Green
Write-Host '[OK] 0.0.23 is ready for D1 migration + Spaces Worker deployment.' -ForegroundColor Cyan
