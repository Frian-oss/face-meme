@echo off
chcp 65001 >nul
cd /d "%~dp0"
set RUNNER=
where py >nul 2>nul && set RUNNER=py
if "%RUNNER%"=="" where python >nul 2>nul && set RUNNER=python
if "%RUNNER%"=="" where python3 >nul 2>nul && set RUNNER=python3
if "%RUNNER%"=="" (
  echo.
  echo [错误] 未检测到 Python 3
  echo 请先安装: https://www.python.org/downloads/
  echo 安装时务必勾选 "Add Python to PATH" ^(默认不勾^)
  echo.
  pause
  exit /b 1
)
echo ============================================
echo   表情包雷达 正在启动...
echo   启动后请用浏览器访问:
echo   http://localhost:8000
echo   ^(按 Ctrl+C 停止^)
echo ============================================
%RUNNER% serve.py
pause
