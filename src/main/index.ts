import { BrowserWindow, app, ipcMain } from 'electron'
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
  listAccounts,
  listBudgets,
  listTransactions,
  upsertBudget
} from './finance'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    show: false,
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

  ipcMain.handle('finance:accounts:list', () => listAccounts())
  ipcMain.handle('finance:accounts:create', (_event, input) => createAccount(input))
  ipcMain.handle('finance:transactions:list', (_event, month) => listTransactions(month))
  ipcMain.handle('finance:transactions:create', (_event, input) => createTransaction(input))
  ipcMain.handle('finance:transactions:delete', (_event, id) => deleteTransaction(id))
  ipcMain.handle('finance:budgets:list', () => listBudgets())
  ipcMain.handle('finance:budgets:upsert', (_event, input) => upsertBudget(input))
  ipcMain.handle('finance:budgets:delete', (_event, id) => deleteBudget(id))
  ipcMain.handle('finance:summary', (_event, month) => getMonthlySummary(month))
}

app.whenReady().then(() => {
  getDb()
  registerIpcHandlers()
  createWindow()
  createTray(
    () => mainWindow?.show(),
    () => {
      isQuitting = true
      app.quit()
    }
  )
  startScheduler()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
})

app.on('quit', () => {
  closeDb()
})
