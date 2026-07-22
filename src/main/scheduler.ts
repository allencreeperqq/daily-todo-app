import { Notification } from 'electron'
import { listTasks } from './tasks'

const CHECK_INTERVAL_MS = 60_000
const REMINDER_WINDOW_MINUTES = 10
const MORNING_DIGEST_HOUR = 8

const notifiedTaskIds = new Set<number>()
let morningDigestSentOn: string | null = null

export function startScheduler(): void {
  checkReminders()
  setInterval(checkReminders, CHECK_INTERVAL_MS)
}

function checkReminders(): void {
  const now = new Date()
  maybeSendMorningDigest(now)

  const dueSoon = listTasks().filter((task) => {
    if (task.completed_at || !task.due_at || notifiedTaskIds.has(task.id)) return false
    const minutesUntilDue = (new Date(task.due_at).getTime() - now.getTime()) / 60_000
    return minutesUntilDue <= REMINDER_WINDOW_MINUTES && minutesUntilDue > -1
  })

  for (const task of dueSoon) {
    const dueAt = new Date(task.due_at as string)
    new Notification({
      title: '待辦提醒',
      body: `${task.title} — ${dueAt.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    }).show()
    notifiedTaskIds.add(task.id)
  }
}

function maybeSendMorningDigest(now: Date): void {
  const todayKey = now.toISOString().slice(0, 10)
  if (now.getHours() !== MORNING_DIGEST_HOUR || morningDigestSentOn === todayKey) return

  const todosToday = listTasks().filter(
    (task) => !task.completed_at && task.due_at?.slice(0, 10) === todayKey
  )

  new Notification({
    title: '今日總覽',
    body:
      todosToday.length > 0 ? `今天有 ${todosToday.length} 件待辦事項。` : '今天沒有排定的待辦事項。'
  }).show()

  morningDigestSentOn = todayKey
}
