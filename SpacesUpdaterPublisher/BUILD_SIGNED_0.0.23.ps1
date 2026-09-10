$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
$keyPath = Join-Path $env:USERPROFILE '.tauri\spaces.key'
if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
if (-not (Test-Path $keyPath)) { throw "Spaces updater key not found at $keyPath" }
Set-Location $project
$env:TAURI_SIGNING_PRIVATE_KEY = $keyPath
$storedPassword = [Environment]::GetEnvironmentVariable('TAURI_SIGNING_PRIVATE_KEY_PASSWORD','User')
if ($storedPassword) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $storedPassword }
elseif (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  $secure = Read-Host 'Enter Spaces updater signing-key password' -AsSecureString
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
}
npm.cmd run desktop:build
if ($LASTEXITCODE -ne 0) { throw 'Signed desktop build failed.' }
Write-Host '[OK] Signed 0.0.23 desktop bundles created.' -ForegroundColor Green
