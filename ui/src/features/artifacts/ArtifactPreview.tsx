import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { getTransport } from '@/bridge/transport-store'
import type { ArtifactView } from '@/bridge/types'
import { ArtifactBody, type PreviewState } from './ArtifactBody'

interface ArtifactPreviewProps {
  runId: string
  artifact: ArtifactView
}

export function ArtifactPreview({ runId, artifact }: ArtifactPreviewProps): JSX.Element {
  const [state, setState] = useState<PreviewState>({ status: 'loading' })
  const [revealError, setRevealError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  async function reveal(): Promise<void> {
    setRevealError(null)
    try {
      const result = await getTransport().revealArtifact(runId, artifact.path)
      if (!result.ok) setRevealError(result.error.message)
    } catch (cause) {
      setRevealError(String(cause))
    }
  }

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    getTransport()
      .readArtifact(runId, artifact.path)
      .then((result) => {
        if (cancelled) return
        setState(
          result.ok
            ? {
                status: 'ok',
                content: result.value.content,
                truncated: result.value.truncated,
                encoding: result.value.encoding ?? 'utf8',
              }
            : { status: 'missing' },
        )
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'missing' })
      })
    return () => {
      cancelled = true
    }
  }, [runId, artifact.path, reloadKey])

  return (
    <div data-testid="artifact-preview" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line/70 px-3 py-1">
        <span className="min-w-0 truncate font-mono text-[10.5px] text-ink-muted">{artifact.path}</span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="refresh-artifact"
            onClick={() => setReloadKey((value) => value + 1)}
            className="rounded-sm px-1 text-[10.5px] text-ink-muted hover:bg-panel-muted hover:text-ink"
          >
            刷新
          </button>
          <button
            type="button"
            data-testid="reveal-artifact"
            onClick={() => void reveal()}
            className="rounded-sm px-1 text-[10.5px] text-ink-muted hover:bg-panel-muted hover:text-ink"
          >
            在 Finder 中显示
          </button>
        </div>
      </div>
      {revealError ? (
        <p data-testid="reveal-artifact-error" role="alert" className="border-b border-line/70 px-3 py-1 text-[10.5px] text-danger">
          {revealError}
        </p>
      ) : null}
      {state.status === 'ok' && state.encoding === 'utf8' && state.truncated ? (
        <p
          data-testid="artifact-truncated"
          className="border-b border-warning/30 bg-warning/10 px-3 py-1 text-[10.5px] text-warning"
        >
          正文超过 64 KB，只显示前 64 KB。
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <ArtifactBody artifact={artifact} state={state} />
      </div>
    </div>
  )
}
