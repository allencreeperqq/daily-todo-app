import { contextBridge, ipcRenderer } from 'electron'
import type { CreateTaskInput, DailyTodoApi, TaskPatch } from '../shared/types'

const api: DailyTodoApi = {
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    create: (input: CreateTaskInput) => ipcRenderer.invoke('tasks:create', input),
    update: (id: number, patch: TaskPatch) => ipcRenderer.invoke('tasks:update', id, patch),
    toggle: (id: number, completed: boolean) => ipcRenderer.invoke('tasks:toggle', id, completed),
    delete: (id: number) => ipcRenderer.invoke('tasks:delete', id)
  }
}

contextBridge.exposeInMainWorld('api', api)
