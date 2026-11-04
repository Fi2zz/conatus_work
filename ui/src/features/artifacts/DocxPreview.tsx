import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'

import { bytesFromBase64 } from '@/lib/base64'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

interface DocxPreviewProps {
  base64: string
}

/** DOCX 在浏览器里渲染成 HTML；解析库按需加载，不进首屏包。 */
export function DocxPreview({ base64 }: DocxPreviewProps): JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function render(): Promise<void> {
      try {
        const { renderAsync } = await import('docx-preview')
        const node = host.current
        if (!node || cancelled) return
        node.replaceChildren()
        await renderAsync(new Blob([bytesFromBase64(base64)], { type: DOCX_MIME }), node, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: true,
          ignoreHeight: true,
          breakPages: false,
        })
      } catch (cause) {
        if (!cancelled) setError(String(cause))
      }
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [base64])

  if (error) {
    return (
      <p data-testid="artifact-preview-error" className="p-4 text-[11.5px] text-danger">
        文档预览失败：{error}
      </p>
    )
  }
  return <div ref={host} data-testid="artifact-docx" className="docx-preview px-4 py-3" />
}
