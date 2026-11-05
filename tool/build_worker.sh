#!/usr/bin/env bash
# 构建 AOT worker：打包后的壳内任务进程。
#
# 产物：dist/runner_worker。壳启动 worker 时把作业文件路径作为唯一参数。
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

mkdir -p dist
echo "==> dart compile exe bin/worker.dart -> dist/runner_worker"
dart compile exe bin/worker.dart -o dist/runner_worker
echo "完成：$root/dist/runner_worker"
