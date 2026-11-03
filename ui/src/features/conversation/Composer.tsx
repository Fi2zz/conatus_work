import { useEffect, useRef } from 'react'
import type { JSX, KeyboardEvent as ReactKeyboardEvent } from 'react'

import { getTransport } from '@/bridge/transport-store'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'

const FINISHED = new Set(['succeeded', 'failed', 'aborted'])

export function Composer(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const draft = useUiStore((state) => state.composerDraft)
  const setDraft = useUiStore((state) => state.setComposerDraft)
  const area = useRef<HTMLTextAreaElement>(null)

  const pendingApproval = run?.approval !== undefined
  const ended = run ? FINISHED.has(run.status) : false
  const running = run?.status === 'running' || run?.status === 'pending'
  const disabled = pendingApproval || ended

  useEffect(() => {
    const node = area.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`
  }, [draft])

  function send(): void {
    if (!run || disabled || draft.trim() === '') return
    void getTransport().sendMessage(run.id, draft)
    setDraft('')
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      send()
    }
  }

  return (
    <div className="border-t border-line/70 bg-panel px-3 py-2">
      {ended ? (
        <p data-testid="composer-ended" className="mb-1 text-[10.5px] text-ink-muted">
          回放已结束，发送消息不会被执行。
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <div className="flex-1 rounded-lg border border-line bg-canvas transition-colors focus-within:border-accent/60">
          <textarea
            ref={area}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            rows={1}
            placeholder={pendingApproval ? '等待审批…' : '继续交代任务，⌘↵ 发送'}
            className="max-h-40 w-full resize-none bg-transparent px-2.5 py-2 text-[12.5px] leading-relaxed outline-none disabled:opacity-60"
          />
        </div>
        {running && run ? (
          <Button
            variant="danger"
            data-testid="composer-stop"
            aria-label="停止运行"
            onClick={() => void getTransport().cancelTask(run.id)}
            className="mb-0.5"
          >
            <span aria-hidden className="text-[9px] leading-none">
              ■
            </span>
            停止
          </Button>
        ) : (
          <Button
            variant="primary"
            data-testid="composer-send"
            disabled={disabled || draft.trim() === ''}
            onClick={send}
            className="mb-0.5"
          >
            发送
          </Button>
        )}
      </div>
    </div>
  )
}
