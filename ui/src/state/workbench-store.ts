import { create } from 'zustand'

import type { BridgeEvent } from '@/bridge/events'
import type { WorkbenchState } from '@/bridge/types'
import { applyEvent } from './apply-event'
import { initialWorkbenchState } from './workbench-state'

type WorkbenchStore = WorkbenchState & {
  apply: (event: BridgeEvent) => void
  setActive: (runId: string) => void
  reset: () => void
}

export const useWorkbenchStore = create<WorkbenchStore>((set) => ({
  ...initialWorkbenchState,
  apply: (event) => set((store) => applyEvent(store, event)),
  setActive: (runId) => set({ activeRunId: runId }),
  reset: () => set({ ...initialWorkbenchState }),
}))

export function useWorkbench<T>(selector: (state: WorkbenchState) => T): T {
  return useWorkbenchStore(selector)
}
