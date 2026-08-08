#!/usr/bin/env bash
# 表情包雷达 — 一键打开（macOS）
# 双击本文件：自动启动本地服务器并打开浏览器
# 已运行过服务器时会直接打开浏览器，不会重复启动

PROJECT="/Users/linanfeng/.reasonix/global-workspace/face-meme"
URL="http://localhost:8000"

cd "$PROJECT" || { echo "[错误] 找不到项目目录"; read -r -p "按回车关闭"; exit 1; }

# 若服务器已在运行，直接打开浏览器
if curl -s -o /dev/null --max-time 1 "$URL/"; then
  open "$URL"
  echo "服务器已在运行，已打开浏览器"
  exit 0
fi

echo "正在启动表情包雷达…"
python3 serve.py &
SERVER_PID=$!

# 等待服务器就绪（最多 6 秒）
for _ in $(seq 1 20); do
  if curl -s -o /dev/null --max-time 1 "$URL/"; then
    break
  fi
  sleep 0.3
done

open "$URL"
echo "浏览器已打开: $URL"
echo "关闭本窗口或按 Ctrl+C 可停止服务器"
wait $SERVER_PID
