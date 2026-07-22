import type { DailyTodoApi } from '../shared/types'

declare global {
  interface Window {
    api: DailyTodoApi
  }
}

export {}
