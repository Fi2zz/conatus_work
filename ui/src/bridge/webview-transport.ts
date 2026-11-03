import type { BridgeEvent } from './events'
import type { ReplayFixture } from './fixture'
import { parseFixture } from './fixture'
import type { BridgeTransport } from './transport'
import type {
  ChangeSet,
  CommandResult,
  RedoResult,
  RunStatus,
  RunSummary,
  ModelConfig,
  RunView,
  TaskCard,
  UndoResult,
} from './types'
import { applyEvent } from '@/state/apply-event'
import { initialWorkbenchState } from '@/state/workbench-state'

export interface HostChannel {
  post(frame: unknown): void
  subscribe(listener: (frame: unknown) => void): () => void
}

const PROTOCOL = 1
const DEFAULT_TIMEOUT = 10_000

interface ResultFrame {
  v: number
  kind: 'result'
  id: string
  ok: boolean
  value?: unknown
  error?: { code: string; message: string }
}

function frameOf(value: unknown): ResultFrame | null {
  if (value === null || typeof value !== 'object') return null
  const frame = value as Record<string, unknown>
  if (frame.v !== PROTOCOL) return null
  if (frame.kind !== 'result') return null
  if (typeof frame.id !== 'string' || typeof frame.ok !== 'boolean') return null
  if (!frame.ok && (frame.error === null || typeof frame.error !== 'object')) return null
  return frame as unknown as ResultFrame
}

interface NativeChannel {
  postMessage?: (value: unknown) => void
}

function nativeChannel(): NativeChannel | undefined {
  return (window as unknown as { conatus?: NativeChannel }).conatus
}

function webview2Channel(): NativeChannel | undefined {
  return (window as unknown as { chrome?: { webview?: NativeChannel } }).chrome?.webview
}

/** 浏览器 / WebView 通道：只接收来自 parent 的消息。 */
export function createWindowChannel(target: Window = window): HostChannel {
  return {
    post(frame) {
      const native = nativeChannel()
      if (native?.postMessage) {
        // WKWebView 的 JavaScriptChannel 只传字符串。
        native.postMessage(JSON.stringify(frame))
        return
      }
      const webview = webview2Channel()
      if (webview?.postMessage) {
        webview.postMessage(frame)
        return
      }
      target.parent.postMessage(frame, '*')
    },
    subscribe(listener) {
      if (nativeChannel()?.postMessage) {
        const holder = window as unknown as { __conatusReceive?: (raw: string) => void }
        holder.__conatusReceive = (raw: string) => {
          try {
            listener(JSON.parse(raw))
          } catch {
            // 坏帧直接丢弃
          }
        }
        return () => {
          delete holder.__conatusReceive
        }
      }
      function onMessage(event: MessageEvent): void {
        if (event.source !== window.parent) return
        listener(event.data)
      }
      window.addEventListener('message', onMessage)
      const webview = (window as unknown as {
        chrome?: {
          webview?: {
            addEventListener?: (name: string, fn: (event: MessageEvent) => void) => void
            removeEventListener?: (name: string, fn: (event: MessageEvent) => void) => void
          }
        }
      }).chrome?.webview
      const onWebview = (event: MessageEvent): void => listener(event.data)
      webview?.addEventListener?.('message', onWebview)
      return () => {
        window.removeEventListener('message', onMessage)
        webview?.removeEventListener?.('message', onWebview)
      }
    },
  }
}

function unsupported<T>(command: string): CommandResult<T> {
  return {
    ok: false,
    error: { code: 'INTERNAL', message: `命令 ${command} 需要 Flutter 壳接线后才能执行` },
  }
}

function summaryOf(fixture: ReplayFixture): RunSummary {
  const { workspaceRoot, ...summary } = fixture.run
  void workspaceRoot
  return summary
}

function viewOf(fixture: ReplayFixture): RunView {
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
  let seq = 0
  for (const event of fixture.events) {
    state = applyEvent(state, { ...event, seq: seq++, runId: fixture.run.id } as BridgeEvent)
  }
  return state.runs[fixture.run.id]
}

