import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateAccountInput,
  CreateBudgetInput,
  CreateTaskInput,
  CreateTransactionInput,
  DailyTodoApi,
  TaskPatch
} from '../shared/types'

const api: DailyTodoApi = {
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    create: (input: CreateTaskInput) => ipcRenderer.invoke('tasks:create', input),
    update: (id: number, patch: TaskPatch) => ipcRenderer.invoke('tasks:update', id, patch),
    toggle: (id: number, completed: boolean) => ipcRenderer.invoke('tasks:toggle', id, completed),
    delete: (id: number) => ipcRenderer.invoke('tasks:delete', id)
  },
  finance: {
    listAccounts: () => ipcRenderer.invoke('finance:accounts:list'),
    createAccount: (input: CreateAccountInput) =>
      ipcRenderer.invoke('finance:accounts:create', input),
    deleteAccount: (id: number) => ipcRenderer.invoke('finance:accounts:delete', id),
    listTransactions: (month?: string) => ipcRenderer.invoke('finance:transactions:list', month),
    createTransaction: (input: CreateTransactionInput) =>
      ipcRenderer.invoke('finance:transactions:create', input),
    deleteTransaction: (id: number) => ipcRenderer.invoke('finance:transactions:delete', id),
    listBudgets: () => ipcRenderer.invoke('finance:budgets:list'),
    upsertBudget: (input: CreateBudgetInput) => ipcRenderer.invoke('finance:budgets:upsert', input),
    deleteBudget: (id: number) => ipcRenderer.invoke('finance:budgets:delete', id),
    getMonthlySummary: (month?: string) => ipcRenderer.invoke('finance:summary', month),
    getRecentTrend: (monthsBack?: number) => ipcRenderer.invoke('finance:trend', monthsBack)
  },
  calendar: {
    getGoogleAuthStatus: () => ipcRenderer.invoke('calendar:google:status'),
    setGoogleClientConfig: (clientId: string, clientSecret: string) =>
      ipcRenderer.invoke('calendar:google:setConfig', clientId, clientSecret),
    connectGoogle: () => ipcRenderer.invoke('calendar:google:connect'),
    disconnectGoogle: () => ipcRenderer.invoke('calendar:google:disconnect'),
    syncGoogle: () => ipcRenderer.invoke('calendar:google:sync'),
    listEvents: (fromIso: string, toIso: string) =>
      ipcRenderer.invoke('calendar:events:list', fromIso, toIso),
    hideEvent: (id: number) => ipcRenderer.invoke('calendar:events:hide', id),
    listSources: () => ipcRenderer.invoke('calendar:sources:list'),
    addSource: (calendarId: string, label: string) =>
      ipcRenderer.invoke('calendar:sources:add', calendarId, label),
    removeSource: (id: number) => ipcRenderer.invoke('calendar:sources:remove', id)
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    run: (commandId: string) => ipcRenderer.invoke('plugins:run', commandId)
  },
  notifications: {
    test: () => ipcRenderer.invoke('notifications:test')
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close')
  }
}

contextBridge.exposeInMainWorld('api', api)
