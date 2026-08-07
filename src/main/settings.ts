import { getDb } from './db'
import type { GeneralSettings } from '../shared/types'

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string | null): void {
  if (value === null) {
    getDb().prepare('DELETE FROM settings WHERE key = ?').run(key)
    return
  }
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (@key, @value)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run({ key, value })
}

export function getJsonSetting<T>(key: string): T | null {
  const raw = getSetting(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setJsonSetting(key: string, value: unknown): void {
  setSetting(key, JSON.stringify(value))
}

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  glassOpacity: 0.58,
  themeMode: 'system',
  openAtLogin: false,
  reminderLeadMinutes: 10,
  morningDigestHour: 8,
  expenseReminderEnabled: true,
  expenseReminderHour: 21
}

export function getGeneralSettings(): GeneralSettings {
  const stored = getJsonSetting<Partial<GeneralSettings>>('general')
  return { ...DEFAULT_GENERAL_SETTINGS, ...stored }
}

export function updateGeneralSettings(patch: Partial<GeneralSettings>): GeneralSettings {
  const merged = { ...getGeneralSettings(), ...patch }
  setJsonSetting('general', merged)
  return merged
}
