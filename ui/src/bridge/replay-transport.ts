import type { BridgeEvent } from './events'
import type { ReplayFixture } from './fixture'
import { realScheduler, type Scheduler } from './scheduler'
import type { BridgeTransport } from './transport'
import type {
  ChangeSet,
  CommandResult,
  RedoResult,
  RunStatus,
  RunSummary,
  RunView,
  UndoResult,
  WorkbenchState,
} from './types'
import { applyEvent } from '@/state/apply-event'
import { initialWorkbenchState } from '@/state/workbench-state'

interface ReplayOptions {
  scheduler?: Scheduler
  speed?: number
}

interface RunSession {
  cancels: Array<() => void>
  seq: number
}

function ok<T>(value: T): CommandResult<T> {
  return { ok: true, value }
}

function notFound<T>(message: string): CommandResult<T> {
  return { ok: false, error: { code: 'NOT_FOUND', message } }
}

function summaryOf(fixture: ReplayFixture): RunSummary {
  const { workspaceRoot, ...summary } = fixture.run
  void workspaceRoot
  return { ...summary, status: 'running', endedAt: undefined }
}

export function createReplayTransport(fixture: ReplayFixture, options: ReplayOptions = {}): BridgeTransport {
  const scheduler = options.scheduler ?? realScheduler
  const options_ = options
  const listeners = new Set<(event: BridgeEvent) => void>()
  const sessions = new Map<string, RunSession>()
  let activeRunId = fixture.run.id
  let runCounter = 0

  function emit(event: BridgeEvent): void {
    for (const listener of listeners) listener(event)
  }

  function sessionFor(runId: string): RunSession {
    const existing = sessions.get(runId)
    if (existing) return existing
    const created: RunSession = { cancels: [], seq: 0 }
    sessions.set(runId, created)
    return created
  }

  function emitRun(runId: string, event: { at: number; type: string; data: unknown }): void {
    const session = sessionFor(runId)
    emit({ ...event, seq: session.seq++, runId } as BridgeEvent)
  }

  function orderedEvents(): Array<{ seq: number; at: number; type: string; data: unknown }> {
    return [...fixture.events]
      .map((event, index) => ({ event, index }))
      .sort((left, right) => left.event.at - right.event.at || left.index - right.index)
      .map(({ event }) => event)
  }

  function pushImmediate(runId: string, event: { at: number; type: string; data: unknown }): void {
    const session = sessionFor(runId)
    session.cancels.push(
      scheduler.after(0, () => {
        emitRun(runId, event)
      }),
    )
  }

  function scheduleRun(runId: string, immediate: boolean): void {
    for (const event of orderedEvents()) {
      if (options_.speed === 0 && !immediate) {
        emitRun(runId, event)
        continue
      }
      const delay = options_.speed === 0 ? 0 : event.at / (options_.speed ?? 1)
      const session = sessionFor(runId)
      session.cancels.push(
        scheduler.after(delay, () => {
          emitRun(runId, event)
        }),
      )
    }
  }

  function cancelRun(runId: string): void {
    const session = sessions.get(runId)
    if (!session) return
    for (const cancel of session.cancels.splice(0)) cancel()
  }

  function foldToNow(runId: string): WorkbenchState {
    let state = applyEvent(initialWorkbenchState, {
      seq: -1,
      at: 0,
      type: 'snapshot',
      data: {
        runs: [{ ...summaryOf(fixture), id: runId }],
        activeRunId: runId,
        checkpoints: { [runId]: fixture.checkpoints },
      },
    })
    let localSeq = 0
    for (const event of orderedEvents()) {
      const delay = options_.speed === 0 ? 0 : event.at / (options_.speed ?? 1)
      if (delay > scheduler.now()) break
      state = applyEvent(state, { ...event, seq: localSeq++, runId } as BridgeEvent)
    }
    return state
  }

  function activeRun(): string {
    return activeRunId
  }

  return {
    async connect() {
      emit({
        seq: -1,
        at: 0,
        type: 'snapshot',
        data: {
          runs: [summaryOf(fixture)],
          activeRunId: fixture.run.id,
          checkpoints: { [fixture.run.id]: fixture.checkpoints },
        },
      })
      scheduleRun(fixture.run.id, false)
    },

    disconnect() {
      for (const runId of sessions.keys()) cancelRun(runId)
      listeners.clear()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async listTasks() {
      return ok([summaryOf(fixture)])
    },

    async listCards() {
      return ok([])
    },

    async chooseWorkspace() {
      return ok({ path: null })
    },

    async openTask(runId: string) {
      if (!sessions.has(runId) && runId !== fixture.run.id) return notFound<RunView>(`没有这个运行：${runId}`)
      return ok(foldToNow(runId).runs[runId])
    },

    async startTask(cardId: string) {
      if (cardId !== fixture.run.taskId) return notFound(`没有这张任务卡：${cardId}`)
      runCounter += 1
      const runId = `${fixture.run.id}#${runCounter}`
      activeRunId = runId
      pushImmediate(runId, {
        at: 0,
        type: 'task/started',
        data: {
          taskId: fixture.run.taskId,
          title: fixture.run.title,
          chain: fixture.run.chain,
          model: fixture.run.model,
          startedAt: fixture.run.startedAt,
        },
      })
      scheduleRun(runId, true)
      return ok({ runId })
    },

    async cancelTask(runId: string) {
      cancelRun(runId)
      emitRun(runId, { at: 0, type: 'task/status', data: { status: 'aborted' } })
      return ok({ status: 'aborted' as RunStatus })
    },

    async sendMessage() {
      return ok(undefined)
    },

    async respondApproval(requestId: string, decision: 'allow' | 'deny') {
      const requested = fixture.events.find(
        (event) =>
          event.type === 'approval/requested' &&
          (event.data as { requestId?: string }).requestId === requestId,
      )
      const name = (requested?.data as { name?: string } | undefined)?.name ?? 'unknown'
      emitRun(activeRun(), { at: 0, type: 'approval/resolved', data: { requestId, name, decision } })
      return ok(undefined)
    },

    async openDiff() {
      const changes: ChangeSet | null = fixture.changes
      if (!changes) return notFound<ChangeSet>('该运行未记录变更')
      return ok(changes)
    },

    async undo(_runId: string, steps: number) {
      const result: UndoResult = fixture.scripts?.undo ?? { ok: true, appliedSteps: steps, failures: [] }
      emitRun(activeRun(), { at: 0, type: 'undo/finished', data: { ...result, steps } })
      return ok(result)
    },

    async redo(_runId: string, steps: number) {
      const result: RedoResult = fixture.scripts?.redo ?? { ok: true, appliedSteps: steps }
      emitRun(activeRun(), { at: 0, type: 'redo/finished', data: { ...result, steps } })
      return ok(result)
    },

    async readArtifact(_runId: string, path: string) {
      const content = fixture.files[path]
      if (content === undefined) return notFound<{ content: string; truncated: boolean }>(`产物正文不可用：${path}`)
      const truncated = fixture.artifacts.find((artifact) => artifact.path === path)?.truncated === true
      return ok({ content, truncated })
    },
  }
}
