import { create } from 'zustand'

import type { BridgeEvent } from '@/bridge/events'
import type { RunStatus, RunView, WorkbenchState } from '@/bridge/types'
import { applyEvent } from './apply-event'
import { sortOrder } from './event-helpers'
import { initialWorkbenchState } from './workbench-state'

type WorkbenchStore = WorkbenchState & {
  apply: (event: BridgeEvent) => void
  setActive: (runId: string) => void
  setStatus: (runId: string, status: RunStatus) => void
  finishRun: (runId: string, status: RunStatus) => void
  adoptRun: (run: RunView) => void
  reset: () => void
}

export const useWorkbenchStore = create<WorkbenchStore>((set) => ({
  ...initialWorkbenchState,
  apply: (event) => set((store) => applyEvent(store, event)),
  setActive: (runId) => set({ activeRunId: runId }),
  setStatus: (runId, status) =>
    set((store) => {
      const run = store.runs[runId]
      if (!run) return store
      return { runs: { ...store.runs, [runId]: { ...run, status } } }
    }),
  finishRun: (runId, status) =>
    set((store) => {
      const run = store.runs[runId]
      if (!run) return store
      return {
        runs: {
          ...store.runs,
          [runId]: { ...run, status, endedAt: run.endedAt ?? new Date().toISOString() },
        },
      }
    }),
  adoptRun: (run) =>
    set((store) => {
      const runs = { ...store.runs, [run.id]: run }
      return { runs, order: sortOrder(runs), activeRunId: run.id }
    }),
  reset: () => set({ ...initialWorkbenchState }),
}))

export function useWorkbench<T>(selector: (state: WorkbenchState) => T): T {
  return useWorkbenchStore(selector)
}
