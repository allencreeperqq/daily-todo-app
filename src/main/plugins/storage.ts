import { getDb } from '../db'

export function getPluginStorageValue<T>(pluginId: string, key: string): T | undefined {
  const row = getDb()
    .prepare('SELECT value FROM plugin_storage WHERE plugin_id = ? AND key = ?')
    .get(pluginId, key) as { value: string } | undefined
  if (!row || row.value === null) return undefined
  try {
    return JSON.parse(row.value) as T
  } catch {
    return undefined
  }
}

export function setPluginStorageValue(pluginId: string, key: string, value: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO plugin_storage (plugin_id, key, value) VALUES (@plugin_id, @key, @value)
       ON CONFLICT(plugin_id, key) DO UPDATE SET value = excluded.value`
    )
    .run({ plugin_id: pluginId, key, value: JSON.stringify(value) })
}
