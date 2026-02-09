#!/bin/bash
# 切换到脚本所在目录
cd "$(dirname "$0")"

echo "正在启动狗狗 MBTI 本地预览服务..."

# 检查 python3
if command -v python3 >/dev/null 2>&1; then
    echo "使用 Python3 启动服务，请访问: http://localhost:8080/index.html"
    python3 -m http.server 8080
elif command -v python >/dev/null 2>&1; then
    echo "使用 Python 启动服务，请访问: http://localhost:8080/index.html"
    python -m http.server 8080
else
    echo "错误：未找到 Python 环境。"
    echo "请安装 Python (https://www.python.org/) 或者安装 Node.js 使用 npx serve 方案。"
    read -p "按回车键退出..."
fi
