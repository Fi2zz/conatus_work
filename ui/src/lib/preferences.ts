export const DEFAULT_WORKSPACE_KEY = 'conatus.defaultWorkspace'
export const RESTORE_LAST_KEY = 'conatus.restoreLastTask'

export function readDefaultWorkspace(): string | null {
  return globalThis.localStorage?.getItem(DEFAULT_WORKSPACE_KEY) || null
}

export function saveDefaultWorkspace(path: string | null): void {
  if (path) globalThis.localStorage?.setItem(DEFAULT_WORKSPACE_KEY, path)
  else globalThis.localStorage?.removeItem(DEFAULT_WORKSPACE_KEY)
}

export function readRestoreLast(): boolean {
  return globalThis.localStorage?.getItem(RESTORE_LAST_KEY) === '1'
}

export function saveRestoreLast(on: boolean): void {
  globalThis.localStorage?.setItem(RESTORE_LAST_KEY, on ? '1' : '0')
}
