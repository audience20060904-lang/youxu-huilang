@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===== 幽墟回廊 · 联机服务器 =====
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
  echo 想要以后能自动更新，请改用 git clone 重新拉一份仓库
  echo （具体步骤看 联机方案.md 或者问 Claude）。
)
echo.
echo 正在启动服务器…
echo （这个黑窗口不能关，关了服务器就没了；想停止按 Ctrl+C）
echo.
node server.js
echo.
echo 服务器已停止。
pause
