import type { ThemeMode } from '../../shared/types'

const THEME_EVENT = 'daily-todo:theme-changed'

let systemQuery: MediaQueryList | null = null
let systemListener: (() => void) | null = null

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

function apply(mode: ThemeMode): void {
  const resolved = resolve(mode)
  document.documentElement.dataset.theme = resolved
  document.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: resolved }))
}

/** Call whenever the stored theme setting changes (including on initial app load). */
export function applyThemeMode(mode: ThemeMode): void {
  if (systemQuery && systemListener) {
    systemQuery.removeEventListener('change', systemListener)
    systemQuery = null
    systemListener = null
  }
  apply(mode)
  if (mode === 'system') {
    systemQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemListener = () => apply(mode)
    systemQuery.addEventListener('change', systemListener)
  }
}

export function getResolvedTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/** For components (like DonutChart) that need resolved dark/light, not the raw OS preference. */
export function onThemeChange(handler: (theme: 'light' | 'dark') => void): () => void {
  const listener = (e: Event): void => handler((e as CustomEvent<'light' | 'dark'>).detail)
  document.addEventListener(THEME_EVENT, listener)
  return () => document.removeEventListener(THEME_EVENT, listener)
}
