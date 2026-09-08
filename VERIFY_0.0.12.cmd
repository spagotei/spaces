@echo off
setlocal EnableExtensions
set "TARGET=%USERPROFILE%\OneDrive\Documents\SpacesApp"
set "FAILED=0"

echo.
echo --- Spaces 0.0.12 source verification ---

call :check "%TARGET%\package.json" "\"version\": \"0.0.12\"" "package version 0.0.12"
call :check "%TARGET%\src\features\shell\AppShell.tsx" "Delete channel" "channel delete action"
call :check "%TARGET%\src\features\shell\AppShell.tsx" "Delete category" "category delete action"
call :check "%TARGET%\src\features\notes\NotesView.tsx" "Delete note" "note delete action"
call :check "%TARGET%\src\features\notes\NotesView.tsx" "Export .txt" "note TXT export"
call :check "%TARGET%\src\features\notes\NotesView.tsx" "Update from .txt" "note TXT update/import"
call :check "%TARGET%\src\features\chat\ChatView.tsx" ".png,.jpg,.jpeg,.webp,.txt" "restricted chat file picker"
call :check "%TARGET%\src\features\chat\ChatView.tsx" "ImagePreview" "chat image preview"
call :check "%TARGET%\src\styles\standalone-v12.css" ".presence-text-online" "plain status text styling"
call :check "%TARGET%\src\App.tsx" "standalone-v12.css" "0.0.12 stylesheet loaded"
call :check "%TARGET%\src\features\auth\LoginScreen.tsx" "login-network" "slow login network animation"
call :check "%TARGET%\src\components\CustomCursor.tsx" "spaces-crosshair-cursor" "optional crosshair cursor"

if not exist "%TARGET%\src-tauri\icons\icon.png" (
  echo [FAIL] transparent PNG app icon missing
  set "FAILED=1"
) else (
  echo [ OK ] transparent PNG app icon present
)

if exist "%TARGET%\START_DEVICE_LAB.cmd" (
  echo [FAIL] old Device Lab launcher is still present
  set "FAILED=1"
) else (
  echo [ OK ] old Device Lab launcher removed
)

if "%FAILED%"=="1" (
  echo.
  echo Verification FAILED. Do not build yet.
  if /I not "%~1"=="nopause" pause
  exit /b 1
)

echo.
echo Verification PASSED. These are the files your next build will compile.
if /I not "%~1"=="nopause" pause
exit /b 0

:check
findstr /C:"%~2" "%~1" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] %~3
  set "FAILED=1"
) else (
  echo [ OK ] %~3
)
exit /b 0
