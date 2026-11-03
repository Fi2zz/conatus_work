import type { RunView } from '@/bridge/types'

export interface MetricRow {
  label: string
  left: string
  right: string
  delta?: 'better' | 'worse' | 'same'
}

export interface CompareResult {
  metrics: MetricRow[]
  onlyLeft: string[]
  both: string[]
  onlyRight: string[]
  changes: Array<{ label: string; left: number; right: number }>
}

function durationOf(run: RunView): number | null {
  if (!run.endedAt) return null
  const ms = Date.parse(run.endedAt) - Date.parse(run.startedAt)
  return Number.isFinite(ms) ? ms : null
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '进行中'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function deltaOf(left: number, right: number, lowerIsBetter = true): MetricRow['delta'] {
  if (left === right) return 'same'
  if (lowerIsBetter) return right < left ? 'better' : 'worse'
  return right > left ? 'better' : 'worse'
}

/** 两次运行的并列对比：指标、产物差集、变更计数。 */
export function compareRuns(left: RunView, right: RunView): CompareResult {
  const leftMs = durationOf(left)
  const rightMs = durationOf(right)
  const leftPaths = new Set(left.artifacts.map((artifact) => artifact.path))
  const rightPaths = new Set(right.artifacts.map((artifact) => artifact.path))

  return {
    metrics: [
      { label: '状态', left: left.status, right: right.status },
      {
        label: '耗时',
        left: formatDuration(leftMs),
        right: formatDuration(rightMs),
        delta: leftMs !== null && rightMs !== null ? deltaOf(leftMs, rightMs) : undefined,
      },
      {
        label: '成本',
        left: `$${left.usage.costUsd.toFixed(4)}`,
        right: `$${right.usage.costUsd.toFixed(4)}`,
        delta: deltaOf(left.usage.costUsd, right.usage.costUsd),
      },
      {
        label: '输入 token',
        left: `${left.usage.inputTokens}`,
        right: `${right.usage.inputTokens}`,
        delta: deltaOf(left.usage.inputTokens, right.usage.inputTokens),
      },
      {
        label: '输出 token',
        left: `${left.usage.outputTokens}`,
        right: `${right.usage.outputTokens}`,
        delta: deltaOf(left.usage.outputTokens, right.usage.outputTokens),
      },
      {
        label: '产物',
        left: `${left.artifacts.length}`,
        right: `${right.artifacts.length}`,
        delta: deltaOf(left.artifacts.length, right.artifacts.length, false),
      },
    ],
    onlyLeft: [...leftPaths].filter((path) => !rightPaths.has(path)),
    both: [...leftPaths].filter((path) => rightPaths.has(path)),
    onlyRight: [...rightPaths].filter((path) => !leftPaths.has(path)),
    changes: [
      { label: '移动', left: left.changes?.summary.moved ?? 0, right: right.changes?.summary.moved ?? 0 },
      { label: '冲突', left: left.changes?.summary.quarantined ?? 0, right: right.changes?.summary.quarantined ?? 0 },
      { label: '新增', left: left.changes?.summary.added ?? 0, right: right.changes?.summary.added ?? 0 },
      { label: '修改', left: left.changes?.summary.modified ?? 0, right: right.changes?.summary.modified ?? 0 },
      { label: '删除', left: left.changes?.summary.deleted ?? 0, right: right.changes?.summary.deleted ?? 0 },
    ],
  }
}
