@echo off
setlocal EnableExtensions
set "APP=%USERPROFILE%\OneDrive\Documents\SpacesApp"

if not exist "%APP%\package.json" (
  echo [ERROR] SpacesApp not found at %APP%
  pause
  exit /b 1
)

pushd "%APP%" >nul

echo ============================================================
echo   Spaces 0.0.18 Verification
echo ============================================================
echo.

echo [1/5] Version metadata...
node -e "const fs=require('fs');const v='0.0.18';const p=require('./package.json');const t=JSON.parse(fs.readFileSync('./src-tauri/tauri.conf.json','utf8'));const toml=fs.readFileSync('./src-tauri/Cargo.toml','utf8');const lock=fs.readFileSync('./src-tauri/Cargo.lock','utf8');const tv=(toml.match(/\[package\][\s\S]*?version\s*=\s*\"([^\"]+)\"/)||[])[1];const lv=(lock.match(/\[\[package\]\]\r?\nname = \"spaces-app\"\r?\nversion = \"([^\"]+)\"/)||[])[1];if(p.version!==v||t.version!==v||tv!==v||lv!==v){console.error('Expected 0.0.18:',{package:p.version,tauri:t.version,cargo:tv,lock:lv});process.exit(1)}console.log('package:',p.version,'tauri:',t.version,'cargo:',tv,'lock:',lv)"
if errorlevel 1 goto :fail

echo [2/5] Required 0.0.18 files...
for %%F in (
  "src\styles\standalone-v18.css"
  "src\features\members\MembersView.tsx"
  "src\features\settings\SettingsView.tsx"
  "src\features\shell\AppShell.tsx"
) do (
  if not exist %%F (
    echo [ERROR] Missing %%F
    goto :fail
  )
)

echo [3/5] Native browser dialog scan...
node -e "const fs=require('fs'),path=require('path');let bad=[];function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n),s=fs.statSync(p);if(s.isDirectory())walk(p);else if(/\.(ts|tsx|js|jsx)$/.test(n)){const x=fs.readFileSync(p,'utf8');if(/\bwindow\.(confirm|prompt|alert)\s*\(/.test(x)||/(^|[^.\w])alert\s*\(/m.test(x))bad.push(p)}}}walk('src');if(bad.length){console.error('Native dialogs remain:',bad);process.exit(1)}console.log('No native browser confirm/prompt/alert calls found.')"
if errorlevel 1 goto :fail

echo [4/5] TypeScript typecheck...
call npm.cmd run typecheck
if errorlevel 1 goto :fail

echo [5/5] Frontend production build...
call npm.cmd run build
if errorlevel 1 goto :fail

popd >nul
echo.
echo ============================================================
echo   VERIFY PASSED
echo ============================================================
echo Run npm.cmd run desktop:dev to inspect the UI.
echo Then BUILD_SIGNED_0.0.18.cmd when ready.
pause
exit /b 0

:fail
popd >nul
echo.
echo ============================================================
echo   VERIFY FAILED - do not publish yet.
echo ============================================================
echo Copy the error output into ChatGPT.
pause
exit /b 1
