@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===== Youxu Huilang :: LAN Co-op Server =====
echo.
if exist "coop-msg-lan.txt" type "coop-msg-lan.txt"
echo.

if exist ".git" (
  echo [1/2] Updating code from GitHub...
  git pull
  if errorlevel 1 echo       Update failed. Using the local copy.
) else (
  echo [1/2] This folder is not a git clone - cannot auto-update.
  echo       Re-clone with git if you want automatic updates.
)
echo.

echo [2/2] Starting server. Press Ctrl+C to stop.
echo.
node server.js
echo.
echo Server stopped.
pause
