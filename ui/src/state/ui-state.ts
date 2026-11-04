import { create } from 'zustand'

export type RightTab = 'artifacts' | 'changes' | 'checkpoints'
export type TimelineFilter = 'key' | 'all' | 'failed'
export type TaskStatusFilter = 'all' | 'running' | 'failed'
export type TaskTimeFilter = 'all' | 'today' | 'week' | 'month'

const PIN_KEY = 'conatus.pinnedTasks'

function readPinned(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(PIN_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writePinned(ids: string[]): void {
  try {
    globalThis.localStorage?.setItem(PIN_KEY, JSON.stringify(ids))
  } catch {
    // 隐私模式或存储被禁用时只保留内存态。
  }
}

interface UiState {
  filter: TimelineFilter
  leftCollapsed: boolean
  taskQuery: string
  taskStatus: TaskStatusFilter
  taskTime: TaskTimeFilter
  pinnedTaskIds: string[]
  expandedKeys: Set<string>
  rightTab: RightTab
  rightWidth: number
  rightExpanded: boolean
  selectedArtifact: string | null
  undoDialog: boolean
  composerDraft: string
  commandOpen: boolean
  settingsOpen: boolean
  newTaskOpen: boolean
  compareOpen: boolean
  stoppingRunId: string | null
  undoNotice: { runId: string; targetTurn: number; steps: number } | null
  setFilter: (filter: TimelineFilter) => void
  toggleLeft: () => void
  setTaskQuery: (query: string) => void
  setTaskStatus: (status: TaskStatusFilter) => void
  setTaskTime: (time: TaskTimeFilter) => void
  togglePinnedTask: (runId: string) => void
  toggleExpanded: (key: string) => void
  setRightTab: (tab: RightTab) => void
  setRightWidth: (width: number) => void
  setRightExpanded: (expanded: boolean) => void
  setSelectedArtifact: (path: string | null) => void
  setUndoDialog: (open: boolean) => void
  setComposerDraft: (text: string) => void
  setCommandOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setNewTaskOpen: (open: boolean) => void
  setCompareOpen: (open: boolean) => void
  setStoppingRun: (runId: string | null) => void
  setUndoNotice: (notice: { runId: string; targetTurn: number; steps: number } | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  filter: 'key',
  leftCollapsed: false,
  taskQuery: '',
  taskStatus: 'all',
  taskTime: 'all',
  pinnedTaskIds: readPinned(),
  expandedKeys: new Set<string>(),
  rightTab: 'artifacts',
  rightWidth: 380,
  rightExpanded: false,
  selectedArtifact: null,
  undoDialog: false,
  composerDraft: '',
  commandOpen: false,
  settingsOpen: false,
  newTaskOpen: false,
  compareOpen: false,
  stoppingRunId: null,
  undoNotice: null,
  setFilter: (filter) => set({ filter }),
  toggleLeft: () => set((state) => ({ leftCollapsed: !state.leftCollapsed })),
  setTaskQuery: (taskQuery) => set({ taskQuery }),
  setTaskStatus: (taskStatus) => set({ taskStatus }),
  setTaskTime: (taskTime) => set({ taskTime }),
  togglePinnedTask: (runId) =>
    set((state) => {
      const pinnedTaskIds = state.pinnedTaskIds.includes(runId)
        ? state.pinnedTaskIds.filter((id) => id !== runId)
        : [...state.pinnedTaskIds, runId]
      writePinned(pinnedTaskIds)
      return { pinnedTaskIds }
    }),
  toggleExpanded: (key) =>
    set((state) => {
      const expandedKeys = new Set(state.expandedKeys)
      if (expandedKeys.has(key)) expandedKeys.delete(key)
      else expandedKeys.add(key)
      return { expandedKeys }
    }),
  setRightTab: (rightTab) => set({ rightTab }),
  setRightWidth: (rightWidth) => set({ rightWidth }),
  setRightExpanded: (rightExpanded) => set({ rightExpanded }),
  setSelectedArtifact: (selectedArtifact) => set({ selectedArtifact }),
  setUndoDialog: (undoDialog) => set({ undoDialog }),
  setComposerDraft: (composerDraft) => set({ composerDraft }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setNewTaskOpen: (newTaskOpen) => set({ newTaskOpen }),
  setCompareOpen: (compareOpen) => set({ compareOpen }),
  setStoppingRun: (stoppingRunId) => set({ stoppingRunId }),
  setUndoNotice: (undoNotice) => set({ undoNotice }),
}))
