@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ===== Youxu Huilang :: Co-op with a FIXED address - Tailscale Funnel =====
echo.

if exist ".git" (
  echo [1/4] Updating code from GitHub...
  git pull
  if errorlevel 1 echo       Update failed. Using the local copy.
) else (
  echo [1/4] This folder is not a git clone - cannot auto-update.
  echo       Using the local copy. See coop-msg-install.txt.
)
echo.

echo [2/4] Looking for Tailscale...
call :findexe tailscale.exe
if not defined _p goto no_ts
set "TS=%_p%"
echo       Found: %TS%
echo.

echo [3/4] Starting game server...
start "Youxu Server" cmd /k chcp 65001 ^>nul ^&^& node server.js
timeout /t 3 /nobreak >nul
echo.

echo [4/4] Turning on Tailscale Funnel for port 8080...
"%TS%" funnel --bg 8080
if errorlevel 1 goto ts_failed
echo.

set "TSFILE=%TEMP%\youxu_funnel.txt"
"%TS%" funnel status > "%TSFILE%" 2>&1
set "TSURL="
for /f "tokens=1" %%i in ('findstr /b /c:"https://" "%TSFILE%"') do if not defined TSURL set "TSURL=%%i"
if not defined TSURL goto no_url

echo   ==========================================================
echo     %TSURL%/coop.html
echo   ==========================================================
echo.
if exist "coop-msg-fixed.txt" type "coop-msg-fixed.txt"
goto done

:no_url
echo       Could not read the address automatically. Raw status below.
echo.
type "%TSFILE%"
echo.
echo       Take the line that starts with https:// and add /coop.html
echo.
if exist "coop-msg-fixed.txt" type "coop-msg-fixed.txt"
goto done

:ts_failed
echo.
echo       Tailscale Funnel did not start - first-time setup is needed.
echo.
if exist "coop-msg-tailscale.txt" type "coop-msg-tailscale.txt"
start "" https://login.tailscale.com/admin/dns
goto done

:no_ts
echo       Tailscale not found.
echo.
echo [3/4] Starting game server...
start "Youxu Server" cmd /k chcp 65001 ^>nul ^&^& node server.js
echo [4/4] LAN play still works. Install Tailscale for a fixed public address.
echo.
if exist "coop-msg-tailscale.txt" type "coop-msg-tailscale.txt"
start "" https://tailscale.com/download/windows
goto done

:findexe
rem arg 1 = exe file name; full path goes into _p
set "_p="
for %%I in (%~1) do if exist "%%~$PATH:I" set "_p=%%~$PATH:I"
if not defined _p if exist "%~dp0%~1" set "_p=%~dp0%~1"
if not defined _p if exist "%ProgramFiles%\%~n1\%~1" set "_p=%ProgramFiles%\%~n1\%~1"
if not defined _p if exist "%ProgramFiles(x86)%\%~n1\%~1" set "_p=%ProgramFiles(x86)%\%~n1\%~1"
if not defined _p if exist "%LOCALAPPDATA%\%~n1\%~1" set "_p=%LOCALAPPDATA%\%~n1\%~1"
goto :eof

:done
echo.
pause
