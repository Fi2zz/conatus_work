import { create } from 'zustand'

export type RightTab = 'artifacts' | 'changes' | 'checkpoints' | 'files'
export type TimelineFilter = 'key' | 'all' | 'failed'
export type TaskStatusFilter = 'all' | 'running' | 'failed'
export type TaskTimeFilter = 'all' | 'today' | 'week' | 'month'
export type TaskGrouping = 'date' | 'workspace'
export type AppModule = 'work' | 'experts' | 'skills' | 'connectors' | 'automation' | 'data'

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
  module: AppModule
  filter: TimelineFilter
  leftCollapsed: boolean
  taskQuery: string
  taskStatus: TaskStatusFilter
  taskTime: TaskTimeFilter
  pinnedTaskIds: string[]
  taskTitles: Record<string, string>
  archivedTaskIds: string[]
  batchMode: boolean
  selectedTaskIds: string[]
  archiveView: boolean
  taskGrouping: TaskGrouping
  expandedKeys: Set<string>
  rightTab: RightTab
  rightWidth: number
  rightExpanded: boolean
  selectedArtifact: string | null
  artifactTabs: string[]
  undoDialog: boolean
  composerDraft: string
  commandOpen: boolean
  settingsOpen: boolean
  newTaskOpen: boolean
  compareOpen: boolean
  usageOpen: boolean
  shortcutsOpen: boolean
  stoppingRunId: string | null
  undoNotice: { runId: string; targetTurn: number; steps: number } | null
  setFilter: (filter: TimelineFilter) => void
  setModule: (module: AppModule) => void
  toggleLeft: () => void
  setTaskQuery: (query: string) => void
  setTaskStatus: (status: TaskStatusFilter) => void
  setTaskTime: (time: TaskTimeFilter) => void
  togglePinnedTask: (runId: string) => void
  setTaskTitle: (runId: string, title: string) => void
  archiveTask: (runId: string) => void
  restoreTask: (runId: string) => void
  setBatchMode: (on: boolean) => void
  toggleTaskSelected: (runId: string) => void
  clearTaskSelection: () => void
  setArchiveView: (on: boolean) => void
  setTaskGrouping: (grouping: TaskGrouping) => void
  toggleExpanded: (key: string) => void
  setRightTab: (tab: RightTab) => void
  setRightWidth: (width: number) => void
  setRightExpanded: (expanded: boolean) => void
  setSelectedArtifact: (path: string | null) => void
  openArtifact: (path: string) => void
  closeArtifact: (path: string) => void
  setUndoDialog: (open: boolean) => void
  setComposerDraft: (text: string) => void
  setCommandOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setNewTaskOpen: (open: boolean) => void
  setCompareOpen: (open: boolean) => void
  setUsageOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  setStoppingRun: (runId: string | null) => void
  setUndoNotice: (notice: { runId: string; targetTurn: number; steps: number } | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  module: 'work',
  filter: 'key',
  leftCollapsed: false,
  taskQuery: '',
  taskStatus: 'all',
  taskTime: 'all',
  pinnedTaskIds: readPinned(),
  taskTitles: {},
  archivedTaskIds: [],
  batchMode: false,
  selectedTaskIds: [],
  archiveView: false,
  taskGrouping: 'date',
  expandedKeys: new Set<string>(),
  rightTab: 'artifacts',
  rightWidth: 380,
  rightExpanded: false,
  selectedArtifact: null,
  artifactTabs: [],
  undoDialog: false,
  composerDraft: '',
  commandOpen: false,
  settingsOpen: false,
  newTaskOpen: false,
  compareOpen: false,
  usageOpen: false,
  shortcutsOpen: false,
  stoppingRunId: null,
  undoNotice: null,
  setFilter: (filter) => set({ filter }),
  setModule: (module) => set({ module }),
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
  setTaskTitle: (runId, title) =>
    set((state) => ({ taskTitles: { ...state.taskTitles, [runId]: title } })),
  archiveTask: (runId) =>
    set((state) => ({
      archivedTaskIds: state.archivedTaskIds.includes(runId)
        ? state.archivedTaskIds
        : [...state.archivedTaskIds, runId],
    })),
  restoreTask: (runId) =>
    set((state) => ({ archivedTaskIds: state.archivedTaskIds.filter((id) => id !== runId) })),
  setBatchMode: (batchMode) => set({ batchMode, selectedTaskIds: [] }),
  toggleTaskSelected: (runId) =>
    set((state) => ({
      selectedTaskIds: state.selectedTaskIds.includes(runId)
        ? state.selectedTaskIds.filter((id) => id !== runId)
        : [...state.selectedTaskIds, runId],
    })),
  clearTaskSelection: () => set({ selectedTaskIds: [] }),
  setArchiveView: (archiveView) => set({ archiveView }),
  setTaskGrouping: (taskGrouping) => set({ taskGrouping }),
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
  openArtifact: (path) =>
    set((state) => ({
      selectedArtifact: path,
      artifactTabs: state.artifactTabs.includes(path) ? state.artifactTabs : [...state.artifactTabs, path],
    })),
  closeArtifact: (path) =>
    set((state) => {
      const artifactTabs = state.artifactTabs.filter((item) => item !== path)
      const selectedArtifact =
        state.selectedArtifact === path ? (artifactTabs[artifactTabs.length - 1] ?? null) : state.selectedArtifact
      return { artifactTabs, selectedArtifact }
    }),
  setUndoDialog: (undoDialog) => set({ undoDialog }),
  setComposerDraft: (composerDraft) => set({ composerDraft }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setNewTaskOpen: (newTaskOpen) => set({ newTaskOpen }),
  setCompareOpen: (compareOpen) => set({ compareOpen }),
  setUsageOpen: (usageOpen) => set({ usageOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setStoppingRun: (stoppingRunId) => set({ stoppingRunId }),
  setUndoNotice: (undoNotice) => set({ undoNotice }),
}))
