import type { ReplayFixture } from '@/bridge/fixture'
import { parseFixture } from '@/bridge/fixture'

export interface FixtureEntry {
  id: string
  label: string
  synthetic: boolean
  load: () => Promise<ReplayFixture>
}

export const DEFAULT_FIXTURE_ID = 'organize-v01'

export const FIXTURES: FixtureEntry[] = [
  {
    id: 'organize-v01',
    label: '整理收件箱（真实运行）',
    synthetic: false,
    load: () => import('./runs/organize-v01.json').then((module) => parseFixture(module.default)),
  },
  {
    id: 'csv-sales-analysis-v01',
    label: '销售 CSV 分析（真实运行）',
    synthetic: false,
    load: () => import('./runs/csv-sales-analysis-v01.json').then((module) => parseFixture(module.default)),
  },
  {
    id: 'research-cited-report-v01',
    label: '带引用调研报告（真实运行）',
    synthetic: false,
    load: () => import('./runs/research-cited-report-v01.json').then((module) => parseFixture(module.default)),
  },
  {
    id: 'edge-undo-failed',
    label: '撤销失败（合成）',
    synthetic: true,
    load: () => import('./edge/edge-undo-failed.json').then((module) => parseFixture(module.default)),
  },
  {
    id: 'edge-redo-pruned',
    label: '重做目标已被裁剪（合成）',
    synthetic: true,
    load: () => import('./edge/edge-redo-pruned.json').then((module) => parseFixture(module.default)),
  },
  {
    id: 'edge-checkpoint-gap',
    label: '检查点轮次洞（合成）',
    synthetic: true,
    load: () => import('./edge/edge-checkpoint-gap.json').then((module) => parseFixture(module.default)),
  },
  {
    id: 'edge-approval-denied',
    label: '审批被拒绝（合成）',
    synthetic: true,
    load: () => import('./edge/edge-approval-denied.json').then((module) => parseFixture(module.default)),
  },
]

export function findFixture(id: string): FixtureEntry | undefined {
  return FIXTURES.find((entry) => entry.id === id)
}
