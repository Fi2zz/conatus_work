import type { RunView, TimelineEntry } from '@/bridge/types'
import { useUiStore } from '@/state/ui-state'
import { useWorkbenchStore } from '@/state/workbench-store'

export function seedRun(timeline: TimelineEntry[], over: Partial<RunView> = {}): RunView {
  const run: RunView = {
    id: 'run-a',
    taskId: 'task-a',
    title: '任务 A',
    chain: 'organize',
    status: 'running',
    model: 'test/model',
    startedAt: '2026-11-03T10:00:00+08:00',
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    timeline,
    artifacts: [],
    changes: null,
    checkpoints: { currentTurn: 0, startTurn: 0, keep: 5, turns: [], gaps: [] },
    ...over,
  }
  useWorkbenchStore.setState({
    runs: { 'run-a': run },
    order: ['run-a'],
    activeRunId: 'run-a',
    unknownEvents: 0,
    seenSeqs: {},
  })
  useUiStore.setState({
    module: 'work',
    filter: 'all',
    expandedKeys: new Set<string>(),
    rightTab: 'artifacts',
    undoDialog: false,
    stoppingRunId: null,
    commandOpen: false,
    newTaskOpen: false,
    compareOpen: false,
    usageOpen: false,
    shortcutsOpen: false,
    batchMode: false,
    selectedTaskIds: [],
    archiveView: false,
    taskGrouping: 'date',
  })
  return run
}

export function toolEntry(id: string, name: string, ok = true): TimelineEntry {
  return { kind: 'tool', id, callId: id, at: 0, name, args: '{}', ok, summary: `${name} 完成`, durationMs: 12 }
}
