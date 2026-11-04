import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as XLSX from 'xlsx'

import { renderMarkdown } from '@/features/artifacts/markdown'
import { ArtifactPanel } from '@/features/artifacts/ArtifactPanel'

import { artifact, seedArtifacts } from '../helpers/artifacts'

vi.mock('docx-preview', () => ({ renderAsync: vi.fn(async () => undefined) }))

it('lists artifacts with pass marks', () => {
  seedArtifacts([artifact('out/a.md'), artifact('out/b.json', { check: { exists: true, nonEmpty: true, passed: false } })], {})
  render(<ArtifactPanel />)
  expect(screen.getByTestId('artifact-list').querySelectorAll('li')).toHaveLength(2)
  expect(screen.getByTestId('artifact-list')).toHaveTextContent('✓')
  expect(screen.getByTestId('artifact-list')).toHaveTextContent('✗')
})

it('renders markdown headings as real headings', async () => {
  seedArtifacts([artifact('out/report.md')], { 'out/report.md': '# 结论\n\n数据可用。' })
  render(<ArtifactPanel />)
  expect(await screen.findByRole('heading', { name: '结论' })).toBeInTheDocument()
})

it('strips scripts from markdown', () => {
  const html = renderMarkdown('<img src=x onerror="alert(1)"><script>alert(2)</script>')
  expect(html).not.toContain('onerror')
  expect(html).not.toContain('<script>')
})

it('opens markdown links in a new context', () => {
  const html = renderMarkdown('[示例](https://example.com)')
  expect(html).toContain('rel="noopener noreferrer"')
  expect(html).toContain('target="_blank"')
})

it('renders html artifacts inside a locked-down iframe', async () => {
  seedArtifacts([artifact('out/chart.html')], { 'out/chart.html': '<h1>图</h1>' })
  render(<ArtifactPanel />)
  const frame = (await screen.findByTestId('artifact-sandbox')) as HTMLIFrameElement
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
  expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin')
})

it('explains a missing body instead of rendering blank', async () => {
  seedArtifacts([artifact('out/lost.md')], {})
  render(<ArtifactPanel />)
  expect(await screen.findByTestId('artifact-missing')).toHaveTextContent('out/lost.md')
})

it('flags truncated content', async () => {
  seedArtifacts([artifact('out/big.md', { truncated: true })], { 'out/big.md': '# 大文件' })
  render(<ArtifactPanel />)
  expect(await screen.findByTestId('artifact-truncated')).toBeInTheDocument()
})

it('renders image artifacts from base64', async () => {
  seedArtifacts([artifact('out/chart.png')], {}, { 'out/chart.png': 'iVBORw0KGgo=' })
  render(<ArtifactPanel />)
  const image = (await screen.findByTestId('artifact-image')) as HTMLImageElement
  expect(image.src).toContain('data:image/png;base64,iVBORw0KGgo=')
})

it('prepares pdf artifacts through a blob url', async () => {
  const create = vi.fn(() => 'blob:mock-pdf')
  const revoke = vi.fn()
  Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })

  seedArtifacts([artifact('out/report.pdf')], {}, { 'out/report.pdf': 'JVBERi0=' })
  render(<ArtifactPanel />)
  const frame = (await screen.findByTestId('artifact-pdf')) as HTMLIFrameElement
  expect(frame.getAttribute('src')).toBe('blob:mock-pdf')
  expect(create).toHaveBeenCalled()
})

it('explains binary artifacts it cannot preview', async () => {
  seedArtifacts([artifact('out/archive.zip')], {}, { 'out/archive.zip': 'UEsDBA==' })
  render(<ArtifactPanel />)
  expect(await screen.findByText(/暂不支持内嵌预览/)).toBeInTheDocument()
})

it('renders csv artifacts as a table with quoted fields', async () => {
  seedArtifacts(
    [artifact('out/analysis.csv')],
    { 'out/analysis.csv': '名称,数量\n苹果,3\n"带,逗号",4' },
  )
  render(<ArtifactPanel />)
  const table = await screen.findByTestId('artifact-table')
  expect(table).toHaveTextContent('名称')
  expect(table.querySelectorAll('tbody tr')).toHaveLength(2)
  expect(table).toHaveTextContent('带,逗号')
})

