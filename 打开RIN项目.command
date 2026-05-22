#!/bin/bash

clear
echo "================================"
echo "启动 RIN 本地项目"
echo "================================"
echo

cd "$(dirname "$0")" || exit 1

MAIN_URL="http://127.0.0.1:4173"
BODY_URL="http://127.0.0.1:4173/body"

echo "当前项目目录："
pwd
echo

if [ ! -f "package.json" ]; then
  echo "[错误] 当前目录没有 package.json"
  echo "请把这个 .command 文件放到 RIN_loading 项目根目录。"
  echo
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js"
  echo "请先安装 Node.js 22 或以上版本。"
  echo
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[错误] 未检测到 npm"
  echo "请确认 Node.js 已正确安装。"
  echo
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

echo "Node 版本："
node -v
echo

if [ ! -d "node_modules" ]; then
  echo "[错误] 未发现 node_modules。"
  echo "请先在项目根目录手动运行："
  echo
  echo "  npm install"
  echo
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

if [ ! -d ".rin-data" ]; then
  echo "[错误] 未发现 .rin-data。"
  echo "请先在项目根目录手动运行："
  echo
  echo "  npm run rin:init"
  echo
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

echo "准备启动 RIN Console..."
echo
echo "主界面：$MAIN_URL"
echo "身体界面：$BODY_URL"
echo

# 后台启动 RIN Console
npm run rin:console &
SERVER_PID=$!

echo "RIN Console 进程 PID: $SERVER_PID"
echo
echo "等待本地服务启动..."

# 最多等待 60 秒
for i in {1..60}; do
  if curl -s "$MAIN_URL" >/dev/null 2>&1; then
    echo
    echo "本地服务已启动。"
    echo "正在打开浏览器..."
    open "$MAIN_URL"
    sleep 1
    open "$BODY_URL"
    echo
    echo "浏览器已打开："
    echo "$MAIN_URL"
    echo "$BODY_URL"
    echo
    echo "请不要关闭此终端窗口。关闭后 RIN 本地服务也会停止。"
    echo
    wait $SERVER_PID
    exit 0
  fi

  echo "等待中... $i 秒"
  sleep 1
done

echo
echo "[错误] 等待 60 秒后，本地服务仍未响应。"
echo "可能是 npm run rin:console 启动失败，或端口 4173 被占用。"
echo
echo "你可以手动检查："
echo "  npm run rin:console"
echo
read -n 1 -s -r -p "按任意键退出..."
exit 1