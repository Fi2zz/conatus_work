#!/usr/bin/env bash
# 把 pubspec.yaml 里所有 conatus 仓库 git 依赖的 ref 钉到指定 commit。
#
# 为什么钉版：本仓库以 git 源独立分发，依赖若浮动跟随 master，外部用户
# pub get 拿到的组合与本仓库 CI 验证过的组合无对应关系（父仓在 CI 之后
# 前进即漂移）。钉到具体 SHA 后，「CI 绿」与「用户拿到」是同一棵树。
#
# 用法：
#   bash tool/pin_conatus_refs.sh            # 钉到 conatus origin/master 最新
#   bash tool/pin_conatus_refs.sh <sha>      # 钉到指定 commit
#
# 父仓（conatus）更新并推送后、同步 gitlink 之前跑一次，提交本仓库 pubspec.yaml，
# 让本仓库 CI 立刻验证新组合。
set -euo pipefail

cd "$(dirname "$0")/.."

REF="${1:-$(git ls-remote https://github.com/Fi2zz/conatus.git master | cut -f1)}"
if [[ ! "$REF" =~ ^[0-9a-f]{40}$ ]]; then
  echo "非法 commit SHA: $REF" >&2
  exit 1
fi

# 只改指向 conatus 仓库的 git 依赖行；其它 hosted 依赖不碰。
# ref 域在逗号或 } 处截止——绝不能越过 path: 字段（`[^}]+` 会连 path 一起
# 吃掉，导致依赖的 path 丢失）。
PATHS_BEFORE="$(grep -c 'path: packages/' pubspec.yaml || true)"

PAT='github\.com/Fi2zz/conatus\.git, ref: [^,}]+'
REPL="github.com/Fi2zz/conatus.git, ref: ${REF}"
tmp="$(mktemp)"
sed -E "s|${PAT}|${REPL}|g" pubspec.yaml > "$tmp"
mv "$tmp" pubspec.yaml

echo "已钉到 conatus@${REF}："
grep -n "conatus\.git, ref:" pubspec.yaml | head -3
echo "…（共 $(grep -c 'conatus\.git, ref:' pubspec.yaml) 条）"
if grep -q "conatus\.git, ref: master" pubspec.yaml; then
  echo "错误：仍有残留 ref: master" >&2
  exit 1
fi

# 元检查：ref 替换绝不允许吞掉 path 域（conatus_code 曾发生过 37 条 path 全丢）。
# 用「替换前后数量不得减少」表达，依赖条数变化时无需改这个脚本。
PATHS_AFTER="$(grep -c 'path: packages/' pubspec.yaml || true)"
if [ "$PATHS_AFTER" -lt "$PATHS_BEFORE" ]; then
  echo "错误：path: packages/ 从 $PATHS_BEFORE 处减到 $PATHS_AFTER 处，ref 替换吞掉了 path" >&2
  git checkout -- pubspec.yaml
  echo "已回滚 pubspec.yaml" >&2
  exit 1
fi
