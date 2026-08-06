import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { CalendarEvent, Task } from '../../../shared/types'

type ViewMode = 'today' | 'month' | 'week' | 'day'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const DAY_MS = 86_400_000

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function startOfWeek(d: Date): Date {
  const r = startOfDay(d)
  r.setDate(r.getDate() - r.getDay())
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b)
}

interface AgendaItem {
  key: string
  id: number
  timeLabel: string | null
  title: string
  kind: 'task' | 'event'
  completed: boolean
  sortAt: number
}

function buildAgenda(day: Date, tasks: Task[], events: CalendarEvent[]): AgendaItem[] {
  const key = dateKey(day)
  const items: AgendaItem[] = []

  for (const task of tasks) {
    if (!task.due_at || task.due_at.slice(0, 10) !== key) continue
    const due = new Date(task.due_at)
    items.push({
      key: `task-${task.id}`,
      id: task.id,
      timeLabel: due.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      title: task.title,
      kind: 'task',
      completed: Boolean(task.completed_at),
      sortAt: due.getTime()
    })
  }

  for (const event of events) {
    if (event.start_at.slice(0, 10) !== key) continue
    const start = new Date(event.start_at)
    items.push({
      key: `event-${event.id}`,
      id: event.id,
      timeLabel: event.all_day
        ? '整天'
        : start.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      title: event.title,
      kind: 'event',
      completed: false,
      sortAt: event.all_day ? -Infinity : start.getTime()
    })
  }

  return items.sort((a, b) => a.sortAt - b.sortAt)
}

