import { create } from 'zustand'

export type RightTab = 'artifacts' | 'changes' | 'checkpoints'
export type TimelineFilter = 'key' | 'all'

interface UiState {
  filter: TimelineFilter
  expandedKeys: Set<string>
  rightTab: RightTab
  rightWidth: number
  undoDialog: boolean
  composerDraft: string
  commandOpen: boolean
  setFilter: (filter: TimelineFilter) => void
  toggleExpanded: (key: string) => void
  setRightTab: (tab: RightTab) => void
  setRightWidth: (width: number) => void
  setUndoDialog: (open: boolean) => void
  setComposerDraft: (text: string) => void
  setCommandOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  filter: 'key',
  expandedKeys: new Set<string>(),
  rightTab: 'artifacts',
  rightWidth: 380,
  undoDialog: false,
  composerDraft: '',
  commandOpen: false,
  setFilter: (filter) => set({ filter }),
  toggleExpanded: (key) =>
    set((state) => {
      const expandedKeys = new Set(state.expandedKeys)
      if (expandedKeys.has(key)) expandedKeys.delete(key)
      else expandedKeys.add(key)
      return { expandedKeys }
    }),
  setRightTab: (rightTab) => set({ rightTab }),
  setRightWidth: (rightWidth) => set({ rightWidth }),
  setUndoDialog: (undoDialog) => set({ undoDialog }),
  setComposerDraft: (composerDraft) => set({ composerDraft }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}))
