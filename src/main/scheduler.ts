import { listTasks } from './tasks'
import { listTransactions } from './finance'
import { isGoogleConnected } from './googleAuth'
import { listEvents, syncGoogleCalendar } from './googleCalendar'
import { getGeneralSettings } from './settings'
import { showToast } from './toast'

const CHECK_INTERVAL_MS = 60_000
const CALENDAR_SYNC_INTERVAL_MS = 15 * 60_000
// The first calendar sync fetches up to ~1.25 years of events (across every
// configured source) and does a chunk of synchronous SQLite writes — doing
// that at time zero competes with the renderer's very first IPC round-trip
// (tasks:list / calendar:events:list) on the same single JS thread, which is
// what makes the window feel slow to become usable right after launch.
// Pushing it a few seconds out lets the window paint and load its initial
// data first; the 15-minute recurring sync cadence is unaffected.
const INITIAL_CALENDAR_SYNC_DELAY_MS = 3_000

const notifiedTaskIds = new Set<number>()
const notifiedEventIds = new Set<number>()
let morningDigestSentOn: string | null = null
let expenseReminderSentOn: string | null = null

// now.toISOString().slice(0, 10) gives the UTC date, which drifts a day
// behind the user's actual local date for part of the day (e.g. anywhere
// from local midnight to 08:00 in UTC+8). Use this for any "today" bucket
// that's compared against local wall-clock data.
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function startScheduler(): void {
  checkReminders()
  setInterval(checkReminders, CHECK_INTERVAL_MS)

  setTimeout(syncCalendarIfConnected, INITIAL_CALENDAR_SYNC_DELAY_MS)
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
  maybeSendExpenseReminder(now)
  checkTaskReminders(now)
  checkEventReminders(now)
}

function checkTaskReminders(now: Date): void {
  const { reminderLeadMinutes } = getGeneralSettings()
  const dueSoon = listTasks().filter((task) => {
    if (task.completed_at || !task.due_at || notifiedTaskIds.has(task.id)) return false
    const minutesUntilDue = (new Date(task.due_at).getTime() - now.getTime()) / 60_000
    return minutesUntilDue <= reminderLeadMinutes && minutesUntilDue > -1
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
  const { reminderLeadMinutes } = getGeneralSettings()
  const from = now.toISOString()
  const to = new Date(now.getTime() + (reminderLeadMinutes + 1) * 60_000).toISOString()

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
  const { morningDigestHour } = getGeneralSettings()
  const todayKey = localDateKey(now)
  if (now.getHours() !== morningDigestHour || morningDigestSentOn === todayKey) return

  const todosToday = listTasks().filter(
    (task) => !task.completed_at && task.due_at && localDateKey(new Date(task.due_at)) === todayKey
  )
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  const eventsToday = listEvents(dayStart.toISOString(), dayEnd.toISOString())

  const parts: string[] = []
  if (eventsToday.length > 0) parts.push(`${eventsToday.length} 個行程`)
  if (todosToday.length > 0) parts.push(`${todosToday.length} 件待辦`)

  showToast(
    '今日總覽',
    parts.length > 0 ? `今天有 ${parts.join('、')}。` : '今天沒有排定的行程或待辦事項。'
  )

  morningDigestSentOn = todayKey
}

function maybeSendExpenseReminder(now: Date): void {
  const { expenseReminderEnabled, expenseReminderHour } = getGeneralSettings()
  if (!expenseReminderEnabled) return
  const todayKey = localDateKey(now)
  if (now.getHours() !== expenseReminderHour || expenseReminderSentOn === todayKey) return

  const loggedToday = listTransactions(todayKey.slice(0, 7)).some(
    (tx) => localDateKey(new Date(tx.occurred_at)) === todayKey
  )

  if (!loggedToday) {
    showToast('記帳提醒', '今天還沒有記錄任何收支,別忘了記一下帳。')
  }

  expenseReminderSentOn = todayKey
}
