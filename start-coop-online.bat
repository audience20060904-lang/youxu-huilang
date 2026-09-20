@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ===== 幽墟回廊 · 联机服务器 【公网版】 =====
echo.
echo 这个脚本会开两个窗口：一个跑游戏服务器，一个跑公网隧道。
echo 只有不在同一个 WiFi 下才需要用它；同一个 WiFi 请用 start-coop.bat，更快更稳。
echo.

if exist ".git" (
  echo 正在拉取最新代码…
  git pull
  if errorlevel 1 (
    echo.
    echo 拉取失败 —— 可能没装 Git，或者这会儿没联网。将直接用本地现有代码启动。
  )
) else (
  echo 这个文件夹不是用 git clone 建的，没法自动拉取最新代码。
  echo 想要以后能自动更新，请改用 git clone 重新拉一份仓库。
)
echo.

rem ---- 按优先级找隧道工具：cloudflared 最省事，其次 ngrok，最后 cpolar ----
call :findexe cloudflared.exe
set "CF=%_p%"
call :findexe ngrok.exe
set "NGROK=%_p%"
call :findexe cpolar.exe
set "CPOLAR=%_p%"

echo 正在启动游戏服务器…
start "幽墟回廊 · 服务器" cmd /k node server.js
timeout /t 3 /nobreak >nul
echo.

if defined CF goto usecf
if defined NGROK goto usengrok
if defined CPOLAR goto usecpolar
goto notool

:usecf
echo 找到 cloudflared，正在开公网隧道…
start "公网隧道 · cloudflared" cmd /k ""%CF%" tunnel --url http://localhost:8080"
echo.
echo ================================================
echo  看那个隧道窗口，里面会框出一行地址，形如：
echo    https://某些单词拼起来.trycloudflare.com
echo.
echo  把它后面接上 /coop.html，这就是两人都要打开的网址：
echo    https://某些单词拼起来.trycloudflare.com/coop.html
echo.
echo  这个地址每次重启都会变，每次重开都要重新发给队友。
echo ================================================
goto done

:usengrok
echo 找到 ngrok，正在开公网隧道…
start "公网隧道 · ngrok" cmd /k ""%NGROK%" http 8080"
echo.
echo ================================================
echo  看那个隧道窗口的 Forwarding 那一行，抄 https 开头的地址，
echo  后面接上 /coop.html，这就是两人都要打开的网址。
echo.
echo  ngrok 免费版第一次打开会先显示一个提示页，点 Visit Site 就进去了。
echo  没有 Forwarding 只有报错的话，多半是还没跑过
echo    ngrok config add-authtoken 你的token
echo ================================================
goto done

:usecpolar
echo 找到 cpolar，正在开公网隧道…
start "公网隧道 · cpolar" cmd /k ""%CPOLAR%" http 8080"
echo.
echo ================================================
echo  看那个隧道窗口的 Forwarding 那一行，抄 https 开头的地址，
echo  后面接上 /coop.html，这就是两人都要打开的网址。
echo ================================================
goto done

:notool
echo ================================================
echo  没找到任何隧道工具，公网隧道没起来。
echo  游戏服务器已经开着了，同一个 WiFi 下照样能玩。
echo.
echo  想跨网络的话，推荐 cloudflared —— 不用注册、不用实名：
echo    1. 去 https://github.com/cloudflare/cloudflared/releases/latest
echo    2. 下载 cloudflared-windows-amd64.exe
echo    3. 改名成 cloudflared.exe，丢进这个文件夹
echo       也就是 %~dp0
echo    4. 再双击一次这个 bat 就行了
echo.
echo  或者用命令 winget install --id Cloudflare.cloudflared 装。
echo ================================================
start "" https://github.com/cloudflare/cloudflared/releases/latest
goto done

:findexe
rem 参数 1 = exe 文件名，找到的完整路径放进 _p
set "_p="
for %%I in (%~1) do if exist "%%~$PATH:I" set "_p=%%~$PATH:I"
if not defined _p if exist "%~dp0%~1" set "_p=%~dp0%~1"
if not defined _p if exist "%ProgramFiles%\%~n1\%~1" set "_p=%ProgramFiles%\%~n1\%~1"
if not defined _p if exist "%ProgramFiles(x86)%\%~n1\%~1" set "_p=%ProgramFiles(x86)%\%~n1\%~1"
if not defined _p if exist "%LOCALAPPDATA%\%~n1\%~1" set "_p=%LOCALAPPDATA%\%~n1\%~1"
goto :eof

:done
echo.
echo 一定要用 https 那一条，不要用 http 那一条。
echo 这两个窗口都不能关，关了队友就掉线。想停就在各自窗口里按 Ctrl+C。
echo.
pause
