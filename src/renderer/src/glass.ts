/** Shared so App.tsx (on load) and Settings.tsx (live preview while dragging) stay in sync. */
export function applyGlassOpacity(opacity: number): void {
  const clamped = Math.min(0.9, Math.max(0.3, opacity))
  const root = document.documentElement.style
  root.setProperty('--glass-opacity', String(clamped))
  root.setProperty('--glass-surface-opacity', String(Math.min(0.95, clamped + 0.08)))
}
