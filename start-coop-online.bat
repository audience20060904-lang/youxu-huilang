@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ===== 幽墟回廊 · 联机服务器 【公网版】 =====
echo.
echo 这个脚本会开两个窗口：一个跑游戏服务器，一个跑 cpolar 公网隧道。
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

rem ---- 找 cpolar.exe：先看 PATH，再看仓库目录，最后看几个默认安装位置 ----
set "CPOLAR="
for %%I in (cpolar.exe) do if not defined CPOLAR if exist "%%~$PATH:I" set "CPOLAR=%%~$PATH:I"
if not defined CPOLAR if exist "%~dp0cpolar.exe" set "CPOLAR=%~dp0cpolar.exe"
if not defined CPOLAR if exist "%ProgramFiles%\cpolar\cpolar.exe" set "CPOLAR=%ProgramFiles%\cpolar\cpolar.exe"
if not defined CPOLAR if exist "%ProgramFiles(x86)%\cpolar\cpolar.exe" set "CPOLAR=%ProgramFiles(x86)%\cpolar\cpolar.exe"
if not defined CPOLAR if exist "%LOCALAPPDATA%\cpolar\cpolar.exe" set "CPOLAR=%LOCALAPPDATA%\cpolar\cpolar.exe"

echo 正在启动游戏服务器…
start "幽墟回廊 · 服务器" cmd /k node server.js
timeout /t 3 /nobreak >nul
echo.

if not defined CPOLAR (
  echo ================================================
  echo  没找到 cpolar，公网隧道没起来。
  echo.
  echo  游戏服务器已经开着了，同一个 WiFi 下照样能玩 —— 
  echo  想跨网络的话，先装一次 cpolar：
  echo    1. 打开 https://www.cpolar.com 注册一个账号
  echo    2. 下载 Windows 版装上
  echo    3. 在后台页面复制自己的 authtoken
  echo    4. 命令行里跑一次： cpolar authtoken 你复制的那串
  echo  装完之后再双击这个 bat，就会自动起隧道了。
  echo ================================================
  echo.
  start "" https://www.cpolar.com/download
  goto done
)

echo 正在启动 cpolar 公网隧道…
start "cpolar · 公网隧道" cmd /k ""%CPOLAR%" http 8080"
echo.
echo ================================================
echo  接下来看那个 cpolar 窗口，找 Forwarding 那一行，
echo  形如：  https://xxxxxxxx.r3.cpolar.top  -^>  http://localhost:8080
echo.
echo  把那个 https 开头的地址后面接上 /coop.html，比如
echo    https://xxxxxxxx.r3.cpolar.top/coop.html
echo  这就是两个人都要打开的网址 —— 用手机流量、用别人家的 WiFi 都行。
echo.
echo  一定要用 https 那一条，不要用 http 那一条。
echo  免费版这个地址每次重启都会变，每次重开都要重新发给队友。
echo.
echo  如果 cpolar 窗口里没有 Forwarding，只有报错：
echo  多半是还没跑过 cpolar authtoken，照上面第 3、4 步做一次。
echo ================================================

:done
echo.
echo 这两个窗口都不能关，关了队友就掉线。想停就在各自窗口里按 Ctrl+C。
echo.
pause
