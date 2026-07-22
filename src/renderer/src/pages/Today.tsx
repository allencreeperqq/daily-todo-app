import { useEffect, useState, type FormEvent } from 'react'
import type { Task } from '../../../shared/types'

export default function Today() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh(): Promise<void> {
    const list = await window.api.tasks.list()
    setTasks(list)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleAdd(e: FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    await window.api.tasks.create({
      title: trimmed,
      due_at: dueAt ? new Date(dueAt).toISOString() : null
    })
    setTitle('')
    setDueAt('')
    await refresh()
  }

  async function handleToggle(task: Task): Promise<void> {
    await window.api.tasks.toggle(task.id, !task.completed_at)
    await refresh()
  }

  async function handleDelete(id: number): Promise<void> {
    await window.api.tasks.delete(id)
    await refresh()
  }

  if (loading) return <p className="loading">載入中...</p>

  const pending = tasks.filter((t) => !t.completed_at)
  const done = tasks.filter((t) => t.completed_at)

  return (
    <div className="today-page">
      <h1>今天</h1>

      <form className="add-task-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="新增待辦事項..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          aria-label="到期時間"
        />
        <button type="submit">新增</button>
      </form>

      <section>
        <h2>待辦 ({pending.length})</h2>
        <ul className="task-list">
          {pending.map((task) => (
            <li key={task.id}>
              <label>
                <input type="checkbox" checked={false} onChange={() => handleToggle(task)} />
                <span>{task.title}</span>
              </label>
              {task.due_at && (
                <span className="due">
                  {new Date(task.due_at).toLocaleString('zh-TW', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
              <button className="delete" onClick={() => handleDelete(task.id)} aria-label="刪除">
                刪除
              </button>
            </li>
          ))}
          {pending.length === 0 && <li className="empty">目前沒有待辦事項</li>}
        </ul>
      </section>

      {done.length > 0 && (
        <section>
          <h2>已完成 ({done.length})</h2>
          <ul className="task-list done">
            {done.map((task) => (
              <li key={task.id}>
                <label>
                  <input type="checkbox" checked={true} onChange={() => handleToggle(task)} />
                  <span>{task.title}</span>
                </label>
                <button
                  className="delete"
                  onClick={() => handleDelete(task.id)}
                  aria-label="刪除"
                >
                  刪除
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
