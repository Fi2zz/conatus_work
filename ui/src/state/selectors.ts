import type { RunSummary, RunView, TimelineEntry } from '@/bridge/types'

const NOISE_TOOLS = ['list', 'read', 'glob', 'grep']

export function groupConsecutiveTools(entries: TimelineEntry[]): TimelineEntry[] {
  const grouped: TimelineEntry[] = []
  for (const entry of entries) {
    const previous = grouped.at(-1)
    const mergeable =
      previous !== undefined &&
      previous.kind === 'tool' &&
      entry.kind === 'tool' &&
      previous.name === entry.name &&
      previous.ok !== false &&
      entry.ok !== false
    if (!mergeable) {
      grouped.push(entry.kind === 'tool' ? { ...entry, count: entry.count ?? 1 } : entry)
      continue
    }
    const count = (previous.count ?? 1) + 1
    grouped[grouped.length - 1] = { ...entry, count }
  }
  return grouped
}

export function filterTimeline(entries: TimelineEntry[], mode: 'key' | 'all'): TimelineEntry[] {
  if (mode === 'all') return entries
  return entries.filter((entry) => {
    if (entry.kind !== 'tool') return true
    if (entry.ok !== true) return true
    return !NOISE_TOOLS.includes(entry.name)
  })
}

export interface UndoScope {
  steps: number
  targetTurn: number | null
  usable: boolean
  reason?: string
}

export function undoScope(run: RunView): UndoScope {
  const current = run.checkpoints.currentTurn
  const turns = [...run.checkpoints.turns].map((turn) => turn.turn).sort((left, right) => left - right)
  const target = turns.filter((turn) => turn < current).at(-1)

  if (current <= 0 || target === undefined) {
    return { steps: 0, targetTurn: null, usable: false, reason: '没有可撤销的轮次' }
  }

  if (current - run.checkpoints.keep > target) {
    return {
      steps: 0,
      targetTurn: null,
      usable: false,
      reason: `轮次 ${target} 已不在保留范围（仅保留最近 ${run.checkpoints.keep} 轮）`,
    }
  }

  return { steps: current - target, targetTurn: target, usable: true }
}

export interface DiffLine {
  n: number
  kind: 'context' | 'add' | 'del'
  text: string
}

export function diffLines(text: string): DiffLine[] {
  const lines: DiffLine[] = []
  for (const raw of text.split('\n')) {
    if (raw.startsWith('+++') || raw.startsWith('---')) continue
    if (raw === '' && lines.length === 0) continue
    const kind = raw.startsWith('+') ? 'add' : raw.startsWith('-') ? 'del' : 'context'
    lines.push({ n: lines.length + 1, kind, text: raw.replace(/^[+-]? ?/, '') })
  }
  return lines
}

export interface RunMetrics {
  tasks: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export function runMetrics(runs: RunSummary[]): RunMetrics {
  return runs.reduce<RunMetrics>(
    (total, run) => ({
      tasks: total.tasks + 1,
      inputTokens: total.inputTokens + run.usage.inputTokens,
      outputTokens: total.outputTokens + run.usage.outputTokens,
      costUsd: total.costUsd + run.usage.costUsd,
    }),
    { tasks: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  )
}
