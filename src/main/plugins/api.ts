import { BrowserWindow, ipcMain, Notification } from 'electron'
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
  /**
   * Methods the panel's page can call back into the plugin's main-process
   * code with, via `window.plugin.invoke(name, ...args)` — the panel itself
   * has no Node/IPC access (sandboxed, no nodeIntegration), so anything that
   * needs real filesystem/dialog/etc. access has to go through this bridge.
   */
  methods?: Record<string, (...args: unknown[]) => unknown>
}

// One ipcMain.handle registration shared by every panel that asks for a
// `methods` bridge, routed by the calling webContents id so each panel only
// ever reaches the methods its own plugin exposed.
const panelMethodsByWebContentsId = new Map<number, Record<string, (...args: unknown[]) => unknown>>()
let panelBridgeRegistered = false

function ensurePanelBridge(): void {
  if (panelBridgeRegistered) return
  panelBridgeRegistered = true
  ipcMain.handle('plugin-panel:invoke', async (event, method: string, ...args: unknown[]) => {
    const methods = panelMethodsByWebContentsId.get(event.sender.id)
    const fn = methods?.[method]
    if (typeof fn !== 'function') throw new Error(`Unknown plugin panel method: ${method}`)
    return fn(...args)
  })
}

export interface PluginApi {
  registerCommand(id: string, label: string, handler: () => void): void
  showNotification(text: string): void
  /** Pass a bundled HTML file relative to the plugin's own folder, or a full http(s) URL. */
  openPanel(htmlRelativePathOrUrl: string, options?: PanelOptions): BrowserWindow
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
    openPanel(htmlRelativePathOrUrl, options = {}) {
      const hasMethods = Boolean(options.methods && Object.keys(options.methods).length > 0)
      const panel = new BrowserWindow({
        width: options.width ?? 320,
        height: options.height ?? 400,
        title: options.title ?? pluginId,
        alwaysOnTop: options.alwaysOnTop ?? false,
        autoHideMenuBar: true,
        webPreferences: {
          sandbox: true,
          ...(hasMethods
            ? { preload: join(__dirname, '../../resources/plugin-panel-preload.cjs') }
            : {})
        }
      })
      if (hasMethods) {
        ensurePanelBridge()
        // Capture the id up front — by the time 'closed' fires, the window
        // (and its .webContents getter) is already destroyed, so reading
        // panel.webContents.id inside the handler throws "Object has been
        // destroyed".
        const webContentsId = panel.webContents.id
        panelMethodsByWebContentsId.set(webContentsId, options.methods!)
        panel.on('closed', () => panelMethodsByWebContentsId.delete(webContentsId))
      }
      if (/^https?:\/\//.test(htmlRelativePathOrUrl)) {
        panel.loadURL(htmlRelativePathOrUrl)
      } else {
        panel.loadFile(join(pluginDir, htmlRelativePathOrUrl))
      }
      return panel
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
