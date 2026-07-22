import { getDb } from './db'
import { getAuthorizedClient } from './googleAuth'
import type { CalendarEvent } from '../shared/types'

interface GoogleEventItem {
  id: string
  status?: string
  summary?: string
  location?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

interface EventRow {
  id: number
  google_event_id: string | null
  title: string
  location: string | null
  start_at: string
  end_at: string | null
  all_day: number
  source: string
  synced_at: string
}

const SYNC_DAYS_BACK = 1
const SYNC_DAYS_FORWARD = 30

export async function syncGoogleCalendar(): Promise<{ count: number }> {
  const client = await getAuthorizedClient()

  const timeMin = new Date()
  timeMin.setDate(timeMin.getDate() - SYNC_DAYS_BACK)
  const timeMax = new Date()
  timeMax.setDate(timeMax.getDate() + SYNC_DAYS_FORWARD)

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('timeMin', timeMin.toISOString())
  url.searchParams.set('timeMax', timeMax.toISOString())
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '250')

  const response = await client.request<{ items?: GoogleEventItem[] }>({ url: url.toString() })
  const items = response.data.items ?? []

  const db = getDb()
  const upsert = db.prepare(
    `INSERT INTO events (google_event_id, title, location, start_at, end_at, all_day, source)
     VALUES (@google_event_id, @title, @location, @start_at, @end_at, @all_day, 'google')
     ON CONFLICT(google_event_id) DO UPDATE SET
       title = excluded.title,
       location = excluded.location,
       start_at = excluded.start_at,
       end_at = excluded.end_at,
       all_day = excluded.all_day,
       synced_at = datetime('now')`
  )

  const seenIds: string[] = []

  db.exec('BEGIN')
  try {
    for (const item of items) {
      if (item.status === 'cancelled') continue
      const startAt = item.start?.dateTime ?? item.start?.date
      if (!startAt) continue
      const allDay = Boolean(item.start?.date && !item.start?.dateTime)

      upsert.run({
        google_event_id: item.id,
        title: item.summary ?? '(無標題)',
        location: item.location ?? null,
        start_at: startAt,
        end_at: item.end?.dateTime ?? item.end?.date ?? null,
        all_day: allDay ? 1 : 0
      })
      seenIds.push(item.id)
    }

    if (seenIds.length > 0) {
      const placeholders = seenIds.map(() => '?').join(',')
      db.prepare(
        `DELETE FROM events
         WHERE source = 'google' AND start_at >= ? AND start_at < ?
         AND google_event_id NOT IN (${placeholders})`
      ).run(timeMin.toISOString(), timeMax.toISOString(), ...seenIds)
    } else {
      db.prepare(
        `DELETE FROM events WHERE source = 'google' AND start_at >= ? AND start_at < ?`
      ).run(timeMin.toISOString(), timeMax.toISOString())
    }

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  return { count: seenIds.length }
}

export function listEvents(fromDate: string, toDate: string): CalendarEvent[] {
  const rows = getDb()
    .prepare(`SELECT * FROM events WHERE start_at >= ? AND start_at < ? ORDER BY start_at ASC`)
    .all(fromDate, toDate) as unknown as EventRow[]

  return rows.map((row) => ({ ...row, all_day: row.all_day === 1 }))
}
