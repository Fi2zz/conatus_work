import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { getTransport } from '@/bridge/transport-store'
import type { ArtifactView } from '@/bridge/types'
import { renderMarkdown } from './markdown'

interface ArtifactPreviewProps {
  runId: string
  artifact: ArtifactView
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ok'; content: string; truncated: boolean }

function bodyOf(artifact: ArtifactView, state: PreviewState): JSX.Element {
  if (state.status === 'loading') return <p className="p-3 text-[12px] text-ink-muted">加载中…</p>
  if (state.status === 'missing') {
    return (
      <p data-testid="artifact-missing" className="p-3 text-[12px] text-ink-muted">
        产物正文不可用：{artifact.path}
      </p>
    )
  }
  if (artifact.path.endsWith('.html')) {
    return (
      <iframe
        data-testid="artifact-sandbox"
        title={artifact.path}
        sandbox="allow-scripts"
        srcDoc={state.content}
        className="h-full w-full border-0 bg-white"
      />
    )
  }
  if (artifact.path.endsWith('.md')) {
    return (
      <div
        data-testid="artifact-markdown"
        className="prose-sm overflow-y-auto p-3 text-[12.5px] [&_h1]:text-[15px] [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-[13.5px] [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:mt-1"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(state.content) }}
      />
    )
  }
  return (
    <pre data-testid="artifact-text" className="overflow-auto whitespace-pre-wrap p-3 font-mono text-[11.5px]">
      {state.content}
    </pre>
  )
}

export function ArtifactPreview({ runId, artifact }: ArtifactPreviewProps): JSX.Element {
  const [state, setState] = useState<PreviewState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    getTransport()
      .readArtifact(runId, artifact.path)
      .then((result) => {
        if (cancelled) return
        setState(
          result.ok
            ? { status: 'ok', content: result.value.content, truncated: result.value.truncated }
            : { status: 'missing' },
        )
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'missing' })
      })
    return () => {
      cancelled = true
    }
  }, [runId, artifact.path])

  return (
    <div data-testid="artifact-preview" className="flex min-h-0 flex-1 flex-col">
      {state.status === 'ok' && state.truncated ? (
        <p data-testid="artifact-truncated" className="border-b border-line bg-warning/10 px-3 py-1 text-[11px] text-warning">
          正文超过 64 KB，只显示前 64 KB。
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">{bodyOf(artifact, state)}</div>
    </div>
  )
}
