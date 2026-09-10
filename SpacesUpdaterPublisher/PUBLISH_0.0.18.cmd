@echo off
setlocal EnableExtensions
set "BACKEND=%USERPROFILE%\OneDrive\Documents\spaces"
set "APP=%USERPROFILE%\OneDrive\Documents\SpacesApp"

if not exist "%BACKEND%\scripts\publish-desktop-update.mjs" (
  echo [ERROR] Updater publisher not found.
  pause
  exit /b 1
)
if not exist "%APP%\src-tauri\target\release\bundle\nsis\Spaces_0.0.18_x64-setup.exe" (
  echo [ERROR] Signed 0.0.18 NSIS installer was not found.
  echo Run BUILD_SIGNED_0.0.18.cmd first.
  pause
  exit /b 1
)
if not exist "%APP%\src-tauri\target\release\bundle\nsis\Spaces_0.0.18_x64-setup.exe.sig" (
  echo [ERROR] 0.0.18 updater signature was not found.
  pause
  exit /b 1
)

cd /d "%BACKEND%"
set "SPACES_PREVIOUS_VERSION=0.0.17"
node scripts\publish-desktop-update.mjs
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   Spaces 0.0.18 published to the updater.
echo ============================================================
pause
