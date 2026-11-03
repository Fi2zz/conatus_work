import { create } from 'zustand'

export type RightTab = 'artifacts' | 'changes' | 'checkpoints'
export type TimelineFilter = 'key' | 'all' | 'failed'
export type TaskStatusFilter = 'all' | 'running' | 'failed'

interface UiState {
  filter: TimelineFilter
  leftCollapsed: boolean
  taskQuery: string
  taskStatus: TaskStatusFilter
  expandedKeys: Set<string>
  rightTab: RightTab
  rightWidth: number
  selectedArtifact: string | null
  undoDialog: boolean
  composerDraft: string
  commandOpen: boolean
  settingsOpen: boolean
  newTaskOpen: boolean
  compareOpen: boolean
  undoNotice: { runId: string; targetTurn: number; steps: number } | null
  setFilter: (filter: TimelineFilter) => void
  toggleLeft: () => void
  setTaskQuery: (query: string) => void
  setTaskStatus: (status: TaskStatusFilter) => void
  toggleExpanded: (key: string) => void
  setRightTab: (tab: RightTab) => void
  setRightWidth: (width: number) => void
  setSelectedArtifact: (path: string | null) => void
  setUndoDialog: (open: boolean) => void
  setComposerDraft: (text: string) => void
  setCommandOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setNewTaskOpen: (open: boolean) => void
  setCompareOpen: (open: boolean) => void
  setUndoNotice: (notice: { runId: string; targetTurn: number; steps: number } | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  filter: 'key',
  leftCollapsed: false,
  taskQuery: '',
  taskStatus: 'all',
  expandedKeys: new Set<string>(),
  rightTab: 'artifacts',
  rightWidth: 380,
  selectedArtifact: null,
  undoDialog: false,
  composerDraft: '',
  commandOpen: false,
  settingsOpen: false,
  newTaskOpen: false,
  compareOpen: false,
  undoNotice: null,
  setFilter: (filter) => set({ filter }),
  toggleLeft: () => set((state) => ({ leftCollapsed: !state.leftCollapsed })),
  setTaskQuery: (taskQuery) => set({ taskQuery }),
  setTaskStatus: (taskStatus) => set({ taskStatus }),
  toggleExpanded: (key) =>
    set((state) => {
      const expandedKeys = new Set(state.expandedKeys)
      if (expandedKeys.has(key)) expandedKeys.delete(key)
      else expandedKeys.add(key)
      return { expandedKeys }
    }),
  setRightTab: (rightTab) => set({ rightTab }),
  setRightWidth: (rightWidth) => set({ rightWidth }),
  setSelectedArtifact: (selectedArtifact) => set({ selectedArtifact }),
  setUndoDialog: (undoDialog) => set({ undoDialog }),
  setComposerDraft: (composerDraft) => set({ composerDraft }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setNewTaskOpen: (newTaskOpen) => set({ newTaskOpen }),
  setCompareOpen: (compareOpen) => set({ compareOpen }),
  setUndoNotice: (undoNotice) => set({ undoNotice }),
}))
