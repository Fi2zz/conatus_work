export const DEFAULT_WORKSPACE_KEY = 'conatus.defaultWorkspace'
export const RESTORE_LAST_KEY = 'conatus.restoreLastTask'
const RECENT_KEY = 'conatus.recentWorkspaces'
const RECENT_LIMIT = 5

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

export function readRecentWorkspaces(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function rememberWorkspace(path: string): void {
  const next = [path, ...readRecentWorkspaces().filter((item) => item !== path)].slice(0, RECENT_LIMIT)
  globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(next))
}
