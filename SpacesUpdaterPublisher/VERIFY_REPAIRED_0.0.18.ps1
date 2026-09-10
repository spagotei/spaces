$ErrorActionPreference = 'Stop'
$app = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $app

Write-Host '============================================================'
Write-Host ' Spaces 0.0.18 Repair Verification'
Write-Host '============================================================'

& node (Join-Path $here 'scripts\check-source.cjs') $app
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[1/3] Version metadata'
node -e "const fs=require('fs');const p=require('./package.json');const t=require('./src-tauri/tauri.conf.json');console.log('package:',p.version,'tauri:',t.version);"
Select-String .\src-tauri\Cargo.toml -Pattern '^version\s*='

Write-Host '[2/3] Typecheck'
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[3/3] Production frontend build'
npm.cmd run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host '[OK] Spaces 0.0.18 source and build verified.' -ForegroundColor Green
