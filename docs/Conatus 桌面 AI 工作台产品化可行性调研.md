# Conatus 桌面 AI 工作台产品化可行性调研

- 日期：2026-10-30
- 范围：评估将 Conatus 产品化为类似腾讯 WorkBuddy 的桌面 AI Agent 工作台的技术可行性、产品定位、实现路线与投入风险
- 已确定技术路线：**Flutter 桌面壳 + React UI + Conatus Dart 运行时**
- 本文只做调研与决策建议，不包含实现代码

## 一、结论摘要

**技术上可行，但不建议直接开发一个通用版 WorkBuddy。**

更具体地说：

1. 以 Conatus 为运行时、Nava 为应用能力基础，开发本地桌面 Agent 工作台，底层复用率较高，技术上成立。
2. 面向非技术用户的办公产品仍缺少图形工作台、办公产物管线、操作系统级安全隔离和桌面发布工程。
3. 正面复制 WorkBuddy 的专家团、技能市场、IM 遥控、连接器与团队协作，不适合独立开发者现阶段投入。
4. 通用“WorkBuddy 替代品”的商业定位偏弱；更值得验证的方向是：**本地优先、过程可回溯、文件级可撤销的个人 AI 工作台。**
5. 不建议立即投入完整桌面产品。应先在 Nava 内验证三条办公任务链，达到可靠性与产物质量门槛后，再进入桌面 Alpha。

## 二、WorkBuddy 产品形态拆解

WorkBuddy 官方将其定义为面向办公场景的 AI Agent 桌面工作站：用户用自然语言交代任务，系统自主规划与执行，并交付可验证的结果。其能力包括文档、表格、演示文稿、数据分析、本地文件处理及手机端远程任务下发。[^1]

其国内产品页进一步强调多专家、多模型、Skills、MCP，以及策略到交付的一站式执行。[^2]

因此，类似 WorkBuddy 的产品并不只是一个 Agent Loop，而是五层组合：

| 层 | 核心职责 |
|---|---|
| Agent 运行时 | 规划、模型调用、工具执行、多轮循环、失败恢复 |
| 任务工作台 | 任务列表、过程展示、中断、继续、恢复、并行任务 |
| 产物系统 | 文档、表格、PPT、图表的生成、预览、变更检查与交付 |
| 能力生态 | Skills、MCP、专家、连接器、定时自动化 |
| 安全与产品工程 | 权限、隔离、账号、安装、升级、跨平台与诊断 |

Conatus 当前强在运行时和部分生态，Nava 已补上一部分任务管理与文件安全能力；主要缺口集中在图形界面、办公产物与公开分发所需的安全工程。

## 三、Conatus 与 Nava 现有能力核查

本次核查基于 Fi2zz/conatus 与 Fi2zz/conatus_code 当前仓库内容，而非仅依据历史设计。[^3][^4]

Conatus 当前为 27 个模块包组成的 Dart monorepo，其中包含稳定包与实验性包。Nava 是其上层终端编码 Agent，已有完整 TUI、项目工作区、模型配置、权限、检查点和会话恢复等能力。

### 3.1 能力映射

| WorkBuddy 能力 | Conatus / Nava 现状 | 复用判断 |
|---|---|---|
| 自然语言任务、自主规划 | Agent Loop、Plan、Reflection | 可直接复用 |
| 多模型与模型回退 | OpenAI 兼容、Kimi、Anthropic、重试与回退链 | 可复用 |
| 本地文件批处理 | 文件工具、Shell、工作区权限 | 可复用 |
| 任务中断与恢复 | Session、Task Center、后台任务、取消 | 可复用 |
| 执行过程追踪 | Session Log、`/trace`、会话导出 | 可复用，且可形成差异化 |
| 文件变更与撤销 | Checkpoint、Diff、Undo/Redo、Story | 可复用，且可形成差异化 |
| Skills / MCP | 已有，兼容现有技能与 MCP 生态 | 可复用 |
| 定时自动化 | Cron、Schedule | 可复用 |
| 子 Agent / 多 Agent | 已有，但 Team 仍属实验性 | 首版慎用 |
| 浏览器操作 | 已接 Playwright MCP，但仍属实验性 | 可验证，不视为成熟能力 |
| 原生桌面软件操作 | 已接 Cua Driver，但仍属实验性 | 首版排除 |
| DOCX / XLSX / PPTX 生成与预览 | 没有现成办公产物管线 | 主要缺口 |
| 图形桌面工作台 | 当前只有 Nava TUI | 主要缺口 |
| IM 遥控、账号、连接器市场 | 没有 | 后置 |
| 安装、升级、跨平台验证 | 仅有 Nava 二进制构建基础 | 需要补齐 |

