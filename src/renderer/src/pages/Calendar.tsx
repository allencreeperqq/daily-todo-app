import { useEffect, useMemo, useState } from 'react'
import type { CalendarEvent, Task } from '../../../shared/types'

type ViewMode = 'month' | 'week' | 'day'

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

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const range = useMemo(() => {
    if (viewMode === 'day') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) }
    if (viewMode === 'week') {
      const from = startOfWeek(anchor)
      return { from, to: addDays(from, 7) }
    }
    const gridStart = startOfWeek(startOfMonth(anchor))
    const gridEnd = addDays(startOfWeek(endOfMonth(anchor)), 7)
    return { from: gridStart, to: gridEnd }
  }, [viewMode, anchor])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.api.tasks.list(),
      window.api.calendar.listEvents(range.from.toISOString(), range.to.toISOString())
    ]).then(([taskList, eventList]) => {
      setTasks(taskList)
      setEvents(eventList)
      setLoading(false)
    })
    // range.from/to are recreated each render; compare by epoch ms instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from.getTime(), range.to.getTime()])

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

  const today = startOfDay(new Date())

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1>日曆</h1>
        <div className="calendar-controls">
          <div className="view-switch">
            {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                className={viewMode === mode ? 'active' : ''}
                onClick={() => setViewMode(mode)}
              >
                {mode === 'month' ? '月' : mode === 'week' ? '週' : '日'}
              </button>
            ))}
          </div>
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
        </div>
      </div>

      <div className="calendar-range-label">{headerLabel}</div>

      {loading ? (
        <p className="loading">載入中...</p>
      ) : viewMode === 'month' ? (
        <MonthGrid anchor={anchor} tasks={tasks} events={events} today={today} onSelectDay={goToDay} />
      ) : viewMode === 'week' ? (
        <WeekAgenda anchor={anchor} tasks={tasks} events={events} today={today} onSelectDay={goToDay} />
      ) : (
        <DayAgenda day={anchor} tasks={tasks} events={events} />
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
  onSelectDay
}: {
  anchor: Date
  tasks: Task[]
  events: CalendarEvent[]
  today: Date
  onSelectDay: (d: Date) => void
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
  events
}: {
  day: Date
  tasks: Task[]
  events: CalendarEvent[]
}) {
  const items = buildAgenda(day, tasks, events)

  return (
    <div className="day-agenda">
      {items.length === 0 && <p className="empty">這天沒有行程或待辦事項</p>}
      <ul className="day-agenda-list">
        {items.map((item) => (
          <li key={item.key} className={`agenda-item ${item.kind}${item.completed ? ' done' : ''}`}>
            <span className="agenda-time">{item.timeLabel ?? '整天'}</span>
            <span className="agenda-title">{item.title}</span>
            <span className="agenda-kind">{item.kind === 'task' ? '待辦' : 'Google 日曆'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
