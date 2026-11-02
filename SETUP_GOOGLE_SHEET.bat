@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-google-sheet.ps1"
echo.
pause
