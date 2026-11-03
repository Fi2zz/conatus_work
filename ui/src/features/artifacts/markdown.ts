import DOMPurify from 'dompurify'
import { marked } from 'marked'

export function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false })
  return DOMPurify.sanitize(html)
}
