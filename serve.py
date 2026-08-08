#!/usr/bin/env python3
"""
表情包雷达 — 本地静态服务器
解决 Python 内置 http.server 对 .wasm 等文件 MIME 类型识别不全的问题。

用法:
    python3 serve.py
然后浏览器访问 http://localhost:8000
同一局域网内的手机/电脑访问 http://<本机IP>:8000（需连接同一 WiFi）
"""
import socketserver
import http.server
import mimetypes

PORT = 8000

# 确保正确 MIME（浏览器对 <script type="module"> 强制要求 JavaScript MIME）
mimetypes.add_type('application/wasm', '.wasm')


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.wasm': 'application/wasm',
    }


def local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return '127.0.0.1'


if __name__ == '__main__':
    with socketserver.ThreadingTCPServer(('', PORT), Handler) as httpd:
        ip = local_ip()
        print('=' * 52)
        print('  表情包雷达 已启动 🚀')
        print('=' * 52)
        print(f'  本机访问:   http://localhost:{PORT}')
        print(f'  局域网访问: http://{ip}:{PORT}  (手机连同一 WiFi)')
        print('=' * 52)
        print('  按 Ctrl+C 停止服务器')
        print('=' * 52)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n已停止。')
