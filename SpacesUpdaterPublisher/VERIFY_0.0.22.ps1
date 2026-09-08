$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$oldHost = 'scrounge-spaces-api.spagotei.workers.dev'
$newHost = 'spaces.spagotei.workers.dev'
if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
Set-Location $project

Write-Host '============================================================' -ForegroundColor DarkGray
Write-Host ' Spaces 0.0.22 - Spaces-only cutover verification' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor DarkGray

node (Join-Path $here 'scripts\check-version.cjs') $project '0.0.22'
if ($LASTEXITCODE -ne 0) { throw 'Version verification failed.' }
Write-Host '[1/5] package/Tauri/Rust versions are 0.0.22.' -ForegroundColor Green

if (-not (Select-String -Path '.\src\api\config.ts' -SimpleMatch $newHost -Quiet)) { throw 'Frontend default API URL is not the Spaces Worker.' }
if (Select-String -Path '.\src\api\config.ts' -SimpleMatch $oldHost -Quiet) { throw 'Old Scrounge Worker URL remains in frontend API config.' }
$tauri = '.\src-tauri\tauri.conf.json'
if ((Test-Path $tauri) -and (Select-String -Path $tauri -SimpleMatch $oldHost -Quiet)) { throw 'Old Scrounge Worker URL remains in tauri.conf.json.' }
foreach ($envFile in Get-ChildItem . -File -Filter '.env*' -ErrorAction SilentlyContinue) {
  if (Select-String -Path $envFile.FullName -SimpleMatch $oldHost -Quiet) { throw "Old Worker URL remains in $($envFile.Name)" }
}
Write-Host '[2/5] Active client API/updater configuration points away from scrounge-spaces-api.' -ForegroundColor Green

npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
Write-Host '[3/5] Typecheck OK.' -ForegroundColor Green

npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
Write-Host '[4/5] Production frontend build OK.' -ForegroundColor Green

node --check (Join-Path $here 'BACKEND\src\worker.js')
if ($LASTEXITCODE -ne 0) { throw 'Packaged Worker syntax check failed.' }
Write-Host '[5/5] Spaces Worker syntax OK.' -ForegroundColor Green
Write-Host '0.0.22 client cutover is verified. Deploy the Spaces Worker next.' -ForegroundColor Cyan