export default function Today() {
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')

  const range = useMemo(() => {
    if (viewMode === 'today') {
      const s = startOfDay(new Date())
      return { from: s, to: addDays(s, 1) }
    }
    if (viewMode === 'day') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) }
    if (viewMode === 'week') {
      const from = startOfWeek(anchor)
      return { from, to: addDays(from, 7) }
    }
    const gridStart = startOfWeek(startOfMonth(anchor))
    const gridEnd = addDays(startOfWeek(endOfMonth(anchor)), 7)
    return { from: gridStart, to: gridEnd }
  }, [viewMode, anchor])

  async function refresh(): Promise<void> {
    const [taskList, eventList] = await Promise.all([
      window.api.tasks.list(),
      window.api.calendar.listEvents(range.from.toISOString(), range.to.toISOString())
    ])
    setTasks(taskList)
    setEvents(eventList)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // range.from/to are recreated each render; compare by epoch ms instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from.getTime(), range.to.getTime()])

  async function createTask(taskTitle: string, dueAtIso: string | null): Promise<void> {
    await window.api.tasks.create({ title: taskTitle, due_at: dueAtIso })
    await refresh()
  }

  async function handleAdd(e: FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    await createTask(trimmed, dueAt ? new Date(dueAt).toISOString() : null)
    setTitle('')
    setDueAt('')
  }

  async function handleToggle(task: Task): Promise<void> {
    await window.api.tasks.toggle(task.id, !task.completed_at)
    await refresh()
  }

  async function handleDelete(id: number): Promise<void> {
    await window.api.tasks.delete(id)
    await refresh()
  }

  async function handleHideEvent(id: number): Promise<void> {
    await window.api.calendar.hideEvent(id)
    await refresh()
  }

  function shift(delta: number): void {
    if (viewMode === 'day') setAnchor((d) => addDays(d, delta))
    else if (viewMode === 'week') setAnchor((d) => addDays(d, delta * 7))
    else setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  function goToday(): void {
    setAnchor(startOfDay(new Date()))
  }

  function goToDay(day: Date): void {
    setAnchor(startOfDay(day))
    setViewMode('day')
  }

  const headerLabel = useMemo(() => {
    if (viewMode === 'day') {
      return anchor.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      })
    }
    if (viewMode === 'week') {
      const from = startOfWeek(anchor)
      const to = addDays(from, 6)
      return from.getMonth() === to.getMonth()
        ? `${from.getFullYear()} 年 ${from.getMonth() + 1} 月 ${from.getDate()}–${to.getDate()} 日`
        : `${from.getMonth() + 1}/${from.getDate()} – ${to.getMonth() + 1}/${to.getDate()}`
    }
    return `${anchor.getFullYear()} 年 ${anchor.getMonth() + 1} 月`
  }, [viewMode, anchor])

  if (loading) return <p className="loading">載入中...</p>

  const todayDate = startOfDay(new Date())
  const pending = tasks.filter((t) => !t.completed_at)
  const done = tasks.filter((t) => t.completed_at)
  const eventsToday = events.filter((ev) => ev.start_at.slice(0, 10) === dateKey(todayDate))

  return (
    <div className="today-page">
      <div className="calendar-header">
        <h1>今天</h1>
        <div className="calendar-controls">
          <div className="view-switch">
            {(['today', 'month', 'week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                className={viewMode === mode ? 'active' : ''}
                onClick={() => setViewMode(mode)}
              >
                {mode === 'today' ? '今天' : mode === 'month' ? '月' : mode === 'week' ? '週' : '日'}
              </button>
            ))}
          </div>
          {viewMode !== 'today' && (
            <div className="date-nav">
              <button onClick={() => shift(-1)} aria-label="上一個">
                ‹
              </button>
              <button className="today-btn" onClick={goToday}>
                今天
              </button>
              <button onClick={() => shift(1)} aria-label="下一個">
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {viewMode !== 'today' && <div className="calendar-range-label">{headerLabel}</div>}

      {viewMode === 'today' && (
        <>
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
            <h2>今日行程 ({eventsToday.length})</h2>
            <ul className="event-list">
              {eventsToday.map((ev) => (
                <li key={ev.id}>
                  <span className="event-time">
                    {ev.all_day
                      ? '整天'
                      : new Date(ev.start_at).toLocaleTimeString('zh-TW', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                  </span>
                  <span className="event-title">{ev.title}</span>
                  {ev.location && <span className="event-location">{ev.location}</span>}
                  <button
                    className="delete"
                    onClick={() => handleHideEvent(ev.id)}
                    aria-label="刪除"
                  >
                    刪除
                  </button>
                </li>
              ))}
              {eventsToday.length === 0 && <li className="empty">今天沒有 Google 日曆行程</li>}
            </ul>
          </section>

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
        </>
      )}

      {viewMode === 'month' && (
        <MonthGrid anchor={anchor} tasks={tasks} events={events} today={todayDate} onSelectDay={goToDay} />
      )}
      {viewMode === 'week' && (
        <WeekAgenda
          anchor={anchor}
          tasks={tasks}
          events={events}
          today={todayDate}
          onSelectDay={goToDay}
          onHideEvent={handleHideEvent}
        />
      )}
      {viewMode === 'day' && (
        <DayAgenda
          day={anchor}
          tasks={tasks}
          events={events}
          onHideEvent={handleHideEvent}
          onAddTask={createTask}
        />
      )}
    </div>
  )
}

function MonthGrid({
  anchor,
  tasks,
  events,
  today,
  onSelectDay
}: {
  anchor: Date
  tasks: Task[]
  events: CalendarEvent[]
  today: Date
  onSelectDay: (d: Date) => void
}) {
  const gridStart = startOfWeek(startOfMonth(anchor))
  const gridEnd = addDays(startOfWeek(endOfMonth(anchor)), 7)
  const dayCount = Math.round((gridEnd.getTime() - gridStart.getTime()) / DAY_MS)
  const days = Array.from({ length: dayCount }, (_, i) => addDays(gridStart, i))

  return (
    <div className="month-grid">
      <div className="month-grid-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="month-grid-body">
        {days.map((day) => {
          const items = buildAgenda(day, tasks, events)
          const inMonth = day.getMonth() === anchor.getMonth()
          const isToday = isSameDay(day, today)
          return (
            <button
              key={dateKey(day)}
              className={`month-cell${inMonth ? '' : ' outside'}${isToday ? ' today' : ''}`}
              onClick={() => onSelectDay(day)}
            >
              <span className="cell-date">{day.getDate()}</span>
              <div className="cell-items">
                {items.slice(0, 3).map((item) => (
                  <span
                    key={item.key}
                    className={`cell-item ${item.kind}${item.completed ? ' done' : ''}`}
                  >
                    {item.title}
                  </span>
                ))}
                {items.length > 3 && <span className="cell-more">+{items.length - 3}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeekAgenda({
  anchor,
  tasks,
  events,
  today,
  onSelectDay,
  onHideEvent
}: {
  anchor: Date
  tasks: Task[]
  events: CalendarEvent[]
  today: Date
  onSelectDay: (d: Date) => void
  onHideEvent: (id: number) => void
}) {
  const from = startOfWeek(anchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))

  return (
    <div className="week-agenda">
      {days.map((day) => {
        const items = buildAgenda(day, tasks, events)
        const isToday = isSameDay(day, today)
        return (
          <div key={dateKey(day)} className={`week-day-column${isToday ? ' today' : ''}`}>
            <button className="week-day-header" onClick={() => onSelectDay(day)}>
              <span className="weekday-label">{WEEKDAY_LABELS[day.getDay()]}</span>
              <span className="day-number">{day.getDate()}</span>
            </button>
            <div className="week-day-items">
              {items.length === 0 && <span className="empty-hint">—</span>}
              {items.map((item) => (
                <div
                  key={item.key}
                  className={`agenda-item ${item.kind}${item.completed ? ' done' : ''}`}
                >
                  {item.timeLabel && <span className="agenda-time">{item.timeLabel}</span>}
                  <span className="agenda-title">{item.title}</span>
                  {item.kind === 'event' && (
                    <button
                      className="delete"
                      onClick={() => onHideEvent(item.id)}
                      aria-label="刪除"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DayAgenda({
  day,
  tasks,
  events,
  onHideEvent,
  onAddTask
}: {
  day: Date
  tasks: Task[]
  events: CalendarEvent[]
  onHideEvent: (id: number) => void
  onAddTask: (title: string, dueAtIso: string | null) => Promise<void>
}) {
  const items = buildAgenda(day, tasks, events)
  const [newTitle, setNewTitle] = useState('')
  const [newTime, setNewTime] = useState('')

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = newTitle.trim()
    if (!trimmed) return
    const dueAt = new Date(`${dateKey(day)}T${newTime || '09:00'}`).toISOString()
    await onAddTask(trimmed, dueAt)
    setNewTitle('')
    setNewTime('')
  }

  return (
    <div className="day-agenda">
      <form className="add-task-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="新增這天的待辦事項..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          aria-label="時間(選填,預設早上 9 點)"
        />
        <button type="submit">新增</button>
      </form>

      {items.length === 0 && <p className="empty">這天沒有行程或待辦事項</p>}
      <ul className="day-agenda-list">
        {items.map((item) => (
          <li key={item.key} className={`agenda-item ${item.kind}${item.completed ? ' done' : ''}`}>
            <span className="agenda-time">{item.timeLabel ?? '整天'}</span>
            <span className="agenda-title">{item.title}</span>
            <span className="agenda-kind">{item.kind === 'task' ? '待辦' : 'Google 日曆'}</span>
            {item.kind === 'event' && (
              <button className="delete" onClick={() => onHideEvent(item.id)} aria-label="刪除">
                刪除
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
