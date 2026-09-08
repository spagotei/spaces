$ErrorActionPreference = 'Stop'
$project = Join-Path $env:USERPROFILE 'OneDrive\Documents\SpacesApp'
if (-not (Test-Path $project)) { throw "SpacesApp not found at $project" }
Set-Location $project
npm.cmd run tauri dev
