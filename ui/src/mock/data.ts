export interface Expert {
  id: string
  name: string
  kind: 'single' | 'team'
  category: string
  blurb: string
  tags: string[]
  examples: string[]
  members?: Array<{ name: string; role: string }>
}

export const EXPERTS: Expert[] = [
  {
    id: 'expert-report',
    name: '调研报告专家',
    kind: 'single',
    category: '调研',
    blurb: '围绕主题检索、筛选来源，输出带引用的 Markdown 报告。',
    tags: ['联网检索', '引用核验', '长报告'],
    examples: ['调研 2026 年 AI Agent 趋势', '整理竞品功能对比'],
  },
  {
    id: 'expert-csv',
    name: '数据分析师',
    kind: 'single',
    category: '数据',
    blurb: '读取 CSV / Excel，做清洗、聚合与图表，输出结论与可复现脚本。',
    tags: ['CSV', '图表', '结论'],
    examples: ['分析季度销售数据', '找出异常订单'],
  },
  {
    id: 'expert-organize',
    name: '文件整理管家',
    kind: 'single',
    category: '文件',
    blurb: '按类型、月份或命名规则整理目录，生成变更清单与回滚点。',
    tags: ['批量移动', '去重', '变更清单'],
    examples: ['整理下载文件夹', '按项目归档合同'],
  },
  {
    id: 'expert-ppt',
    name: '演示文稿设计师',
    kind: 'single',
    category: '文档',
    blurb: '把提纲或材料转成结构清晰的演示文稿，先出大纲再出页面。',
    tags: ['PPT', '大纲', '版式'],
    examples: ['把周报做成 8 页 PPT', '生成产品发布提纲'],
  },
  {
    id: 'expert-review',
    name: '内容审校',
    kind: 'single',
    category: '文档',
    blurb: '检查事实、术语、格式与语气，按严重度列出修改建议。',
    tags: ['事实核查', '术语', '风格'],
    examples: ['审校对外公告', '检查报告引用'],
  },
  {
    id: 'expert-ops',
    name: '运营周报助手',
    kind: 'single',
    category: '运营',
    blurb: '汇总一周数据与进展，生成可直接发送的周报草稿。',
    tags: ['周报', '指标', '模板'],
    examples: ['汇总本周运营数据', '生成给管理层的简报'],
  },
  {
    id: 'team-launch',
    name: '产品发布专家团',
    kind: 'team',
    category: '产品',
    blurb: '调研、方案、文案、评审四个角色协作，团长负责拆分与汇总。',
    tags: ['多角色', '发布', '评审'],
    examples: ['准备一次产品发布', '从需求到对外材料'],
    members: [
      { name: '团长 · 产品负责人', role: '拆解目标、分配任务、汇总交付' },
      { name: '市场调研', role: '竞品与用户反馈' },
      { name: '方案设计', role: '功能范围与验收标准' },
      { name: '内容评审', role: '文案与风险检查' },
    ],
  },
  {
    id: 'team-research',
    name: '深度调研专家团',
    kind: 'team',
    category: '调研',
    blurb: '检索、交叉验证、写作、事实核查分工推进，适合长报告。',
    tags: ['多角色', '交叉验证', '长报告'],
    examples: ['写一份行业白皮书', '对比三家供应商'],
    members: [
      { name: '团长 · 研究负责人', role: '确定问题与证据标准' },
      { name: '检索员', role: '收集来源与原始数据' },
      { name: '写作者', role: '组织论证与成稿' },
      { name: '核查员', role: '逐条核对引用与数字' },
    ],
  },
]

export interface Skill {
  id: string
  name: string
  category: string
  description: string
  version: string
  source: '内置' | '市场' | '本地'
  installed: boolean
  enabled: boolean
}

export const SKILLS: Skill[] = [
  {
    id: 'skill-docx',
    name: 'DOCX 报告排版',
    category: '文档',
    description: '按模板生成带页眉页脚、目录和图表编号的 Word 报告。',
    version: '1.4.0',
    source: '内置',
    installed: true,
    enabled: true,
  },
  {
    id: 'skill-xlsx',
    name: 'Excel 数据透视',
    category: '数据',
    description: '读取多个工作表，生成透视表与图表，保留公式。',
    version: '2.0.1',
    source: '内置',
    installed: true,
    enabled: true,
  },
  {
    id: 'skill-cite',
    name: '引用核验',
    category: '调研',
    description: '逐条检查来源可访问性与引用一致性，输出问题列表。',
    version: '0.9.3',
    source: '市场',
    installed: true,
    enabled: false,
  },
  {
    id: 'skill-slides',
    name: 'PPT 生成',
    category: '文档',
    description: '从大纲生成演示文稿，支持主题色与版式约束。',
    version: '1.1.0',
    source: '市场',
    installed: false,
    enabled: false,
  },
  {
    id: 'skill-meeting',
    name: '会议纪要助手',
    category: '协作',
    description: '把转写文本整理成结论、待办与负责人。',
    version: '1.0.2',
    source: '市场',
    installed: false,
    enabled: false,
  },
  {
    id: 'skill-rename',
    name: '批量重命名',
    category: '文件',
    description: '按正则或字段模板批量重命名，先预览再执行。',
    version: '0.6.0',
    source: '本地',
    installed: false,
    enabled: false,
  },
]

