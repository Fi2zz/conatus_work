import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import { createReplayTransport } from '@/bridge/replay-transport'
import type { BridgeTransport } from '@/bridge/transport'
import { findFixture } from '@/fixtures'

import { readFixtureParam } from './fixture-param'
import { AppProvider } from './provider'
import { Shell } from './Shell'

interface AppProps {
  transport?: BridgeTransport
}

export default function App({ transport }: AppProps = {}): JSX.Element {
  const [resolved, setResolved] = useState<BridgeTransport | null>(transport ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (transport) return
    const { fixtureId, speed } = readFixtureParam(window.location.search)
    const entry = findFixture(fixtureId)
    if (!entry) {
      setError(fixtureId)
      return
    }
    let cancelled = false
    entry
      .load()
      .then((fixture) => {
        if (!cancelled) setResolved(createReplayTransport(fixture, { speed }))
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(`${fixtureId}（${String(cause)}）`)
      })
    return () => {
      cancelled = true
    }
  }, [transport])

  if (error) {
    return (
      <div data-testid="fixture-error" className="p-6">
        <h1 className="text-[14px] font-semibold">回放数据加载失败</h1>
        <p className="mt-1 text-[12px] text-ink-muted">找不到或无法解析：{error}</p>
      </div>
    )
  }

  if (!resolved) {
    return <div className="p-6 text-[12px] text-ink-muted">正在加载回放数据…</div>
  }

  return (
    <AppProvider transport={resolved}>
      <Shell />
    </AppProvider>
  )
}