### 3.2 两个不能混淆的概念

**第一，`conatus_doc` 不是 Office 文档生成器。**

它是人机双写故事层的文档补丁引擎，负责补丁、fold、supersede、批注与历史分叉，不负责 DOCX、XLSX 或 PPTX 的生成和渲染。办公产物管线仍需单独建设。

**第二，审批与 Checkpoint 不等于沙箱。**

Nava 当前没有操作系统级沙箱，Shell 等工具以当前用户权限运行。命令形状审查、权限规则和高危审批能够降低风险，但不能限制进程最终的系统访问能力。

WorkBuddy 官方权限说明也将“高危操作确认”和“额外沙箱保护”分开描述。[^5]

因此，安全隔离是公开提供给非技术用户之前的 P0 问题，不能当作后续优化项。

## 四、产品定位建议

### 4.1 不建议的定位

不建议以“国产 WorkBuddy 替代品”或“全场景 AI 办公桌”为定位，原因包括：

- 大厂已经具备开箱即用、专家模板、模型与生态整合优势。
- BYOK、本地文件、多模型本身不足以形成长期差异。
- Agent 框架技术先进不是普通用户愿意付费的直接理由。
- 独立开发者需要长期承担模型适配、格式兼容、安全责任与桌面支持成本。

### 4.2 建议验证的定位

> **本地优先、过程可回溯、文件级可撤销的个人 AI 工作台。**

核心价值不是“也能聊天和调用工具”，而是：

- 每一次执行都能复盘。
- 每一批文件变更都能检查。
- 出错时可以连会话与文件一起退回。
- 用户保有模型、技能、数据与凭据的控制权。

Conatus 的 Session Log、Nava 的 Checkpoint、Diff、Undo/Redo 和 Story 能支撑这一定位。框架机制由此被翻译成普通用户可理解的利益，而不是停留在架构术语上。

这一定位是否足以支撑付费仍需真实用户验证。企业私有部署可能有预算，但会同步提高沙箱、权限、审计与技术支持成本，不应作为首版假设。

## 五、首版产品边界

### 5.1 建议纳入

- macOS 优先。
- 单窗口、单工作区、单 Agent。
- Ask / Plan / Execute 三类任务状态。
- 网络调研、本地文件整理、CSV 数据分析。
- 输出 Markdown、HTML、PDF、CSV。
- DOCX / XLSX 作为第二批产物能力。
- 任务过程、文件变更、产物列表和预览。
- 会话恢复、Checkpoint、Undo。
- BYOK、MCP、Skills。

### 5.2 明确不做

- Computer Use。
- 多 Agent 专家团。
- 技能市场。
- 微信、飞书等 IM 遥控。
- 企业账号、云同步和团队协作。
- Windows 首版适配。
- “任何任务都能完成”的泛化承诺。

首版承诺应收窄为：**在用户授权的文件夹内，完成若干类可验收的文件工作。**

## 六、已确定的技术架构

桌面 UI 采用 **Flutter + React**。推荐结构如下：

