@echo off
title 狗狗 MBTI 本地预览服务
cd /d %~dp0

echo 正在启动本地预览服务...

python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 使用 Python 启动服务，请访问: http://localhost:8080/index.html
    python -m http.server 8080
) else (
    python3 --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo 使用 Python3 启动服务，请访问: http://localhost:8080/index.html
        python3 -m http.server 8080
    ) else (
        echo 错误：未找到 Python 环境。
        echo 请安装 Python (https://www.python.org/)。
        pause
    )
)
