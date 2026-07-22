import { listTasks } from './tasks'
import { isGoogleConnected } from './googleAuth'
import { listEvents, syncGoogleCalendar } from './googleCalendar'
import { showToast } from './toast'

const CHECK_INTERVAL_MS = 60_000
const CALENDAR_SYNC_INTERVAL_MS = 15 * 60_000
const REMINDER_WINDOW_MINUTES = 10
const MORNING_DIGEST_HOUR = 8

const notifiedTaskIds = new Set<number>()
const notifiedEventIds = new Set<number>()
let morningDigestSentOn: string | null = null

export function startScheduler(): void {
  checkReminders()
  setInterval(checkReminders, CHECK_INTERVAL_MS)

  syncCalendarIfConnected()
  setInterval(syncCalendarIfConnected, CALENDAR_SYNC_INTERVAL_MS)
}

async function syncCalendarIfConnected(): Promise<void> {
  if (!isGoogleConnected()) return
  try {
    await syncGoogleCalendar()
  } catch (err) {
    console.error('[calendar] sync failed', err)
  }
}

function checkReminders(): void {
  const now = new Date()
  maybeSendMorningDigest(now)
  checkTaskReminders(now)
  checkEventReminders(now)
}

function checkTaskReminders(now: Date): void {
  const dueSoon = listTasks().filter((task) => {
    if (task.completed_at || !task.due_at || notifiedTaskIds.has(task.id)) return false
    const minutesUntilDue = (new Date(task.due_at).getTime() - now.getTime()) / 60_000
    return minutesUntilDue <= REMINDER_WINDOW_MINUTES && minutesUntilDue > -1
  })

  for (const task of dueSoon) {
    const dueAt = new Date(task.due_at as string)
    showToast(
      '待辦提醒',
      `${task.title} — ${dueAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
    )
    notifiedTaskIds.add(task.id)
  }
}

function checkEventReminders(now: Date): void {
  const from = now.toISOString()
  const to = new Date(now.getTime() + (REMINDER_WINDOW_MINUTES + 1) * 60_000).toISOString()

  const dueSoon = listEvents(from, to).filter(
    (event) => !event.all_day && !notifiedEventIds.has(event.id)
  )

  for (const event of dueSoon) {
    const startAt = new Date(event.start_at)
    showToast(
      '行程提醒',
      `${event.title} — ${startAt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
    )
    notifiedEventIds.add(event.id)
  }
}

function maybeSendMorningDigest(now: Date): void {
  const todayKey = now.toISOString().slice(0, 10)
  if (now.getHours() !== MORNING_DIGEST_HOUR || morningDigestSentOn === todayKey) return

  const todosToday = listTasks().filter(
    (task) => !task.completed_at && task.due_at?.slice(0, 10) === todayKey
  )
  const eventsToday = listEvents(`${todayKey}T00:00:00`, `${todayKey}T23:59:59`)

  const parts: string[] = []
  if (eventsToday.length > 0) parts.push(`${eventsToday.length} 個行程`)
  if (todosToday.length > 0) parts.push(`${todosToday.length} 件待辦`)

  showToast(
    '今日總覽',
    parts.length > 0 ? `今天有 ${parts.join('、')}。` : '今天沒有排定的行程或待辦事項。'
  )

  morningDigestSentOn = todayKey
}