export interface Connector {
  id: string
  name: string
  category: string
  description: string
  status: 'connected' | 'disconnected'
  account?: string
  tools: number
}

export const CONNECTORS: Connector[] = [
  {
    id: 'conn-tencent-doc',
    name: '腾讯文档',
    category: '文档',
    description: '读取与写入在线文档、表格和幻灯片。',
    status: 'connected',
    account: 'fitzy@example.com',
    tools: 12,
  },
  {
    id: 'conn-wecom',
    name: '企业微信',
    category: '协作',
    description: '发送消息、读取群资料、创建日程。',
    status: 'connected',
    account: 'Conatus 项目组',
    tools: 8,
  },
  {
    id: 'conn-github',
    name: 'GitHub',
    category: '开发',
    description: '读取仓库、Issue 与 Pull Request。',
    status: 'disconnected',
    tools: 15,
  },
  {
    id: 'conn-notion',
    name: 'Notion',
    category: '文档',
    description: '检索页面与数据库，写回整理结果。',
    status: 'disconnected',
    tools: 9,
  },
  {
    id: 'conn-qqmail',
    name: 'QQ 邮箱',
    category: '协作',
    description: '读取邮件、生成摘要、创建草稿。',
    status: 'connected',
    account: 'fitzy@qq.com',
    tools: 6,
  },
  {
    id: 'conn-gaode',
    name: '高德地图',
    category: '数据',
    description: '地点检索、路线规划与距离计算。',
    status: 'disconnected',
    tools: 4,
  },
]

export interface AutomationLog {
  id: string
  at: string
  status: 'succeeded' | 'failed'
  note: string
}

export interface Automation {
  id: string
  name: string
  schedule: string
  workspace: string
  prompt: string
  status: 'active' | 'paused'
  nextRun: string
  history: AutomationLog[]
}

export const AUTOMATIONS: Automation[] = [
  {
    id: 'auto-daily-ai',
    name: '每日 AI 简报',
    schedule: '每天 09:00',
    workspace: '~/Work/简报',
    prompt: '检索过去 24 小时的 AI 行业动态，筛选最多 5 条，写成 Markdown。',
    status: 'active',
    nextRun: '明天 09:00',
    history: [
      { id: 'log-1', at: '今天 09:00', status: 'succeeded', note: '生成 5 条，已保存到 out/' },
      { id: 'log-2', at: '昨天 09:00', status: 'succeeded', note: '生成 4 条' },
    ],
  },
  {
    id: 'auto-weekly',
    name: '每周工作周报',
    schedule: '每周五 17:00',
    workspace: '~/Work/周报',
    prompt: '汇总本周工作记录，整理已完成、进行中、风险与下周计划。',
    status: 'active',
    nextRun: '本周五 17:00',
    history: [{ id: 'log-3', at: '上周五 17:00', status: 'succeeded', note: '生成周报草稿' }],
  },
  {
    id: 'auto-inbox',
    name: '收件箱整理',
    schedule: '每隔 6 小时',
    workspace: '~/Downloads',
    prompt: '按类型和月份整理下载目录，同名冲突放入 quarantine。',
    status: 'paused',
    nextRun: '已暂停',
    history: [{ id: 'log-4', at: '昨天 18:00', status: 'failed', note: '目标目录被占用' }],
  },
]

export interface ArchivedTask {
  id: string
  title: string
  chain: string
  archivedAt: string
}

export const ARCHIVED_TASKS: ArchivedTask[] = [
  { id: 'run-arch-1', title: '整理 2026-08 发票', chain: 'organize', archivedAt: '2026-10-21' },
  { id: 'run-arch-2', title: 'Q3 销售数据分析', chain: 'csv', archivedAt: '2026-10-18' },
  { id: 'run-arch-3', title: '竞品调研初稿', chain: 'research', archivedAt: '2026-10-12' },
]

export interface StorageSlice {
  label: string
  bytes: number
}

export const STORAGE: StorageSlice[] = [
  { label: '会话与日志', bytes: 1_240_000_000 },
  { label: '产物与工作区', bytes: 3_800_000_000 },
  { label: '检查点快照', bytes: 2_100_000_000 },
  { label: '缓存', bytes: 460_000_000 },
]

export const STORAGE_LIMIT = 10_000_000_000
