import type { RunSummary, RunView, TimelineEntry } from '@/bridge/types'

const NOISE_TOOLS = ['list', 'read', 'glob', 'grep']

export function groupConsecutiveTools(entries: TimelineEntry[], expanded: Set<string> = new Set()): TimelineEntry[] {
  const grouped: TimelineEntry[] = []
  let index = 0
  while (index < entries.length) {
    const head = entries[index]
    if (head.kind !== 'tool' || head.ok === false) {
      grouped.push(head)
      index += 1
      continue
    }
    let end = index + 1
    while (end < entries.length) {
      const next = entries[end]
      if (next.kind !== 'tool' || next.name !== head.name || next.ok === false) break
      end += 1
    }
    const count = end - index
    if (count > 1 && !expanded.has(head.id)) {
      const tail = entries[end - 1]
      grouped.push(tail.kind === 'tool' ? { ...tail, id: head.id, count } : tail)
    } else {
      for (let cursor = index; cursor < end; cursor += 1) grouped.push(entries[cursor])
    }
    index = end
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
