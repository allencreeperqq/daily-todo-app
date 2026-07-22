import { BrowserWindow, Notification } from 'electron'
import { join } from 'node:path'
import { getPluginStorageValue, setPluginStorageValue } from './storage'

export interface PluginCommand {
  id: string
  pluginId: string
  label: string
  handler: () => void
}

export interface PanelOptions {
  width?: number
  height?: number
  alwaysOnTop?: boolean
  title?: string
}

export interface PluginApi {
  registerCommand(id: string, label: string, handler: () => void): void
  showNotification(text: string): void
  openPanel(htmlRelativePath: string, options?: PanelOptions): void
  storage: {
    get<T>(key: string, defaultValue?: T): T | undefined
    set(key: string, value: unknown): void
  }
}

// Plugins run in the main process with full Node/Electron access — fine for
// personal, self-authored plugins. If plugins are ever shared with others,
// this should move to a sandboxed renderer context instead.
export function createPluginApi(
  pluginId: string,
  pluginDir: string,
  commands: PluginCommand[]
): PluginApi {
  return {
    registerCommand(id, label, handler) {
      commands.push({ id: `${pluginId}:${id}`, pluginId, label, handler })
    },
    showNotification(text) {
      new Notification({ title: pluginId, body: text }).show()
    },
    openPanel(htmlRelativePath, options = {}) {
      const panel = new BrowserWindow({
        width: options.width ?? 320,
        height: options.height ?? 400,
        title: options.title ?? pluginId,
        alwaysOnTop: options.alwaysOnTop ?? false,
        autoHideMenuBar: true,
        webPreferences: { sandbox: true }
      })
      panel.loadFile(join(pluginDir, htmlRelativePath))
    },
    storage: {
      get<T>(key: string, defaultValue?: T) {
        return getPluginStorageValue<T>(pluginId, key) ?? defaultValue
      },
      set(key, value) {
        setPluginStorageValue(pluginId, key, value)
      }
    }
  }
}
