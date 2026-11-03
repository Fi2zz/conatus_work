import { render, screen } from '@testing-library/react'

import { renderMarkdown } from '@/features/artifacts/markdown'
import { ArtifactPanel } from '@/features/artifacts/ArtifactPanel'

import { artifact, seedArtifacts } from '../helpers/artifacts'

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
