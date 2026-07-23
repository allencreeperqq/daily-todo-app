import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import { createPluginApi, type PluginCommand } from './api'

interface PluginManifest {
  id: string
  name: string
  version: string
  main: string
  description?: string
}

export interface LoadedPlugin {
  id: string
  name: string
  version: string
  description: string
}

export interface LoadPluginsResult {
  plugins: LoadedPlugin[]
  commands: PluginCommand[]
}

export async function loadPlugins(): Promise<LoadPluginsResult> {
  const pluginsDir = join(app.getAppPath(), 'plugins')
  const plugins: LoadedPlugin[] = []
  const commands: PluginCommand[] = []

  if (!existsSync(pluginsDir)) return { plugins, commands }

  for (const entry of readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const pluginDir = join(pluginsDir, entry.name)
    const manifestPath = join(pluginDir, 'manifest.json')
    if (!existsSync(manifestPath)) continue

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as PluginManifest
      const entryPath = join(pluginDir, manifest.main)
      const mod = await import(pathToFileURL(entryPath).href)
      const onload = mod.onload ?? mod.default?.onload

      if (typeof onload !== 'function') {
        console.warn(`[plugins] ${manifest.id} has no onload() export, skipping`)
        continue
      }

      const api = createPluginApi(manifest.id, pluginDir, commands)
      await onload(api)

      plugins.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description ?? ''
      })
      console.log(`[plugins] loaded ${manifest.id} v${manifest.version}`)
    } catch (err) {
      console.error(`[plugins] failed to load plugin at ${entry.name}`, err)
    }
  }

  return { plugins, commands }
}
