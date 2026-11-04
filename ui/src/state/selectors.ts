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

export function filterTimeline(
  entries: TimelineEntry[],
  mode: 'key' | 'all' | 'failed',
): TimelineEntry[] {
  if (mode === 'all') return entries
  if (mode === 'failed') {
    return entries.filter((entry) => {
      if (entry.kind === 'tool') return entry.ok === false
      if (entry.kind === 'status') return entry.status === 'failed' || entry.status === 'aborted'
      if (entry.kind === 'undo' || entry.kind === 'redo') return !entry.ok
      if (entry.kind === 'approval') return entry.decision === 'deny'
      return false
    })
  }
  return entries.filter((entry) => {
    if (entry.kind !== 'tool') return true
    if (entry.ok !== true) return true
    return !NOISE_TOOLS.includes(entry.name)
  })
}

/** 时间线条目的可搜索文本；工具条目把参数、摘要和结果都算进去。 */
export function entryText(entry: TimelineEntry): string {
  switch (entry.kind) {
    case 'user':
      return entry.text
    case 'assistant':
      return `${entry.text}\n${entry.reasoning ?? ''}`
    case 'tool':
      return [entry.name, entry.count ? `×${entry.count}` : '', entry.args, entry.summary ?? '', entry.content ?? '']
        .filter(Boolean)
        .join(' ')
    case 'approval':
      return `${entry.name} ${entry.decision ?? ''}`
    case 'undo':
      return `${entry.steps} ${entry.failures.map((failure) => `${failure.path} ${failure.error}`).join(' ')}`
    case 'redo':
      return `${entry.steps} ${entry.code ?? ''}`
    case 'status':
      return `${entry.status} ${entry.text ?? ''}`
  }
}

export function filterByText(entries: TimelineEntry[], query: string): TimelineEntry[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return entries
  return entries.filter((entry) => entryText(entry).toLowerCase().includes(needle))
}

export interface UndoScope {
  steps: number
  targetTurn: number | null
  usable: boolean
  reason?: string
}

export function undoScope(run: RunView): UndoScope {
  const { currentTurn, startTurn, keep } = run.checkpoints
  const steps = currentTurn - startTurn

  if (steps < 1) {
    return { steps: 0, targetTurn: null, usable: false, reason: '没有可撤销的轮次' }
  }

  if (startTurn < currentTurn - keep) {
    return {
      steps: 0,
      targetTurn: null,
      usable: false,
      reason: `轮次 ${startTurn} 已不在保留范围（仅保留最近 ${keep} 轮）`,
    }
  }

  return { steps, targetTurn: startTurn, usable: true }
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
