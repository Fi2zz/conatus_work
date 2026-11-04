import { useEffect, useRef, useState } from 'react'
import type { JSX, KeyboardEvent as ReactKeyboardEvent } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'

const FINISHED = new Set(['succeeded', 'failed', 'aborted'])

export function Composer(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const draft = useUiStore((state) => state.composerDraft)
  const setDraft = useUiStore((state) => state.setComposerDraft)
  const area = useRef<HTMLTextAreaElement>(null)
  const stoppingRunId = useUiStore((state) => state.stoppingRunId)
  const setStoppingRun = useUiStore((state) => state.setStoppingRun)
  const stopping = run?.id !== undefined && stoppingRunId === run.id
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const replay = hasTransport() && getTransport().mode === 'replay'
  const pendingApproval = run?.approval !== undefined
  const ended = run ? FINISHED.has(run.status) : false
  const running = run?.status === 'running' || run?.status === 'pending'
  const disabled = pendingApproval || replay || sending

  useEffect(() => {
    const node = area.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`
  }, [draft])

  async function send(): Promise<void> {
    if (!run || disabled || draft.trim() === '') return
    setError(null)
    setSending(true)
    try {
      const result = await getTransport().sendMessage(run.id, draft)
      if (result.ok) {
        setDraft('')
      } else {
        // 失败时保留草稿：用户不该因为宿主没接上就丢掉刚写的内容。
        setError(`发送失败：${result.error.message}`)
      }
    } catch (cause) {
      setError(`发送失败：${String(cause)}`)
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void send()
    }
  }

  const hint = replay
    ? ended
      ? '回放已结束，发送消息不会被执行。'
      : '回放模式，发送消息不会被执行。'
    : null

  return (
    <div className="border-t border-line/70 bg-panel px-3 py-2">
      {hint ? (
        <p data-testid="composer-ended" className="mb-1 text-[10.5px] text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p data-testid="composer-error" role="alert" className="mb-1 text-[10.5px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <div className="flex-1 rounded-lg border border-line bg-canvas transition-colors focus-within:border-accent/60">
          <textarea
            ref={area}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setError(null)
            }}
            onKeyDown={onKeyDown}
            disabled={disabled}
            rows={1}
            placeholder={pendingApproval ? '等待审批…' : '继续交代任务，⌘↵ 发送'}
            className="max-h-40 w-full resize-none bg-transparent px-2.5 py-2 text-[12.5px] leading-relaxed outline-none disabled:opacity-60"
          />
        </div>
        {pendingApproval || replay ? null : (
          <>
            {running && run ? (
              <Button
                variant="danger"
                data-testid="composer-stop"
                aria-label="停止运行"
                disabled={stopping}
                onClick={() => {
                  setStoppingRun(run.id)
                  void getTransport()
                    .cancelTask(run.id)
                    .catch(() => setStoppingRun(null))
                }}
                className="mb-0.5"
              >
                <span aria-hidden className="text-[9px] leading-none">
                  ■
                </span>
                {stopping ? '停止中…' : '停止'}
              </Button>
            ) : null}
            <Button
              variant="primary"
              data-testid="composer-send"
              disabled={disabled || draft.trim() === ''}
              onClick={() => void send()}
              className="mb-0.5"
            >
              {sending ? '发送中…' : '发送'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
