import type { JSX } from 'react'

import { getTransport } from '@/bridge/transport-store'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'

const FINISHED = new Set(['succeeded', 'failed', 'aborted'])

export function Composer(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const draft = useUiStore((state) => state.composerDraft)
  const setDraft = useUiStore((state) => state.setComposerDraft)
  const pendingApproval = run?.approval !== undefined
  const ended = run ? FINISHED.has(run.status) : false

  return (
    <div className="border-t border-line bg-panel px-3 py-2">
      {ended ? (
        <p data-testid="composer-ended" className="mb-1 text-[10.5px] text-ink-muted">
          回放已结束，发送消息不会被执行。
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={pendingApproval || ended}
          rows={2}
          placeholder={pendingApproval ? '等待审批…' : '继续交代任务'}
          className="min-h-0 flex-1 resize-none rounded border border-line bg-canvas px-2 py-1 text-[12px] outline-none disabled:opacity-60"
        />
        <button
          type="button"
          data-testid="composer-send"
          disabled={pendingApproval || ended || draft.trim() === ''}
          onClick={() => {
            if (!run) return
            void getTransport().sendMessage(run.id, draft)
            setDraft('')
          }}
          className="rounded bg-accent px-2.5 py-1 text-[12px] text-white disabled:bg-ink-muted/40"
        >
          发送
        </button>
      </div>
    </div>
  )
}
