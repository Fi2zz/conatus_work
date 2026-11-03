import type { BridgeTransport } from './transport'

let current: BridgeTransport | null = null

export function setTransport(transport: BridgeTransport | null): void {
  current = transport
}

export function hasTransport(): boolean {
  return current !== null
}

export function getTransport(): BridgeTransport {
  if (!current) throw new Error('transport 尚未初始化')
  return current
}
