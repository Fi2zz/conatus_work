import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ChangePanel } from '@/features/changes/ChangePanel'

import { changes, seedChanges } from '../helpers/changes'

it('shows the change summary and file count', () => {
  seedChanges(changes())
  render(<ChangePanel />)
  expect(screen.getByTestId('change-summary')).toHaveTextContent('11')
})

it('renders unified diff with +/- coloring', () => {
  seedChanges(changes())
  render(<ChangePanel />)
  expect(screen.getAllByTestId('diff-line-del').length).toBeGreaterThan(0)
  expect(screen.getAllByTestId('diff-line-add').length).toBeGreaterThan(0)
})

it('disables undo when there is nothing to undo', () => {
  seedChanges(changes(), { currentTurn: 0, turns: [] })
  render(<ChangePanel />)
  expect(screen.getByTestId('undo-button')).toBeDisabled()
})

it('confirms with round, target turn and file count before undo', async () => {
  seedChanges(changes())
  render(<ChangePanel />)
  await userEvent.click(screen.getByTestId('undo-button'))
  const dialog = await screen.findByTestId('undo-dialog')
  expect(dialog).toHaveTextContent('回退到轮次')
  expect(dialog).toHaveTextContent('涉及')
  expect(dialog).toHaveTextContent('2 个文件')
})

it('lists per-file failures after a failed undo', async () => {
  seedChanges(changes(), {
    undo: {
      ok: false,
      appliedSteps: 1,
      failures: [
        { path: 'inbox/organized/docx/2026-01/a.docx', error: '文件被占用' },
        { path: 'inbox/organized/csv/2026-02/b.csv', error: '权限不足' },
      ],
    },
  })
  render(<ChangePanel />)
  await userEvent.click(screen.getByTestId('undo-button'))
  await userEvent.click(await screen.findByRole('button', { name: '确认撤销' }))
  const failures = await screen.findByTestId('undo-failure-list')
  expect(failures.querySelectorAll('li')).toHaveLength(2)
})

it('explains a pruned redo instead of silently failing', async () => {
  seedChanges(changes(), { redo: { ok: false, appliedSteps: 0, code: 'PRUNED' } })
  render(<ChangePanel />)
  await userEvent.click(screen.getByTestId('redo-button'))
  expect(await screen.findByTestId('undo-pruned')).toHaveTextContent('无法重做')
})

it('shows an explicit message when changes are null', () => {
  seedChanges(null)
  render(<ChangePanel />)
  expect(screen.getByTestId('changes-empty')).toHaveTextContent('该运行未记录变更')
})
