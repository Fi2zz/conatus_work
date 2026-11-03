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

function ok<T>(value: T): CommandResult<T> {
  return { ok: true, value }
}

function notFound<T>(message: string): CommandResult<T> {
  return { ok: false, error: { code: 'NOT_FOUND', message } }
}

function summaryOf(fixture: ReplayFixture): RunSummary {
  const { workspaceRoot, synthetic, ...summary } = fixture.run
  void workspaceRoot
  void synthetic
  return { ...summary, status: 'running', endedAt: undefined }
}

export function createReplayTransport(fixture: ReplayFixture, options: ReplayOptions = {}): BridgeTransport {
  const scheduler = options.scheduler ?? realScheduler
  const speed = options.speed ?? 1
  const listeners = new Set<(event: BridgeEvent) => void>()
  const cancels: Array<() => void> = []
  let nextSeq = 0

  function emit(event: BridgeEvent): void {
    for (const listener of listeners) listener(event)
  }

  function orderedEvents(): Array<{ seq: number; at: number; type: string; data: unknown }> {
    return [...fixture.events]
      .map((event, index) => ({ event, index }))
      .sort((left, right) => left.event.at - right.event.at || left.index - right.index)
      .map(({ event }) => event)
  }

  function emitReplayEvent(event: { seq: number; at: number; type: string; data: unknown }): void {
    emit({ ...event, seq: nextSeq++, runId: fixture.run.id } as BridgeEvent)
  }

  function foldToNow(): WorkbenchState {
    let state = applyEvent(initialWorkbenchState, {
      seq: -1,
      at: 0,
      type: 'snapshot',
      data: {
        runs: [summaryOf(fixture)],
        activeRunId: fixture.run.id,
        checkpoints: { [fixture.run.id]: fixture.checkpoints },
      },
    })
    let localSeq = 0
    for (const event of orderedEvents()) {
      const delay = speed === 0 ? 0 : event.at / speed
      if (delay > scheduler.now()) break
      state = applyEvent(state, { ...event, seq: localSeq++, runId: fixture.run.id } as BridgeEvent)
    }
    return state
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
      for (const event of orderedEvents()) {
        if (speed === 0) {
          emitReplayEvent(event)
          continue
        }
        cancels.push(
          scheduler.after(event.at / speed, () => {
            emitReplayEvent(event)
          }),
        )
      }
    },

    disconnect() {
      for (const cancel of cancels.splice(0)) cancel()
      listeners.clear()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async listTasks() {
      return ok([summaryOf(fixture)])
    },

    async openTask(runId: string) {
      if (runId !== fixture.run.id) return notFound<RunView>(`没有这个运行：${runId}`)
      return ok(foldToNow().runs[runId])
    },

    async startTask(cardId: string) {
      if (cardId !== fixture.run.taskId) return notFound(`没有这张任务卡：${cardId}`)
      return ok({ runId: fixture.run.id })
    },

    async cancelTask() {
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
      emitReplayEvent({ seq: nextSeq, at: 0, type: 'approval/resolved', data: { requestId, name, decision } })
      return ok(undefined)
    },

    async openDiff() {
      const changes: ChangeSet | null = fixture.changes
      if (!changes) return notFound<ChangeSet>('该运行未记录变更')
      return ok(changes)
    },

    async undo(_runId: string, steps: number) {
      const result: UndoResult = fixture.scripts?.undo ?? { ok: true, appliedSteps: steps, failures: [] }
      emitReplayEvent({ seq: nextSeq, at: 0, type: 'undo/finished', data: { ...result, steps } })
      return ok(result)
    },

    async redo(_runId: string, steps: number) {
      const result: RedoResult = fixture.scripts?.redo ?? { ok: true, appliedSteps: steps }
      emitReplayEvent({ seq: nextSeq, at: 0, type: 'redo/finished', data: { ...result, steps } })
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
