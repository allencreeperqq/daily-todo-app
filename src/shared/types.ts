export interface Task {
  id: number
  title: string
  notes: string | null
  due_at: string | null
  priority: number
  category: string | null
  recurrence_rule: string | null
  completed_at: string | null
  source: string
  remote_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  title: string
  notes?: string | null
  due_at?: string | null
  priority?: number
  category?: string | null
}

export type TaskPatch = Partial<CreateTaskInput>

export interface DailyTodoApi {
  tasks: {
    list(): Promise<Task[]>
    create(input: CreateTaskInput): Promise<Task>
    update(id: number, patch: TaskPatch): Promise<Task | undefined>
    toggle(id: number, completed: boolean): Promise<Task | undefined>
    delete(id: number): Promise<void>
  }
}
