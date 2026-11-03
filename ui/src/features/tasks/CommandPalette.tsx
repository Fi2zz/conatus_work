import type { JSX } from 'react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench, useWorkbenchStore } from '@/state/workbench-store'

export function CommandPalette(): JSX.Element {
  const open = useUiStore((state) => state.commandOpen)
  const setOpen = useUiStore((state) => state.setCommandOpen)
  const order = useWorkbench((state) => state.order)
  const runs = useWorkbench((state) => state.runs)
  const setActive = useWorkbenchStore((store) => store.setActive)

  if (!open) return <></>

  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent labelledBy="command-palette-title">
        <div data-testid="command-palette">
          <DialogTitle id="command-palette-title">切换任务</DialogTitle>
          <ul className="max-h-64 overflow-auto">
            {order.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(id)
                    setOpen(false)
                  }}
                  className="w-full rounded px-2 py-1 text-left text-[12px] hover:bg-panel-muted"
                >
                  {runs[id]?.title ?? id}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
