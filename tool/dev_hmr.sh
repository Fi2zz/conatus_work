#!/usr/bin/env bash
# 前端 HMR + 壳热重载：Vite 提供 ui/src，Flutter 壳直接加载开发服务器。
# 用法：make dev
#   - 改 React：浏览器/WebView 自动 HMR，无需重启
#   - 改 Dart：在 flutter run 的终端按 r（热重载）或 R（热重启）
set -euo pipefail

# 注意：拼在全角标点前的变量要用 ${URL}；macOS 自带 bash 3.2 会把全角字符
# 当成变量名的一部分，导致 "URL?: unbound variable"。

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_DIR="$ROOT/ui"
SHELL_DIR="$ROOT/shell"
PORT="${CONATUS_WORK_UI_PORT:-5173}"
URL="http://127.0.0.1:${PORT}/"

vite_pid=""
cleanup() {
  if [[ -n "$vite_pid" ]]; then
    kill "$vite_pid" 2>/dev/null || true
    wait "$vite_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if ! curl -fsS "$URL" >/dev/null 2>&1; then
  echo "==> 启动 Vite（${URL}）"
  if [[ ! -x "$UI_DIR/node_modules/.bin/vite" ]]; then
    echo "ui/node_modules 未安装，先在 products/conatus_work 下跑 make setup" >&2
    exit 1
  fi
  # 直接 exec vite，确保 cleanup 杀掉的是 Vite 本身而不是 npm 中间层。
  (cd "$UI_DIR" && exec ./node_modules/.bin/vite --port "$PORT") &
  vite_pid=$!
  for _ in $(seq 1 120); do
    if curl -fsS "$URL" >/dev/null 2>&1; then break; fi
    sleep 0.25
  done
  if ! curl -fsS "$URL" >/dev/null 2>&1; then
    echo "Vite 没有在 ${PORT} 端口起来" >&2
    exit 1
  fi
else
  echo "==> 复用已运行的 Vite（${URL}）"
fi

echo "==> flutter run -d macos（CONATUS_WORK_UI_URL=${URL}）"
cd "$SHELL_DIR"
CONATUS_WORK_UI_URL="$URL" flutter run -d macos