```text
React
├─ 任务与会话界面
├─ 对话、计划、工具过程
├─ 权限确认、设置
└─ 产物列表与预览
        │ JSON-RPC 命令 + 事件流
Flutter Desktop
├─ 窗口、菜单、文件选择器
├─ React WebView 容器
├─ 本地桥接与权限控制
└─ 安装、升级、平台集成
        │ Dart 直接调用
Conatus / Nava Runtime
├─ Agent Loop、Task、Session
├─ MCP、Skills、Cron
├─ 文件工具、审批、Checkpoint
└─ 模型、成本与执行日志
```

Flutter 官方支持将应用编译为原生 Windows、macOS 和 Linux 桌面应用；Conatus 为纯 Dart，可直接在 Flutter 进程中使用，不需要另起 JS 运行时。[^6]

### 6.1 React 职责

- 工作台、会话、任务列表。
- 对话与计划展示。
- 工具执行时间线。
- 产物列表、Diff、Markdown / HTML 等预览。
- 设置和权限确认界面。

### 6.2 Flutter 职责

- 桌面窗口、系统菜单、原生文件选择器。
- 本地通知、拖放、快捷键与系统集成。
- React 本地资源加载与桥接。
- Conatus 生命周期、安装与升级。

### 6.3 Conatus 职责

- 唯一的 Agent 状态与任务状态来源。
- 会话持久化、执行日志、权限判定。
- 文件读写、Checkpoint、撤销和恢复。
- MCP、Skills、模型与工具执行。

### 6.4 桥接原则

桥接只分两类通信：

1. **命令**：创建任务、发送消息、取消任务、批准操作、恢复会话、撤销变更。
2. **事件**：模型增量、计划更新、工具进度、审批请求、产物变化、任务结束。

传输结构化 ViewModel 与文件引用，不反复传输整份 Session Log 或大文件正文。大文件通过受控本地资源协议按需读取。

**状态权威只在 Dart 侧。** React 可以保存输入框、选中标签等界面状态，但不能自行推导任务状态，也不能在 JS 侧再实现一套 Agent Loop。

### 6.5 WebView 安全约束

- 生产环境加载本地 React 构建产物，不依赖开发服务器。
- 不开放任意 JavaScript 执行与远程调试。
- 所有桥接命令做来源、参数和权限校验。
- 普通网页内容不得获得原生桥接能力。
- React 不直接访问文件系统，所有文件操作仍经 Conatus 权限管线。
- 首版不做 React 与 Flutter 混合嵌套界面，避免两套导航和交互体系。

## 七、候选路线比较

| 路线 | 优点 | 代价 | 结论 |
|---|---|---|---|
| 直接使用 WorkBuddy | 最低成本获得办公自动化能力 | 没有自研产品价值 | 适合使用，不适合达成产品化目标 |
| 基于 Eigent 等开源桌面 Cowork 改造 | 较快获得完整桌面形态 | Conatus 容易被边缘化，变成集成项目 | 可作竞品与实现参考，不作为首选底座 |
| Conatus + Flutter + React | 保留自研运行时与差异化，React 可复用到 Web | 需要自建桥接、预览与桌面工程 | **推荐产品路线** |
| 先给 Nava 增加办公 Skills | 成本最低，直接验证任务可靠性 | 没有图形桌面形态 | **推荐验证顺序的第一步** |

Eigent 是 Apache-2.0 的开源 Cowork Desktop，可用于对照多 Agent 工作台和桌面交互，但选择它会显著改变本项目以 Conatus 为核心的目标。[^7]

浏览器自动化可继续走 Playwright MCP。未来确有原生软件操作需求时再接 Cua Driver；Cua Driver 提供 MCP 接口并支持 macOS、Windows、Linux，首版无需自研桌面控制协议。[^8]

## 八、工作量估算

以一名开发者、复用当前 Conatus / Nava 为口径：

| 阶段 | 目标 | 工作量区间 |
|---|---|---:|
| 阶段 0 | 在 Nava 内跑通三条办公任务链 | 1–2 周 |
| 阶段 1 | macOS 桌面个人 Alpha | 10–14 周 |
| 阶段 2 | 稳定产物、安全、安装包和评估后公开测试 | 再增加 3–6 个月 |
| WorkBuddy 全功能对齐 | 专家生态、连接器、IM、企业能力 | 不建议按此立项 |

