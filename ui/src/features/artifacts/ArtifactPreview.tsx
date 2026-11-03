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
  | { status: 'ok'; content: string; truncated: boolean; encoding: 'utf8' | 'base64' }

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

/** PDF 走 blob URL：data: 在 WKWebView 里可能被拦。 */
function PdfFrame({ base64, title }: { base64: string; title: string }): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const next = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [base64])

  if (!url) return <p className="p-4 text-[11.5px] text-ink-muted">正在准备预览…</p>
  return (
    <iframe
      data-testid="artifact-pdf"
      title={title}
      src={url}
      className="h-full w-full border-0 bg-white"
    />
  )
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function bodyOf(artifact: ArtifactView, state: PreviewState): JSX.Element {
  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-2 p-4" aria-busy>
        {[92, 78, 84, 56].map((width, index) => (
          <div
            key={index}
            className="h-3 animate-pulse rounded-sm bg-panel-muted"
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    )
  }
  if (state.status === 'missing') {
    return (
      <p data-testid="artifact-missing" className="p-4 text-[11.5px] text-ink-muted">
        产物正文不可用：<span className="font-mono">{artifact.path}</span>
      </p>
    )
  }
  if (state.encoding === 'base64') {
    const lower = artifact.path.toLowerCase()
    if (IMAGE_EXT.some((ext) => lower.endsWith(ext))) {
      const mime = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
      return (
        <div className="flex min-h-0 items-start justify-center overflow-auto p-3">
          <img
            data-testid="artifact-image"
            alt={artifact.path}
            src={`data:${mime};base64,${state.content}`}
            className="max-w-full rounded-md border border-line"
          />
        </div>
      )
    }
    if (lower.endsWith('.pdf')) {
      return <PdfFrame base64={state.content} title={artifact.path} />
    }
    return (
      <p className="p-4 text-[11.5px] text-ink-muted">
        该产物是二进制文件，暂不支持内嵌预览：<span className="font-mono">{artifact.path}</span>
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
        className="prose-wb overflow-y-auto px-4 py-3"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(state.content) }}
      />
    )
  }
  if (artifact.path.endsWith('.json')) {
    return (
      <pre
        data-testid="artifact-text"
        className="min-w-0 overflow-auto px-4 py-3 font-mono text-[10.5px] leading-relaxed whitespace-pre"
      >
        {prettyJson(state.content)}
      </pre>
    )
  }
  return (
    <pre
      data-testid="artifact-text"
      className="min-w-0 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
    >
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
  }, [runId, artifact.path])

  return (
    <div data-testid="artifact-preview" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line/70 px-3 py-1">
        <span className="min-w-0 truncate font-mono text-[10.5px] text-ink-muted">{artifact.path}</span>
        <button
          type="button"
          data-testid="reveal-artifact"
          onClick={() => void getTransport().revealArtifact(runId, artifact.path)}
          className="shrink-0 rounded-sm px-1 text-[10.5px] text-ink-muted hover:bg-panel-muted hover:text-ink"
        >
          在 Finder 中显示
        </button>
      </div>
      {state.status === 'ok' && state.encoding === 'utf8' && state.truncated ? (
        <p
          data-testid="artifact-truncated"
          className="border-b border-warning/30 bg-warning/10 px-3 py-1 text-[10.5px] text-warning"
        >
          正文超过 64 KB，只显示前 64 KB。
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">{bodyOf(artifact, state)}</div>
    </div>
  )
}
