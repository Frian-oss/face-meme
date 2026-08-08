#!/usr/bin/env bash
# 表情包雷达 一键启动（macOS / Linux）
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  python3 serve.py
else
  echo "[错误] 未检测到 Python 3"
  echo "请先安装: https://www.python.org/downloads/"
  exit 1
fi
