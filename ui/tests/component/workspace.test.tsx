import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { WorkspacePanel } from '@/features/workspace/WorkspacePanel'
import { useUiStore } from '@/state/ui-state'

import { artifact, seedArtifacts } from '../helpers/artifacts'
import { changes, seedChanges } from '../helpers/changes'

it('opens an artifact in the artifact tab', async () => {
  seedArtifacts([artifact('out/changes.md')], { 'out/changes.md': '# 清单' })
  useUiStore.setState({ rightTab: 'files', selectedArtifact: null })
  render(<WorkspacePanel />)
  expect(screen.getByTestId('workspace-tree')).toHaveTextContent('out')
  await userEvent.click(screen.getByText('changes.md'))
  expect(useUiStore.getState().rightTab).toBe('artifacts')
  expect(useUiStore.getState().selectedArtifact).toBe('out/changes.md')
})

it('previews a workspace file that is not an artifact', async () => {
  seedChanges(changes())
  useUiStore.setState({ rightTab: 'files' })
  render(<WorkspacePanel />)
  await userEvent.click(screen.getAllByText('a.docx')[1])
  expect(screen.getByTestId('workspace-preview')).toHaveTextContent('inbox/a.docx')
})
