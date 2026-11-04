# UI 原型：模块化界面与 mock 数据（2026-11-04）

本轮目标是把 WorkBuddy 对照里“还没有界面”的部分先做成可点击、可评估的 UI。
**所有新增数据与操作都是 mock**，不接真实宿主命令，也不会写本地文件或注册定时任务。

## 一、模块导航

左下角新增 56px 导航，切换六个模块：

| 模块 | 页面 | 数据来源 | 状态 |
|---|---|---|---|
| 工作台 | 现有三栏工作台 | 真实回放 / 宿主 | 保留 |
| 专家 | `features/experts/ExpertsPage.tsx` | `mock/data.ts` | 原型 |
| 技能 | `features/skills/SkillsPage.tsx` | `mock/data.ts` | 原型 |
| 连接器 | `features/connectors/ConnectorsPage.tsx` | `mock/data.ts` | 原型 |
| 自动化 | `features/automation/AutomationPage.tsx` | `mock/data.ts` | 原型 |
| 数据 | `features/data/DataPage.tsx` | `mock/data.ts` | 原型 |

工作台模块仍由 `Shell` 承载，其余模块由 `features/prototype/PrototypePage.tsx` 切换。
`AppFrame` 只负责“导航 + 当前模块”，不改变现有工作台的事件/回放逻辑。

## 二、各页面能做什么

- **专家中心**：分类、搜索、详情弹窗；专家团展示成员分工；召唤只提示“原型”，不执行任务。
- **技能**：已安装 / 推荐市场切换；启用/关闭、卸载、安装；添加技能会插入一条 mock 技能。
- **连接器**：分类、搜索；授权/断开切换；添加连接器会插入 mock 项。
- **自动化**：暂停/恢复、立即运行（追加一条历史）、查看历史、通过弹窗创建新任务。
- **数据管理**：存储占用与分类占比、清理缓存、归档任务恢复/删除、导出入口。

## 三、工作台侧的原型增强

- **任务行菜单**：重命名（行内输入）、归档、删除、打开文件夹入口。
  重命名/归档只改 `ui-state`，不写运行记录；刷新后恢复。
- **输入框工具栏**：`＋` 附件、`@ 引用`、`/ 技能`；附件以 chip 展示，可移除。
  发送时仍然只把文本交给宿主，附件不会上传。
- **右栏「文件」页**：从产物与变更路径生成 mock 工作区树；点击产物跳到「产物」页，
  点击普通文件显示占位预览。接入 `fs.list` / `fs.read` 后替换这里的数据源。

## 四、接真实 API 时的替换点

| UI | 现在 | 接真实后 |
|---|---|---|
| 专家中心 | `EXPERTS` 常量 | `expert.list` / `expert.open` |
| 技能 | `SKILLS` + 本地 state | `skill.list` / `skill.install` / `skill.toggle` |
| 连接器 | `CONNECTORS` + 本地 state | `connector.list` / `connector.authorize` |
| 自动化 | `AUTOMATIONS` + 本地 state | `automation.list` / `automation.save` / `automation.run` |
| 数据管理 | `STORAGE` / `ARCHIVED_TASKS` | `data.usage` / `task.archive` / `data.export` |
| 工作区文件树 | 产物 + 变更路径推导 | `fs.list` / `fs.read` |
| 附件 | 本地 chip | `file.upload` 或 `message.send.attachments` |
| 任务重命名/归档 | `ui-state` 覆盖 | `task.rename` / `task.archive` / `task.delete` |

命令契约已写在 `2026-11-04-workbuddy-ui-gap-and-roi.md` 第四节。

## 五、明确限制

- 刷新页面后所有 mock 操作重置；只有置顶任务保存在 `localStorage`。
- 不发起 OAuth、不注册定时任务、不删除/导出真实数据。
- 专家召唤不创建真实 run；附件不会进入模型上下文。
- 这些页面的目的是评估信息架构与交互，不是可发布功能。
