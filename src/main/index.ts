import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { closeDb, getDb } from './db'
import { createTray } from './tray'
import { startScheduler } from './scheduler'
import { createTask, deleteTask, listTasks, toggleTaskComplete, updateTask } from './tasks'
import { createNote, deleteNote, listNotes, updateNote } from './notes'
import {
  createAccount,
  createTransaction,
  deleteAccount,
  deleteBudget,
  deleteTransaction,
  getMonthlySummary,
  getRecentMonthlySummaries,
  listAccounts,
  listBudgets,
  listTransactions,
  upsertBudget
} from './finance'
import {
  connectGoogleAccount,
  disconnectGoogleAccount,
  isGoogleConfigured,
  isGoogleConnected,
  setGoogleClientConfig
} from './googleAuth'
import {
  addCalendarSource,
  hideEvent,
  listCalendarSources,
  listEvents,
  removeCalendarSource,
  syncGoogleCalendar
} from './googleCalendar'
import { getGeneralSettings, updateGeneralSettings } from './settings'
import { loadPlugins, type LoadedPlugin } from './plugins/loader'
import type { PluginCommand } from './plugins/api'
import { closeAllToasts, showToast } from './toast'

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let loadedPlugins: LoadedPlugin[] = []
let pluginCommands: PluginCommand[] = []

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    show: false,
    frame: false,
    // backgroundMaterial: 'acrylic' does not render on this machine regardless of the
    // transparent:true setting (confirmed: the toast window, which uses plain
    // transparent:true with no backgroundMaterial, renders transparent correctly; this
    // window with backgroundMaterial did not, with or without transparent:true). Falling
    // back to the same mechanism that's proven to work here: plain window transparency.
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners: true,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    mainWindow?.hide()
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('tasks:list', () => listTasks())
  ipcMain.handle('tasks:create', (_event, input) => createTask(input))
  ipcMain.handle('tasks:update', (_event, id, patch) => updateTask(id, patch))
  ipcMain.handle('tasks:toggle', (_event, id, completed) => toggleTaskComplete(id, completed))
  ipcMain.handle('tasks:delete', (_event, id) => deleteTask(id))

  ipcMain.handle('notes:list', () => listNotes())
  ipcMain.handle('notes:create', (_event, input) => createNote(input))
  ipcMain.handle('notes:update', (_event, id, patch) => updateNote(id, patch))
  ipcMain.handle('notes:delete', (_event, id) => deleteNote(id))

  ipcMain.handle('finance:accounts:list', () => listAccounts())
  ipcMain.handle('finance:accounts:create', (_event, input) => createAccount(input))
  ipcMain.handle('finance:accounts:delete', (_event, id) => deleteAccount(id))
  ipcMain.handle('finance:transactions:list', (_event, month) => listTransactions(month))
  ipcMain.handle('finance:transactions:create', (_event, input) => createTransaction(input))
  ipcMain.handle('finance:transactions:delete', (_event, id) => deleteTransaction(id))
  ipcMain.handle('finance:budgets:list', () => listBudgets())
  ipcMain.handle('finance:budgets:upsert', (_event, input) => upsertBudget(input))
  ipcMain.handle('finance:budgets:delete', (_event, id) => deleteBudget(id))
  ipcMain.handle('finance:summary', (_event, month) => getMonthlySummary(month))
  ipcMain.handle('finance:trend', (_event, monthsBack) => getRecentMonthlySummaries(monthsBack))

  ipcMain.handle('calendar:google:status', () => ({
    configured: isGoogleConfigured(),
    connected: isGoogleConnected()
  }))
  ipcMain.handle('calendar:google:setConfig', (_event, clientId, clientSecret) =>
    setGoogleClientConfig(clientId, clientSecret)
  )
  ipcMain.handle('calendar:google:connect', () => connectGoogleAccount())
  ipcMain.handle('calendar:google:disconnect', () => disconnectGoogleAccount())
  ipcMain.handle('calendar:google:sync', () => syncGoogleCalendar())
  ipcMain.handle('calendar:events:list', (_event, from, to) => listEvents(from, to))
  ipcMain.handle('calendar:events:hide', (_event, id) => hideEvent(id))
  ipcMain.handle('calendar:sources:list', () => listCalendarSources())
  ipcMain.handle('calendar:sources:add', (_event, calendarId, label) =>
    addCalendarSource(calendarId, label)
  )
  ipcMain.handle('calendar:sources:remove', (_event, id) => removeCalendarSource(id))

  ipcMain.handle('shell:openExternal', (_event, url) => shell.openExternal(url))

  ipcMain.handle('plugins:list', () => ({
    plugins: loadedPlugins,
    commands: pluginCommands.map(({ id, pluginId, label }) => ({ id, pluginId, label }))
  }))
  ipcMain.handle('plugins:run', (_event, commandId) => {
    pluginCommands.find((cmd) => cmd.id === commandId)?.handler()
  })

  ipcMain.handle('notifications:test', () => {
    showToast('測試通知', '這是一則測試提醒,確認通知看得到、夠明顯。')
  })

  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:close', () => mainWindow?.close())

  ipcMain.handle('settings:general:get', () => getGeneralSettings())
  ipcMain.handle('settings:general:update', (_event, patch) => {
    const merged = updateGeneralSettings(patch)
    // Only touch the real OS login-item registration when packaged — in dev
    // this would point Windows at the electron.exe dev binary, which isn't
    // a useful "launch daily-todo at login" entry anyway.
    if (patch.openAtLogin !== undefined && app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: patch.openAtLogin })
    }
    return merged
  })
}

// The window "close" handler hides to the tray instead of quitting, so the
// app is meant to have exactly one long-lived resident instance — but
// nothing stopped a second launch (e.g. double-clicking the shortcut while
// it was already resident in the tray) from spawning a whole separate
// process with its own window, tray icon, and reminder scheduler, which is
// how multiple tray icons showed up. requestSingleInstanceLock() makes every
// launch after the first fail to acquire the lock and quit immediately
// instead, handing off to the already-running instance via 'second-instance'.
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    getDb()
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: getGeneralSettings().openAtLogin })
    }
    registerIpcHandlers()
    createWindow()

    const loaded = await loadPlugins()
    loadedPlugins = loaded.plugins
    pluginCommands = loaded.commands

    createTray(
      () => mainWindow?.show(),
      () => {
        isQuitting = true
        app.quit()
      },
      pluginCommands
    )
    startScheduler()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
      else mainWindow?.show()
    })
  })

  app.on('before-quit', () => {
    isQuitting = true
    // A minimized frameless BrowserWindow can stall Electron's close sequence
    // on Windows — restoring it first avoids the hang.
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    closeAllToasts()
  })

  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') return
  })

  app.on('quit', () => {
    closeDb()
  })
}
