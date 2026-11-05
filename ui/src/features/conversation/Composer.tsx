import { useEffect, useRef, useState } from 'react'
import type { JSX, ClipboardEvent as ReactClipboardEvent, DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'

import { getTransport, hasTransport } from '@/bridge/transport-store'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench, useWorkbenchStore } from '@/state/workbench-store'
import { ComposerTools } from './ComposerTools'
import { ModelPicker } from './ModelPicker'

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
  const [attachments, setAttachments] = useState<string[]>([])

  const replay = hasTransport() && getTransport().mode === 'replay'
  const pendingApproval = run?.approval !== undefined
  const ended = run ? FINISHED.has(run.status) : false
  const running = run?.status === 'running' || run?.status === 'pending'
  const disabled = pendingApproval || replay || sending

  useEffect(() => {
    const node = area.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.max(84, Math.min(node.scrollHeight, 220))}px`
  }, [draft])

  async function send(): Promise<void> {
    if (!run || disabled || running || draft.trim() === '') return
    setError(null)
    setSending(true)
    try {
      const result = await getTransport().sendMessage(run.id, draft)
      if (result.ok) {
        setDraft('')
        setAttachments([])
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

  function addAttachment(name: string): void {
    setAttachments((current) => (current.includes(name) ? current : [...current, name]))
  }

  function addFiles(files: FileList | File[]): void {
    for (const file of Array.from(files)) addAttachment(file.name || '粘贴的截图.png')
  }

  function onPaste(event: ReactClipboardEvent<HTMLDivElement>): void {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()
    addFiles(files)
  }

  function onDrop(event: ReactDragEvent<HTMLDivElement>): void {
    if (event.dataTransfer.files.length === 0) return
    event.preventDefault()
    addFiles(event.dataTransfer.files)
  }

  function insert(text: string): void {
    setDraft(draft.trim() === '' ? text : `${draft} ${text}`)
    area.current?.focus()
  }

  const hint = replay
    ? ended
      ? '回放已结束，发送消息不会被执行。'
      : '回放模式，发送消息不会被执行。'
    : null
  const continueHint = !replay && ended && !pendingApproval ? '任务已结束，发送消息会继续该会话。' : null

  return (
    <div className="border-t border-line/70 bg-panel px-3 py-2">
      {hint ? (
        <p data-testid="composer-ended" className="mb-1 text-[10.5px] text-ink-muted">
          {hint}
        </p>
      ) : null}
      {continueHint ? (
        <p data-testid="composer-continue" className="mb-1 text-[10.5px] text-ink-muted">
          {continueHint}
        </p>
      ) : null}
      {error ? (
        <p data-testid="composer-error" role="alert" className="mb-1 text-[10.5px] text-danger">
          {error}
        </p>
      ) : null}
      <div
        data-testid="composer-box"
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(event) => event.preventDefault()}
        className="rounded-xl border border-line bg-canvas transition-colors focus-within:border-accent"
      >
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1 px-3 pt-2">
            {attachments.map((name) => (
              <span
                key={name}
                data-testid="composer-attachment"
                className="flex items-center gap-1 rounded-sm border border-line bg-panel px-1.5 py-0.5 text-[10px] text-ink-muted"
              >
                {name}
                <button
                  type="button"
                  data-testid="remove-attachment"
                  aria-label={`移除 ${name}`}
                  onClick={() => setAttachments((current) => current.filter((item) => item !== name))}
                  className="text-ink-faint hover:text-danger"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <textarea
          ref={area}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={4}
          placeholder={
            pendingApproval
              ? '等待审批…'
              : running
                ? '运行中，停止后可继续交代'
                : '继续交代任务，⌘↵ 发送'
          }
          className="composer-input max-h-[220px] min-h-[84px] w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[13px] leading-relaxed outline-none disabled:opacity-60"
        />
        <div className="flex items-center gap-1 px-2 pb-1.5">
          <ComposerTools disabled={disabled || running} onAttach={addAttachment} onInsert={insert} />
          <ModelPicker disabled={disabled || running} />
          <span className="ml-auto hidden text-[9.5px] text-ink-faint sm:inline">原型：附件不会上传</span>
          {pendingApproval || replay ? null : running && run ? (
            <Button
              variant="danger"
              size="sm"
              data-testid="composer-stop"
              aria-label="停止运行"
              title="停止运行"
              disabled={stopping}
              onClick={() => {
                const runId = run.id
                const previous = run.status
                setStoppingRun(runId)
                useWorkbenchStore.getState().setStatus(runId, 'aborted')
                void getTransport()
                  .cancelTask(runId)
                  .then((result) => {
                    if (!result.ok) {
                      useWorkbenchStore.getState().setStatus(runId, previous)
                      setStoppingRun(null)
                    } else {
                      useWorkbenchStore.getState().setStatus(runId, result.value.status)
                    }
                  })
                  .catch(() => {
                    useWorkbenchStore.getState().setStatus(runId, previous)
                    setStoppingRun(null)
                  })
              }}
              className="h-7 w-7 shrink-0 rounded-full p-0 text-[11px]"
            >
              <span aria-hidden className="text-[9px] leading-none">
                ■
              </span>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              data-testid="composer-send"
              aria-label="发送"
              title="发送（⌘↵）"
              disabled={disabled || draft.trim() === ''}
              onClick={() => void send()}
              className="h-7 w-7 shrink-0 rounded-full p-0 text-[14px] leading-none"
            >
              <span aria-hidden>{sending ? '…' : '↑'}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
