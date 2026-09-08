@echo off
setlocal EnableExtensions

set "APP=%USERPROFILE%\OneDrive\Documents\SpacesApp"
set "HERE=%~dp0"
set "VERSION=0.0.18"

echo ============================================================
echo   Spaces %VERSION% UI Motion + Identity Polish Installer
echo ============================================================
echo.
echo Close Spaces before continuing.
echo This patch is intended for the working 0.0.17 project.
echo.

if not exist "%APP%\package.json" (
  echo [ERROR] SpacesApp was not found at:
  echo   %APP%
  pause
  exit /b 1
)
if not exist "%APP%\src-tauri\tauri.conf.json" (
  echo [ERROR] Tauri config was not found.
  pause
  exit /b 1
)

pushd "%APP%" >nul
for /f "usebackq delims=" %%V in (`node -e "try{process.stdout.write(require('./package.json').version||'')}catch(e){}" 2^>nul`) do set "CURRENT=%%V"
popd >nul
if not "%CURRENT%"=="0.0.17" if not "%CURRENT%"=="0.0.18" (
  echo [WARN] Current app version is "%CURRENT%". This patch was built for 0.0.17.
  echo If this is not the active Spaces project, press Ctrl+C now.
  pause
)

set "BACKUP=%APP%\_backup_before_0.0.18"
if not exist "%BACKUP%" mkdir "%BACKUP%" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Could not create backup folder.
  pause
  exit /b 1
)

if not exist "%BACKUP%\src" (
  robocopy "%APP%\src" "%BACKUP%\src" /E /COPY:DAT /DCOPY:T /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 (
    echo [ERROR] Could not back up the current app source.
    pause
    exit /b 1
  )
)
copy /Y "%APP%\package.json" "%BACKUP%\package.json" >nul
if exist "%APP%\package-lock.json" copy /Y "%APP%\package-lock.json" "%BACKUP%\package-lock.json" >nul
copy /Y "%APP%\src-tauri\tauri.conf.json" "%BACKUP%\tauri.conf.json" >nul
if exist "%APP%\src-tauri\Cargo.toml" copy /Y "%APP%\src-tauri\Cargo.toml" "%BACKUP%\Cargo.toml" >nul
if exist "%APP%\src-tauri\Cargo.lock" copy /Y "%APP%\src-tauri\Cargo.lock" "%BACKUP%\Cargo.lock" >nul

echo [1/3] Applying 0.0.18 frontend files...
robocopy "%HERE%PATCH\src" "%APP%\src" /E /COPY:DAT /DCOPY:T /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo [ERROR] App source copy failed. Close Spaces and retry.
  pause
  exit /b 1
)

echo [2/3] Synchronizing all version metadata...
pushd "%APP%" >nul
node -e "const fs=require('fs');const v='0.0.18';const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version=v;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');if(fs.existsSync('package-lock.json')){const l=JSON.parse(fs.readFileSync('package-lock.json','utf8'));l.version=v;if(l.packages&&l.packages[''])l.packages[''].version=v;fs.writeFileSync('package-lock.json',JSON.stringify(l,null,2)+'\n')}const t=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));t.version=v;fs.writeFileSync('src-tauri/tauri.conf.json',JSON.stringify(t,null,2)+'\n');if(fs.existsSync('src-tauri/Cargo.toml')){let c=fs.readFileSync('src-tauri/Cargo.toml','utf8');c=c.replace(/(\[package\][\s\S]*?^version\s*=\s*\")[^\"]+(\")/m,'$1'+v+'$2');fs.writeFileSync('src-tauri/Cargo.toml',c)}if(fs.existsSync('src-tauri/Cargo.lock')){let c=fs.readFileSync('src-tauri/Cargo.lock','utf8');c=c.replace(/(\[\[package\]\]\r?\nname = \"spaces-app\"\r?\nversion = \")[^\"]+(\")/,'$1'+v+'$2');fs.writeFileSync('src-tauri/Cargo.lock',c)}"
if errorlevel 1 (
  popd >nul
  echo [ERROR] Could not update version metadata.
  pause
  exit /b 1
)
popd >nul

echo [3/3] Copying release notes...
copy /Y "%HERE%CHANGELOG_0.0.18.txt" "%APP%\CHANGELOG_0.0.18.txt" >nul
if errorlevel 1 echo [WARN] Changelog copy failed, but the app patch was applied.

echo.
echo ============================================================
echo   Spaces 0.0.18 applied successfully.
echo ============================================================
echo No Worker deploy or migration is required.
echo Next: VERIFY_0.0.18.cmd
pause
exit /b 0
