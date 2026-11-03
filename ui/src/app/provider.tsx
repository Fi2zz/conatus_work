import type { JSX } from 'react'
import { useEffect, type ReactNode } from 'react'

import type { BridgeTransport } from '@/bridge/transport'
import { useWorkbenchStore } from '@/state/workbench-store'

interface AppProviderProps {
  transport: BridgeTransport
  children: ReactNode
}

export function AppProvider({ transport, children }: AppProviderProps): JSX.Element {
  useEffect(() => {
    const store = useWorkbenchStore.getState()
    store.reset()
    const unsubscribe = transport.subscribe(useWorkbenchStore.getState().apply)
    void transport.connect()
    return () => {
      unsubscribe()
      transport.disconnect()
    }
  }, [transport])

  return <>{children}</>
}
