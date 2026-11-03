# conatus_work

> 基于 [conatus](https://github.com/Fi2zz/conatus) 的产品层。

## 边界

本仓库是**产品**，不是框架模块：

- 它消费 `package:conatus/conatus.dart`，不反向被其它库 import；
- 不进 conatus 伞包的 re-export，不进 conatus 根 `pubspec.yaml` 的依赖清单；
- 独立版本（`version:` 与 conatus 的 0.16.0 冻结无关），独立发布。

判据一句话：假如它被别的项目 `import`，那它应该长成 conatus 的 `packages/` 模块；
否则它留在本仓库。产品里长出来的能力等**第二个消费方**出现再上移成模块。

## 开发

### 在 conatus 工作区内（推荐）

产品以 submodule 形式挂在 conatus 仓库的 `products/conatus_work`，此时依赖解析
到本地 conatus 成员包，改框架源码立刻生效：

```bash
cd <conatus 仓库根>
git submodule update --init
bash tool/setup_code_filter.sh   # 恢复 workspace 形态（filter 配置不在版本控制内）
dart pub get
```

`resolution: workspace` 这一行由 git filter 管理：工作区里生效，`git add` 时自动
注释掉。**不要手动改它**，也不要手动改 `dependency_overrides`。

### 独立 clone

```bash
git clone https://github.com/Fi2zz/conatus_work.git
dart pub get
```

提交态的 pubspec 里 `resolution: workspace` 是注释态，依赖经 git 源拉 conatus
（ref 钉在具体 commit 上）。

## 依赖演进

现在只依赖伞包 `conatus`（单条 git 依赖）。当代码开始直接 `import
'package:conatus_xxx/...'` 时，按 conatus_code 的实证形态扩展：

1. 把被直接 import 的每个模块包**显式**列进 `dependencies`（git + `path:
   packages/conatus_xxx`）——`depend_on_referenced_packages` 要求显式声明；
2. 补 `dependency_overrides`：独立形态靠它对齐 git 源的两种身份，workspace
   形态下由 filter 生成的 `pubspec_overrides.yaml` 清空。

这两步别简化：合并成单条伞包依赖会触发 `depend_on_referenced_packages` 大批
info（`--fatal-infos` 必红），去掉 overrides 则因「git ref 与解析后 SHA 是两种
身份」求解失败。

## 桌面壳（`shell/`）

Flutter macOS 应用，不进 workspace（纯 Dart 的 `dart analyze` 解析不了 flutter 包，
已在根 `analysis_options.yaml` 排除 `shell/**`）。

```bash
cd ui && npm run build          # 先产出前端构建
cd ../shell && flutter run -d macos
```

- 壳用 loopback HTTP + 一次性 token 提供 `ui/dist`，不用 `file://`（ES module 与 CORS 更稳）
- 消息通道：WKWebView `JavaScriptChannel('conatus')` 上行、`window.__conatusReceive` 下行
- 路径可用 `CONATUS_WORK_UI` / `CONATUS_WORK_RUNS` 覆盖，缺省 `../ui/dist`、`../var/runs`
- `ui/dist` 缺失时窗口显示明确错误，不是白屏

## 桥接层（`lib/src/bridge/`）

把运行记录翻译成 React 侧消费的契约，不启动进程：

- `projection.dart`：`projectRunDir(dir)` → `RunFixture`（与 `ui/src/bridge/types.ts` 同形）
- `bridge.dart`：`WorkbenchBridge` 提供 `listTasks` / `openTask` / `changes` / `readArtifact` / `undo` / `redo`
- `undo` 复用 `Runner.undo`（检查点 + 会话分叉），并把撤销点写到 `<runDir>/revert-stage.json`；
  `redo` 读这份撤销点走 `RevertService.redo`，成功后删除。撤销点存在即表示「可重做」。

**WebView 协议**（`lib/src/bridge/host.dart`）：`BridgeHost.dispatch(raw)` 收一条 JSON 帧、返回要发回的帧列表。
信封为 `{v:1, kind:'hello'|'command'|'result'|'event', id, command, payload}`，
结果帧 `{ok:true,value}` 或 `{ok:false,error:{code,message}}`。异常收敛成错误帧，不向上抛。
Flutter 只需把平台消息通道接到 `dispatch` 与返回值上。

对拍：`test/fixtures/projection/organize-v01/` 是自包含的投影输入（`run.json` + `events.jsonl` + `task.json` + `workspace/`），
Dart 投影结果必须与已提交的 `ui/src/fixtures/runs/organize-v01.json` 深度相等：

```bash
dart test test/bridge/
cd ui && node tools/generate-fixtures.mjs ../test/fixtures/projection/organize-v01
```

两侧同源：改投影规则要同时改 `ui/tools/lib/`，否则这条测试会红。

## 钉版

conatus 仓库更新并推送后，同步 gitlink 之前：

```bash
bash tool/pin_conatus_refs.sh          # 钉到 conatus origin/master 最新
bash tool/pin_conatus_refs.sh <sha>    # 钉到指定 commit
```

提交本仓库 `pubspec.yaml`，让本仓库 CI 立刻验证新组合。

## 最小任务运行器（阶段 0 第 1 周）

`bin/runner.dart` 是薄 CLI，库在 `lib/src/runner/`。任务用 JSON 任务卡声明，
运行记录落在 `var/runs/<runId>/`（已 gitignore）。

```bash
dart run bin/runner.dart list
dart run bin/runner.dart run tasks/empty-smoke.json --workspace var/workspaces/smoke
dart run bin/runner.dart resume <runId>
dart run bin/runner.dart abort <runId>
dart run bin/runner.dart undo <runId>
dart run bin/runner.dart redo <runId>
dart run bin/runner.dart report var/runs
dart run bin/runner.dart edit <runId> --artifact out/report.md --note "手动改了结论段"
```

### 模型配置

`run` / `resume` 需要 OpenAI 兼容端点，全部从环境变量读（Key 不落盘）：

```bash
# OpenCode Go（推荐；请求自动带 x-opencode-session）
export WORK_LLM_BASE_URL=https://opencode.ai/zen/go/v1
export WORK_LLM_MODEL=deepseek-v4.1-flash
export WORK_LLM_API_KEY=oc_sk_...
export WORK_LLM_NAME=opencode-go

# 或任意 OpenAI 兼容端点（豆包 ARK / DeepSeek / Ollama）
# export WORK_LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
# export WORK_LLM_MODEL=doubao-seed-1-6-250615
# export WORK_LLM_API_KEY=sk-...      # 本地端点（Ollama / vLLM）可省略
# export WORK_LLM_NAME=ark
# export WORK_LLM_PRICE_IN=0.8        # 可选，美元/百万 token，与 OUT 成对
# export WORK_LLM_PRICE_OUT=2.0
```

`baseURL` 只写到 `/v1`：provider 自己拼 `/chat/completions`。

缺 `BASE_URL` / `MODEL` 时 `run` 在预检阶段失败（退出码 2），不创建运行目录。
未配置单价时 `run.json.usage.costUsd` 记 0，预算判定不生效。

约束：

- 读写都限制在工作区根的 `read ∪ write` 前缀内，越界抛 `FS_SANDBOX_DENIED`；
- 一任务 = 一轮检查点，`run.json.turns` 记录起止轮次；
- 时长上限用 `limits.maxMinutes`，测试或极短任务可用 `limits.maxSeconds` 覆盖；
- `report` 输出每链成功率、P50/P95、失败分类与救场构成（`rescuedBy=rerun:…,human:…`）；
- 不装 shell：文件操作只经 `read` / `write` / `edit` / `move` / `mkdir` 等工具；
- `network: deny` 的任务不装配 `websearch` / `webfetch`，`run.json.tools` 可机检。
