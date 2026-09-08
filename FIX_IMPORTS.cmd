@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo  SpacesApp import graph repair
 echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  pause
  exit /b 1
)

node fix-imports.mjs
if errorlevel 1 (
  echo.
  echo Import repair failed.
  pause
  exit /b 1
)

call npm.cmd run typecheck
set "CHECK=%ERRORLEVEL%"

echo.
if "%CHECK%"=="0" (
  echo ========================================
  echo  TYPECHECK CLEAN
  echo ========================================
) else (
  echo ========================================
  echo  Typecheck still has errors.
  echo  Copy the remaining output into ChatGPT.
  echo ========================================
)
echo.
pause
exit /b %CHECK%
