import { BrowserWindow, app, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { closeDb, getDb } from './db'
import { createTray } from './tray'
import { startScheduler } from './scheduler'
import { createTask, deleteTask, listTasks, toggleTaskComplete, updateTask } from './tasks'
import {
  createAccount,
  createTransaction,
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
import { listEvents, syncGoogleCalendar } from './googleCalendar'
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
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic', // Windows 11 native frosted-glass backdrop; no-op elsewhere
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

  ipcMain.handle('finance:accounts:list', () => listAccounts())
  ipcMain.handle('finance:accounts:create', (_event, input) => createAccount(input))
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
}

app.whenReady().then(async () => {
  getDb()
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
  closeAllToasts()
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
})

app.on('quit', () => {
  closeDb()
})
