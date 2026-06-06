#!/usr/bin/env bash
set -Eeuo pipefail

clear
echo "================================"
echo "启动 RIN Python 本地项目"
echo "================================"
echo

cd "$(dirname "$0")" || exit 1

MAIN_URL="http://127.0.0.1:8765/"

echo "当前项目目录："
pwd
echo

if [ ! -x "Start_RIN_Python_Local_Model.command" ]; then
  echo "[错误] 未找到 Python 启动器 Start_RIN_Python_Local_Model.command"
  echo "请把这个 .command 文件放到 RIN_loading 项目根目录。"
  echo
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

if [ ! -x "python/.venv/bin/python" ]; then
  echo "[错误] 未找到 Python venv。"
  echo "请先运行："
  echo "  cd python && python3.12 -m venv .venv && .venv/bin/python -m pip install -e \".[dev]\""
  echo
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

if [ ! -f ".rin-data/config/python_cutover_marker.json" ]; then
  echo "[错误] 未发现 Python cutover marker。"
  echo "为保护真实 .rin-data，Python production 启动器会拒绝启动。"
  echo
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

echo "准备启动 RIN Python Console..."
echo
echo "主界面：$MAIN_URL"
echo
exec ./Start_RIN_Python_Local_Model.command