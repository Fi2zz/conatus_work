import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '@/app/App'
import { useUiStore } from '@/state/ui-state'

import { createStubTransport, summaryOf } from '../helpers/transport'

const left = {
  ...summaryOf({ id: 'run-a', title: '整理收件箱', status: 'succeeded' }),
  timeline: [],
  artifacts: [
    { path: 'out/changes.md', bytes: 10, sha256: 'a', check: { exists: true, nonEmpty: true, passed: true } },
    { path: 'out/changes.json', bytes: 20, sha256: 'b', check: { exists: true, nonEmpty: true, passed: true } },
  ],
  changes: { summary: { added: 0, modified: 0, moved: 10, deleted: 0 }, files: [] },
  checkpoints: { currentTurn: 1, startTurn: 0, keep: 5, turns: [], gaps: [] },
}

const right = {
  ...left,
  id: 'run-b',
  title: '重跑收件箱',
  artifacts: [
    { path: 'out/changes.md', bytes: 12, sha256: 'c', check: { exists: true, nonEmpty: true, passed: true } },
  ],
  usage: { inputTokens: 5, outputTokens: 3, costUsd: 0.02 },
}

it('compares two runs side by side', async () => {
  const runs = [summaryOf({ id: 'run-a', title: '整理收件箱' }), summaryOf({ id: 'run-b', title: '重跑收件箱' })]
  const transport = createStubTransport(runs, 'run-a')
  transport.openTask = async (runId: string) => ({
    ok: true,
    value: (runId === 'run-b' ? right : left) as never,
  })
  transport.readArtifact = async (runId: string, path: string) => ({
    ok: true,
    value: { content: `${runId}:${path}`, truncated: false },
  })

  useUiStore.setState({ compareOpen: false })
  render(<App transport={transport} />)
  await screen.findByTestId('task-list')
  await userEvent.click(screen.getByTestId('compare-button'))

  expect(await screen.findByTestId('compare-dialog')).toBeInTheDocument()
  await screen.findByTestId('compare-metrics')
  expect(screen.getByTestId('compare-metrics')).toHaveTextContent('产物')
  expect(screen.getByTestId('compare-changes')).toHaveTextContent('移动')
  expect(screen.getByText('仅基准有')).toBeInTheDocument()
  expect(screen.getByText('out/changes.json')).toBeInTheDocument()

  const panes = await screen.findAllByTestId(/compare-content-/)
  expect(panes[0]).toHaveTextContent('run-a:out/changes.md')
  expect(panes[1]).toHaveTextContent('run-b:out/changes.md')
})
