import { getDb } from './db'
import type { CreateTaskInput, Task, TaskPatch } from '../shared/types'

export function listTasks(): Task[] {
  return getDb()
    .prepare(
      `SELECT * FROM tasks
       ORDER BY (completed_at IS NOT NULL) ASC, (due_at IS NULL) ASC, due_at ASC, priority ASC`
    )
    .all() as unknown as Task[]
}

export function getTask(id: number): Task | undefined {
  return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as unknown as
    | Task
    | undefined
}

export function createTask(input: CreateTaskInput): Task {
  const result = getDb()
    .prepare(
      `INSERT INTO tasks (title, notes, due_at, priority, category)
       VALUES (@title, @notes, @due_at, @priority, @category)`
    )
    .run({
      title: input.title,
      notes: input.notes ?? null,
      due_at: input.due_at ?? null,
      priority: input.priority ?? 2,
      category: input.category ?? null
    })
  return getTask(result.lastInsertRowid as number)!
}

export function updateTask(id: number, patch: TaskPatch): Task | undefined {
  const current = getTask(id)
  if (!current) return undefined

  getDb()
    .prepare(
      `UPDATE tasks
       SET title = @title, notes = @notes, due_at = @due_at,
           priority = @priority, category = @category, updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({
      id,
      title: patch.title ?? current.title,
      notes: patch.notes === undefined ? current.notes : patch.notes,
      due_at: patch.due_at === undefined ? current.due_at : patch.due_at,
      priority: patch.priority ?? current.priority,
      category: patch.category === undefined ? current.category : patch.category
    })
  return getTask(id)
}

export function toggleTaskComplete(id: number, completed: boolean): Task | undefined {
  getDb()
    .prepare(`UPDATE tasks SET completed_at = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(completed ? new Date().toISOString() : null, id)
  return getTask(id)
}

export function deleteTask(id: number): void {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
}
