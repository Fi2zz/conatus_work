import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import { createReplayTransport } from '@/bridge/replay-transport'
import { createWebViewTransport } from '@/bridge/webview-transport'
import type { BridgeTransport } from '@/bridge/transport'
import { findFixture } from '@/fixtures'

import { readFixtureParam } from './fixture-param'
import { ErrorBoundary } from './error-boundary'
import { AppProvider } from './provider'
import { Shell } from './Shell'

function hasNativeChannel(): boolean {
  const host = (window as unknown as { conatus?: { postMessage?: unknown } }).conatus
  return typeof host?.postMessage === 'function'
}

interface AppProps {
  transport?: BridgeTransport
}

export default function App({ transport }: AppProps = {}): JSX.Element {
  const [resolved, setResolved] = useState<BridgeTransport | null>(transport ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (transport) return
    // 原生壳里存在 JavaScriptChannel，直接走宿主；否则按 URL 参数回放 fixture。
    if (hasNativeChannel()) {
      setResolved(createWebViewTransport())
      return
    }
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
    return (
      <div data-testid="boot-status" className="p-6 text-[12px] text-ink-muted">
        {hasNativeChannel() ? '正在连接宿主…' : '正在加载回放数据…'}
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <AppProvider transport={resolved}>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  )
}
