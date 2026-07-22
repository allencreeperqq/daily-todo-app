import { safeStorage } from 'electron'
import { getDb } from './db'

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

// Secrets are encrypted at rest via Electron's safeStorage (OS keychain/DPAPI-backed)
// so OAuth client secrets and tokens don't sit as plaintext in the SQLite file.
export function setSecret(key: string, value: string | null): void {
  if (value === null) {
    setSetting(key, null)
    setSetting(`${key}:enc`, null)
    return
  }
  if (safeStorage.isEncryptionAvailable()) {
    setSetting(key, safeStorage.encryptString(value).toString('base64'))
    setSetting(`${key}:enc`, '1')
  } else {
    setSetting(key, value)
    setSetting(`${key}:enc`, '0')
  }
}

export function getSecret(key: string): string | null {
  const raw = getSetting(key)
  if (raw === null) return null
  if (getSetting(`${key}:enc`) !== '1') return raw
  try {
    return safeStorage.decryptString(Buffer.from(raw, 'base64'))
  } catch {
    return null
  }
}

export function getJsonSecret<T>(key: string): T | null {
  const raw = getSecret(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setJsonSecret(key: string, value: unknown): void {
  setSecret(key, JSON.stringify(value))
}