it('renders xlsx artifacts as a table', async () => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['名称', '数量'], ['苹果', 3]]), '数据')
  const base64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' }) as string
  seedArtifacts([artifact('out/report.xlsx')], {}, { 'out/report.xlsx': base64 })
  render(<ArtifactPanel />)
  const table = await screen.findByTestId('artifact-table')
  expect(table).toHaveTextContent('名称')
  expect(table).toHaveTextContent('苹果')
})

it('routes docx to the document renderer', async () => {
  seedArtifacts([artifact('out/report.docx')], {}, { 'out/report.docx': 'UEsDBA==' })
  render(<ArtifactPanel />)
  expect(await screen.findByTestId('artifact-docx')).toBeInTheDocument()
})

it('names pptx in the unsupported fallback', async () => {
  seedArtifacts([artifact('out/slides.pptx')], {}, { 'out/slides.pptx': 'UEsDBA==' })
  render(<ArtifactPanel />)
  expect(await screen.findByTestId('artifact-unsupported')).toHaveTextContent('PPTX')
})

it('asks the host to reveal the artifact in the file manager', async () => {
  const calls: string[] = []
  seedArtifacts([artifact('out/a.md')], { 'out/a.md': '# 标题' })
  const module = await import('@/bridge/transport-store')
  const transport = module.getTransport()
  transport.revealArtifact = async (_runId: string, path: string) => {
    calls.push(path)
    return { ok: true, value: { path: `/abs/${path}` } }
  }
  render(<ArtifactPanel />)
  await userEvent.click(await screen.findByTestId('reveal-artifact'))
  expect(calls).toEqual(['out/a.md'])
})

it('explains a failed reveal instead of doing nothing', async () => {
  seedArtifacts([artifact('out/a.md')], { 'out/a.md': '# 标题' })
  const module = await import('@/bridge/transport-store')
  module.getTransport().revealArtifact = async () => ({
    ok: false,
    error: { code: 'NOT_FOUND', message: '回放模式没有真实文件' },
  })
  render(<ArtifactPanel />)
  await userEvent.click(await screen.findByTestId('reveal-artifact'))
  expect(await screen.findByTestId('reveal-artifact-error')).toHaveTextContent('回放模式没有真实文件')
})

it('refreshes the preview on demand', async () => {
  seedArtifacts([artifact('out/report.md')], { 'out/report.md': '# 结论\n\n数据可用。' })
  const module = await import('@/bridge/transport-store')
  const transport = module.getTransport()
  const original = transport.readArtifact
  let calls = 0
  transport.readArtifact = async (runId, path) => {
    calls += 1
    return original(runId, path)
  }
  render(<ArtifactPanel />)
  await screen.findByRole('heading', { name: '结论' })
  expect(calls).toBe(1)
  await userEvent.click(screen.getByTestId('refresh-artifact'))
  await waitFor(() => expect(calls).toBe(2))
})

it('opens artifacts as switchable tabs', async () => {
  seedArtifacts([artifact('out/a.md'), artifact('out/b.md')], { 'out/a.md': '# A', 'out/b.md': '# B' })
  render(<ArtifactPanel />)
  await userEvent.click(screen.getByText('out/b.md'))
  expect(screen.getAllByTestId('artifact-tab')).toHaveLength(1)
  await userEvent.click(screen.getByText('out/a.md'))
  expect(screen.getAllByTestId('artifact-tab')).toHaveLength(2)
  await userEvent.click(screen.getAllByTestId('artifact-tab-close')[0])
  expect(screen.getAllByTestId('artifact-tab')).toHaveLength(1)
})

it('highlights code artifacts', async () => {
  seedArtifacts([artifact('out/main.ts')], { 'out/main.ts': 'const answer: number = 42' })
  render(<ArtifactPanel />)
  const code = await screen.findByTestId('artifact-code')
  await waitFor(() => expect(code.querySelector('.hljs-keyword')).not.toBeNull())
  expect(code).toHaveTextContent('const')
})

it('plays audio artifacts through a blob url', async () => {
  const create = vi.fn(() => 'blob:mock-audio')
  Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
  seedArtifacts([artifact('out/voice.mp3')], {}, { 'out/voice.mp3': 'SUQzBA==' })
  render(<ArtifactPanel />)
  const audio = (await screen.findByTestId('artifact-audio')) as HTMLAudioElement
  expect(audio.getAttribute('src')).toBe('blob:mock-audio')
  expect(create).toHaveBeenCalled()
})
