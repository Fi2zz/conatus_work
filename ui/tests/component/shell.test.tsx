import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '@/app/App'
import { ErrorBoundary } from '@/app/error-boundary'
import { readFixtureParam } from '@/app/fixture-param'
import { TaskList } from '@/features/tasks/TaskList'

import { createStubTransport, summaryOf } from '../helpers/transport'

it('renders three panes and the task list', async () => {
  const transport = createStubTransport([summaryOf()])
  render(<App transport={transport} />)
  expect(await screen.findByTestId('task-list')).toBeInTheDocument()
  expect(screen.getByTestId('timeline')).toBeInTheDocument()
  expect(screen.getByTestId('right-pane')).toBeInTheDocument()
  expect(screen.getByTestId('run-title')).toHaveTextContent('任务 A')
})

it('shows an error card for an unknown fixture id', async () => {
  window.history.replaceState({}, '', '/?fixture=does-not-exist')
  render(<App />)
  expect(await screen.findByTestId('fixture-error')).toHaveTextContent('does-not-exist')
})

it('shows the empty state when there are no tasks', () => {
  render(<TaskList runs={[]} activeId={null} onSelect={() => {}} />)
  expect(screen.getByTestId('task-list-empty')).toBeInTheDocument()
})

it('reads fixture and speed from the query string', () => {
  expect(readFixtureParam('?fixture=csv-sales-analysis-v01&speed=0')).toEqual({
    fixtureId: 'csv-sales-analysis-v01',
    speed: 0,
  })
  expect(readFixtureParam('')).toEqual({ fixtureId: 'organize-v01', speed: 1 })
  expect(readFixtureParam('?speed=abc').speed).toBe(1)
})

it('switches the active task', async () => {
  const runs = [summaryOf(), summaryOf({ id: 'run-b', title: '任务 B', startedAt: '2026-11-03T11:00:00+08:00' })]
  const transport = createStubTransport(runs, 'run-a')
  render(<App transport={transport} />)
  await screen.findByTestId('task-list')
  await userEvent.click(screen.getByText('任务 B'))
  expect(screen.getByTestId('run-title')).toHaveTextContent('任务 B')
})

it('shows a failure card instead of a blank page', () => {
  function Boom(): never {
    throw new Error('炸了')
  }
  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  )
  expect(screen.getByTestId('render-error')).toHaveTextContent('炸了')
})

it('asks the host for a run whose timeline is still empty', async () => {
  const runs = [summaryOf(), summaryOf({ id: 'run-b', title: '任务 B', startedAt: '2026-11-03T11:00:00+08:00' })]
  const transport = createStubTransport(runs, 'run-a')
  const original = transport.openTask
  const asked: string[] = []
  transport.openTask = (runId: string) => {
    asked.push(runId)
    return original(runId).then((result) =>
      result.ok
        ? {
            ok: true as const,
            value: {
              ...result.value,
              timeline: [{ kind: 'user' as const, id: 'u1', at: 0, text: '来自宿主的事件' }],
            },
          }
        : result,
    )
  }
  render(<App transport={transport} />)
  await screen.findByTestId('task-list')
  await userEvent.click(screen.getByText('任务 B'))
  expect(asked).toEqual(['run-b'])
  expect(await screen.findByText('来自宿主的事件')).toBeInTheDocument()
})

it('starts a task from a template in the new session', async () => {
  const transport = createStubTransport([summaryOf()])
  const started: string[] = []
  transport.listCards = async () => ({
    ok: true,
    value: [{ id: 'move-v01', title: '移动一个文件', chain: 'organize', path: '/tmp/card.json' }],
  })
  transport.startTask = async (cardId: string) => {
    started.push(cardId)
    return { ok: true, value: { runId: 'run-a' } }
  }
  render(<App transport={transport} />)
  await screen.findByTestId('task-list')
  await userEvent.click(screen.getByTestId('new-task-button'))
  await userEvent.click(await screen.findByText('移动一个文件'))
  expect(started).toEqual(['move-v01'])
})

it('starts a free-form task from the prompt', async () => {
  const transport = createStubTransport([summaryOf()])
  const prompts: string[] = []
  transport.createTask = async (prompt: string) => {
    prompts.push(prompt)
    return { ok: true, value: { runId: 'run-a' } }
  }
  render(<App transport={transport} />)
  await screen.findByTestId('task-list')
  await userEvent.click(screen.getByTestId('new-task-button'))
  await userEvent.type(await screen.findByTestId('new-session-prompt'), '整理下载目录并生成清单')
  await userEvent.click(screen.getByTestId('new-session-start'))
  expect(prompts).toEqual(['整理下载目录并生成清单'])
})

it('opens a new session inline instead of a modal', async () => {
  const transport = createStubTransport([summaryOf()])
  render(<App transport={transport} />)
  await screen.findByTestId('task-list')
  await userEvent.click(screen.getByTestId('new-task-button'))
  expect(await screen.findByTestId('new-session')).toBeInTheDocument()
  expect(screen.queryByTestId('new-task-dialog')).not.toBeInTheDocument()
  expect(screen.getByTestId('workspace-chip')).toHaveTextContent('自动工作区')
})
