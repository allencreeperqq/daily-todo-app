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
    listTransactions: (month?: string) => ipcRenderer.invoke('finance:transactions:list', month),
    createTransaction: (input: CreateTransactionInput) =>
      ipcRenderer.invoke('finance:transactions:create', input),
    deleteTransaction: (id: number) => ipcRenderer.invoke('finance:transactions:delete', id),
    listBudgets: () => ipcRenderer.invoke('finance:budgets:list'),
    upsertBudget: (input: CreateBudgetInput) => ipcRenderer.invoke('finance:budgets:upsert', input),
    deleteBudget: (id: number) => ipcRenderer.invoke('finance:budgets:delete', id),
    getMonthlySummary: (month?: string) => ipcRenderer.invoke('finance:summary', month)
  }
}

contextBridge.exposeInMainWorld('api', api)
