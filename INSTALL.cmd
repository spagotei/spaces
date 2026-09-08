@echo off
cd /d "%~dp0"
echo Installing Spaces dependencies...
call npm.cmd install
pause
