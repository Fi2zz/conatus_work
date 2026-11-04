import { useEffect, useState } from 'react'
import type { JSX } from 'react'

const LANGUAGES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  xml: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  lua: 'lua',
  php: 'php',
}

export function languageOf(path: string): string | null {
  const ext = path.toLowerCase().split('.').pop() ?? ''
  return LANGUAGES[ext] ?? null
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 代码产物：懒加载 highlight.js，失败时退回转义后的纯文本。 */
export function CodePreview({ content, path }: { content: string; path: string }): JSX.Element {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const language = languageOf(path)
    import('highlight.js/lib/common')
      .then(({ default: hljs }) => {
        if (cancelled) return
        const value =
          language && hljs.getLanguage(language)
            ? hljs.highlight(content, { language }).value
            : hljs.highlightAuto(content).value
        setHtml(value)
      })
      .catch(() => {
        if (!cancelled) setHtml(null)
      })
    return () => {
      cancelled = true
    }
  }, [content, path])

  return (
    <pre
      data-testid="artifact-code"
      className="min-w-0 overflow-auto px-4 py-3 font-mono text-[10.5px] leading-relaxed"
    >
      <code className="hljs" dangerouslySetInnerHTML={{ __html: html ?? escapeHtml(content) }} />
    </pre>
  )
}
