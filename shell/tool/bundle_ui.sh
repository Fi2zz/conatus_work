#!/usr/bin/env bash
# 把前端构建产物塞进 .app 包内，使应用拷到仓库外也能单独运行。
# 用法：tool/bundle_ui.sh [path/to/App.app]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SRC="$REPO_DIR/ui/dist"

if [ ! -f "$SRC/index.html" ]; then
  echo "缺少前端构建：$SRC/index.html（先在 ui/ 下跑 npm run build）" >&2
  exit 1
fi

APP="${1:-}"
if [ -z "$APP" ]; then
  APP="$(ls -td "$SCRIPT_DIR"/../build/macos/Build/Products/*/conatus_work_shell.app 2>/dev/null | head -1 || true)"
fi
if [ -z "$APP" ] || [ ! -d "$APP" ]; then
  echo "找不到 .app；先跑 flutter build macos 或显式传路径" >&2
  exit 1
fi

DEST="$APP/Contents/Resources/ui"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC"/. "$DEST"/
echo "bundled UI -> $DEST"

# 任务卡随包分发：产品里没有仓库，任务卡必须自带。
TASKS_SRC="$(cd "$SCRIPT_DIR/../.." && pwd)/tasks"
TASKS_DEST="$APP/Contents/Resources/tasks"
if [ -d "$TASKS_SRC" ]; then
  rm -rf "$TASKS_DEST"
  mkdir -p "$TASKS_DEST"
  cp -R "$TASKS_SRC"/. "$TASKS_DEST"/
  echo "bundled tasks -> $TASKS_DEST"
fi