interface Options {
  channel?: HostChannel
  timeoutMs?: number
}

export function createWebViewTransport(options: Options = {}): BridgeTransport {
  const channel = options.channel ?? createWindowChannel()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT
  const pending = new Map<string, (frame: ResultFrame) => void>()
  const listeners = new Set<(event: BridgeEvent) => void>()
  let counter = 0
  let welcome: (() => void) | null = null
  let unsubscribe: (() => void) | null = null

  function receive(value: unknown): void {
    if (value === null || typeof value !== 'object') return
    const frame = value as Record<string, unknown>
    if (frame.v !== PROTOCOL) return
    if (frame.kind === 'welcome') {
      welcome?.()
      return
    }
    if (frame.kind === 'event') {
      for (const listener of listeners) listener(frame.event as BridgeEvent)
      return
    }
    const result = frameOf(value)
    if (!result) return
    const resolve = pending.get(result.id)
    if (!resolve) return
    pending.delete(result.id)
    resolve(result)
  }

  function request<T>(command: string, payload: Record<string, unknown> = {}): Promise<CommandResult<T>> {
    counter += 1
    const id = `c${counter}`
    return new Promise<CommandResult<T>>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        resolve({ ok: false, error: { code: 'INTERNAL', message: `宿主超时：${command}` } })
      }, timeoutMs)
      pending.set(id, (frame) => {
        clearTimeout(timer)
        resolve(
          frame.ok
            ? { ok: true, value: frame.value as T }
            : { ok: false, error: { code: frame.error!.code as never, message: frame.error!.message } },
        )
      })
      channel.post({ v: PROTOCOL, kind: 'command', id, command, payload })
    })
  }

  return {
    async connect() {
      unsubscribe = channel.subscribe(receive)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('宿主未响应 hello')), timeoutMs)
        welcome = () => {
          clearTimeout(timer)
          resolve()
        }
        channel.post({ v: PROTOCOL, kind: 'hello' })
      })
    },

    disconnect() {
      unsubscribe?.()
      unsubscribe = null
      listeners.clear()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    listTasks: () => request<RunSummary[]>('task.list'),

    listCards: () => request<TaskCard[]>('task.cards'),

    chooseWorkspace: () => request<{ path: string | null }>('workspace.choose'),

    readConfig: () => request<ModelConfig>('config.read'),

    saveConfig: (payload) => request<ModelConfig>('config.save', { ...payload }),

    async openTask(runId: string) {
      const result = await request<ReplayFixture>('task.open', { runId })
      if (!result.ok) return result as CommandResult<RunView>
      return { ok: true, value: viewOf(parseFixture(result.value)) }
    },

    startTask: (cardId: string, workspaceRoot?: string) =>
      request<{ runId: string }>('task.start', {
        cardId,
        ...(workspaceRoot ? { workspaceRoot } : {}),
      }),
    cancelTask: (runId: string) => Promise.resolve(unsupported<{ status: RunStatus }>(`task.cancel(${runId})`)),
    sendMessage: () => Promise.resolve(unsupported<void>('message.send')),
    respondApproval: () => Promise.resolve(unsupported<void>('approval.respond')),

    openDiff: (runId: string, filePath?: string) =>
      request<ChangeSet>('diff.open', { runId, ...(filePath ? { filePath } : {}) }),

    undo: (runId: string, steps: number) => request<UndoResult>('undo', { runId, steps }),
    redo: (runId: string, steps: number) => request<RedoResult>('redo', { runId, steps }),

    revealArtifact: (runId: string, path: string) =>
      request<{ path: string }>('artifact.reveal', { runId, path }),

    readArtifact: (runId: string, path: string) =>
      request<{ content: string; truncated: boolean; encoding?: 'utf8' | 'base64' }>('artifact.read', {
        runId,
        path,
      }),
  }
}
