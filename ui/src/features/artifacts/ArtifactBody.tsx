import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import type { ArtifactView } from '@/bridge/types'
import { CsvTable } from './CsvTable'
import { renderMarkdown } from './markdown'

export type PreviewState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ok'; content: string; truncated: boolean; encoding: 'utf8' | 'base64' }

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
const OFFICE_EXT = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']

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

function imageMime(lower: string): string {
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function binaryBody(artifact: ArtifactView, content: string): JSX.Element {
  const lower = artifact.path.toLowerCase()
  if (IMAGE_EXT.some((ext) => lower.endsWith(ext))) {
    return (
      <div className="flex min-h-0 items-start justify-center overflow-auto p-3">
        <img
          data-testid="artifact-image"
          alt={artifact.path}
          src={`data:${imageMime(lower)};base64,${content}`}
          className="max-w-full rounded-md border border-line"
        />
      </div>
    )
  }
  if (lower.endsWith('.pdf')) return <PdfFrame base64={content} title={artifact.path} />
  const office = OFFICE_EXT.some((ext) => lower.endsWith(ext))
  return (
    <p data-testid="artifact-unsupported" className="p-4 text-[11.5px] text-ink-muted">
      {office ? 'Office 文档暂不支持内嵌预览' : '该产物是二进制文件，暂不支持内嵌预览'}：
      <span className="font-mono">{artifact.path}</span>
      <span className="mt-1 block text-[10.5px]">用「在 Finder 中显示」打开原文件。</span>
    </p>
  )
}

export function ArtifactBody({
  artifact,
  state,
}: {
  artifact: ArtifactView
  state: PreviewState
}): JSX.Element {
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
  if (state.encoding === 'base64') return binaryBody(artifact, state.content)

  const lower = artifact.path.toLowerCase()
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    return <CsvTable content={state.content} path={artifact.path} />
  }
  if (lower.endsWith('.html')) {
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
  if (lower.endsWith('.md')) {
    return (
      <div
        data-testid="artifact-markdown"
        className="prose-wb overflow-y-auto px-4 py-3"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(state.content) }}
      />
    )
  }
  if (lower.endsWith('.json')) {
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
