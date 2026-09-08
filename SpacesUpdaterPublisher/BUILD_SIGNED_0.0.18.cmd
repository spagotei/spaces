@echo off
setlocal EnableExtensions
set "APP=%USERPROFILE%\OneDrive\Documents\SpacesApp"
set "KEY=%USERPROFILE%\.tauri\spaces.key"

if not exist "%APP%\package.json" (
  echo [ERROR] SpacesApp not found at %APP%
  pause
  exit /b 1
)
if not exist "%KEY%" (
  echo [ERROR] Spaces updater private key not found at:
  echo   %KEY%
  echo Do NOT generate a replacement key. The installed clients trust the existing public key.
  pause
  exit /b 1
)

echo ============================================================
echo   Spaces 0.0.18 Signed Desktop Build
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$env:TAURI_SIGNING_PRIVATE_KEY='%KEY%';" ^
  "$pwd=[Environment]::GetEnvironmentVariable('TAURI_SIGNING_PRIVATE_KEY_PASSWORD','User');" ^
  "if(-not $pwd){$secure=Read-Host 'Enter Spaces updater signing-key password' -AsSecureString;$pwd=[System.Net.NetworkCredential]::new('', $secure).Password};" ^
  "$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD=$pwd;" ^
  "Set-Location '%APP%';" ^
  "& npm.cmd run desktop:build; exit $LASTEXITCODE"
if errorlevel 1 (
  echo.
  echo [ERROR] Signed build failed.
  pause
  exit /b 1
)

echo.
echo [OK] Signed 0.0.18 desktop build complete.
pause
exit /b 0
