#!/bin/bash
# 切换到脚本所在目录
cd "$(dirname "$0")"

echo "正在启动狗狗 MBTI 本地预览服务..."

echo "Open http://localhost:8080/"

if command -v python3 >/dev/null 2>&1; then
    python3 -m http.server 8080
else
    echo "错误：未找到 Python3 环境。"
    echo "请安装 Python (https://www.python.org/)。"
    read -p "按回车键退出..."
fi