相比纯 Flutter UI，React + Flutter 增加的主要成本是：

- WebView 桥接协议与事件重放。
- React / Dart 的异常、取消和断线语义对齐。
- WKWebView / WebView2 行为差异。
- 本地资源打包、CSP 与桥接口白名单。
- 跨层集成测试。

最大的进度浮动项不是普通聊天页面，而是：

1. DOCX / XLSX / PPTX 的生成质量与预览。
2. 长任务失败恢复。
3. 权限与隔离。
4. Windows 验证和安装分发。
5. 不同模型上的任务成功率。

## 九、主要风险与对策

| 风险 | 影响 | 建议 |
|---|---|---|
| 通用产品定位过大 | 长期追赶大厂功能，无法形成差异 | 锁定可回溯、可撤销、本地文件交付 |
| Agent 任务可靠性不足 | UI 完整但产物不可用 | 先在 Nava 验证任务链，再做桌面 UI |
| 无操作系统级沙箱 | 非技术用户可能遭受越权或数据损失 | 首版限制工作区；公开分发前补隔离方案 |
| Office 生成与预览复杂 | 工作量失控、产物质量不稳定 | 首版 Markdown / HTML / PDF / CSV，Office 分批支持 |
| React / Dart 双状态 | 界面与真实执行状态不一致 | Dart 为唯一状态权威，React 只消费投影 |
| 实验性能力过早产品化 | API 变更与故障增加 | Team、Browser Use、Computer Use 不进入首版核心 |
| 跨平台过早展开 | 测试和分发成本倍增 | macOS 验证后再决定 Windows |
| 商业价值未验证 | 投入数月但没有付费需求 | 先做真实使用与付费意愿门槛 |

## 十、建议的验证方案

先为 Nava 配置三条办公 Skill，执行 30 个真实任务：

1. 调研主题并生成带引用的报告。
2. 分析 CSV / Excel 并生成图表和结论。
3. 批量整理授权文件夹并生成变更清单。

达到以下门槛后，再投入桌面 UI：

- 至少 80% 的任务无需人工救场完成。
- 产物能够直接交付，不需要大幅返工。
- 中断、恢复、撤销均能正确工作。
- 没有越权写入或不可恢复的数据损失。
- 连续自用两周，确实比直接使用现有产品更符合自己的工作方式。

若验证失败，应优先修任务可靠性和产物质量，而不是通过桌面 UI 掩盖问题。

## 十一、最终建议

**建议进入低成本验证，不建议现在直接立完整桌面产品项目。**

推荐顺序：

1. 在 Nava 内验证三条办公任务链。
2. 固定产物格式与验收标准。
3. 明确工作区权限与公开分发前的隔离方案。
4. 再开发 Flutter + React 的 macOS 单窗口 Alpha。
5. 依据真实使用率、任务成功率和付费意愿决定是否扩展为公开产品。

一句话概括：**Conatus 足以支撑一个桌面 Agent 产品，但当前最需要验证的不是能否做出 WorkBuddy 的界面，而是能否稳定交付用户愿意直接使用的文件成果。**

---

[^1]: Tencent WorkBuddy, “What Is Tencent WorkBuddy?”, https://www.workbuddy.ai/docs/workbuddy/Overview
[^2]: 腾讯 WorkBuddy 产品页，https://www.codebuddy.cn/work/
[^3]: Fi2zz/conatus，https://github.com/Fi2zz/conatus
[^4]: Fi2zz/conatus_code（Nava），https://github.com/Fi2zz/conatus_code
[^5]: Tencent WorkBuddy, “Permissions and Modes”, https://www.workbuddy.ai/docs/workbuddy/PermissionsAndModes
[^6]: Flutter 官方文档，“Desktop support for Flutter”, https://docs.flutter.dev/platform-integration/desktop
[^7]: eigent-ai/eigent，https://github.com/eigent-ai/eigent
[^8]: trycua/cua，https://github.com/trycua/cua
