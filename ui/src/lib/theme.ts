export type Theme = 'auto' | 'light' | 'dark'

const KEY = 'conatus.theme'

export function readTheme(): Theme {
  const value = globalThis.localStorage?.getItem(KEY)
  return value === 'light' || value === 'dark' ? value : 'auto'
}

export function applyTheme(theme: Theme): void {
  if (theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

export function persistTheme(theme: Theme): void {
  globalThis.localStorage?.setItem(KEY, theme)
  applyTheme(theme)
}
