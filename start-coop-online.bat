@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ===== Youxu Huilang :: Co-op over the Internet =====
echo.

if exist ".git" (
  echo [1/3] Updating code from GitHub...
  git pull
  if errorlevel 1 echo       Update failed. Using the local copy.
) else (
  echo [1/3] This folder is not a git clone - cannot auto-update.
  echo       Using the local copy. See coop-msg-install.txt.
)
echo.

rem ---- Locate a tunnel tool. Priority: cloudflared, ngrok, cpolar. ----
call :findexe cloudflared.exe
if defined _p goto have_cf
call :findexe ngrok.exe
if defined _p goto have_ngrok
call :findexe cpolar.exe
if defined _p goto have_cpolar
goto no_tool

:have_cf
set "TOOL=%_p%"
set "TNAME=cloudflared"
set "TARG=tunnel --url http://localhost:8080"
goto launch

:have_ngrok
set "TOOL=%_p%"
set "TNAME=ngrok"
set "TARG=http 8080"
goto launch

:have_cpolar
set "TOOL=%_p%"
set "TNAME=cpolar"
set "TARG=http 8080"
goto launch

:launch
echo [2/3] Starting game server...
start "Youxu Server" cmd /k chcp 65001 ^>nul ^&^& node server.js
timeout /t 3 /nobreak >nul
echo [3/3] Starting tunnel via %TNAME% ...
start "Youxu Tunnel" cmd /k "%TOOL%" %TARG%
echo.
if exist "coop-msg-url.txt" type "coop-msg-url.txt"
goto done

:no_tool
echo [2/3] Starting game server...
start "Youxu Server" cmd /k chcp 65001 ^>nul ^&^& node server.js
echo [3/3] No tunnel tool found - LAN play still works.
echo.
if exist "coop-msg-install.txt" type "coop-msg-install.txt"
start "" https://github.com/cloudflare/cloudflared/releases/latest
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
