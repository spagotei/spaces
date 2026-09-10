@echo off
setlocal EnableExtensions
set "TARGET=%USERPROFILE%\OneDrive\Documents\SpacesApp"
set "PATCH=%~dp0PATCH"

echo.
echo ============================================================
echo   Spaces 0.0.12 REAL FIX - deterministic source apply
echo ============================================================
echo.

if not exist "%TARGET%\package.json" (
  echo [ERROR] SpacesApp was not found at:
  echo         %TARGET%
  echo.
  echo Move this folder next to your project or edit TARGET in this file.
  pause
  exit /b 1
)

if not exist "%PATCH%\src\App.tsx" (
  echo [ERROR] PATCH files are missing.
  pause
  exit /b 1
)

echo Target: %TARGET%
echo.
echo IMPORTANT: src-tauri\tauri.conf.json will NOT be touched.
echo Your existing updater public key/endpoints stay exactly as-is.
echo.

robocopy "%PATCH%\src" "%TARGET%\src" /E /PURGE /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :copyfail
robocopy "%PATCH%\public" "%TARGET%\public" /E /PURGE /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :copyfail
robocopy "%PATCH%\scripts" "%TARGET%\scripts" /E /PURGE /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :copyfail
copy /Y "%PATCH%\package.json" "%TARGET%\package.json" >nul
copy /Y "%PATCH%\src-tauri\Cargo.toml" "%TARGET%\src-tauri\Cargo.toml" >nul
copy /Y "%PATCH%\src-tauri\build.rs" "%TARGET%\src-tauri\build.rs" >nul
robocopy "%PATCH%\src-tauri\capabilities" "%TARGET%\src-tauri\capabilities" /E /PURGE /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :copyfail
robocopy "%PATCH%\src-tauri\src" "%TARGET%\src-tauri\src" /E /PURGE /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :copyfail
robocopy "%PATCH%\src-tauri\icons" "%TARGET%\src-tauri\icons" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :copyfail

if exist "%TARGET%\START_DEVICE_LAB.cmd" del /Q "%TARGET%\START_DEVICE_LAB.cmd" >nul 2>&1

echo [OK] 0.0.12 source files copied into the REAL SpacesApp project.
echo [OK] Updater config preserved.
echo [OK] Live Device Lab launcher removed.
echo.
echo Now running the built-in verification...
call "%~dp0VERIFY_0.0.12.cmd" nopause
if errorlevel 1 exit /b 1

echo.
echo Next:
echo   cd /d "%TARGET%"
echo   npm.cmd install
echo   npm.cmd run typecheck
echo   npm.cmd run release:prepare
echo.
pause
exit /b 0

:copyfail
echo [ERROR] A file copy failed. Nothing was intentionally written to tauri.conf.json.
pause
exit /b 1
