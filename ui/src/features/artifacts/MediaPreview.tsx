import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { bytesFromBase64 } from '@/lib/base64'

const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac']
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v']

function mediaKind(path: string): 'audio' | 'video' | null {
  const lower = path.toLowerCase()
  if (AUDIO_EXT.some((ext) => lower.endsWith(ext))) return 'audio'
  if (VIDEO_EXT.some((ext) => lower.endsWith(ext))) return 'video'
  return null
}

function mimeOf(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.m4a')) return 'audio/mp4'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  if (lower.endsWith('.aac')) return 'audio/aac'
  if (lower.endsWith('.flac')) return 'audio/flac'
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.mov')) return 'video/quicktime'
  return 'video/mp4'
}

/** 音视频用 blob URL 播放，避免 data: 在 WKWebView 里被限制。 */
export function MediaPreview({ base64, path }: { base64: string; path: string }): JSX.Element | null {
  const kind = mediaKind(path)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (kind === null) return
    const next = URL.createObjectURL(new Blob([bytesFromBase64(base64)], { type: mimeOf(path) }))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [base64, kind, path])

  if (kind === null) return null
  if (!url) return <p className="p-4 text-[11.5px] text-ink-muted">正在准备预览…</p>
  return (
    <div className="flex min-h-0 items-center justify-center p-3">
      {kind === 'audio' ? (
        <audio data-testid="artifact-audio" controls src={url} className="w-full" />
      ) : (
        <video data-testid="artifact-video" controls src={url} className="max-h-full max-w-full rounded-md bg-black" />
      )}
    </div>
  )
}

export function mediaArtifact(path: string): boolean {
  return mediaKind(path) !== null
}
