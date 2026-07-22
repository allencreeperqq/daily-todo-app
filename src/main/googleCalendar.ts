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

interface GoogleEventsResponse {
  items?: GoogleEventItem[]
  nextPageToken?: string
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

// A rolling window, not just "today" — wide enough to cover browsing several
// months back/forward in the calendar grid without needing a per-view sync.
const SYNC_DAYS_BACK = 90
const SYNC_DAYS_FORWARD = 365

async function fetchAllEvents(
  client: Awaited<ReturnType<typeof getAuthorizedClient>>,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleEventItem[]> {
  const items: GoogleEventItem[] = []
  let pageToken: string | undefined

  do {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    url.searchParams.set('timeMin', timeMin.toISOString())
    url.searchParams.set('timeMax', timeMax.toISOString())
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', '250')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await client.request<GoogleEventsResponse>({ url: url.toString() })
    items.push(...(response.data.items ?? []))
    pageToken = response.data.nextPageToken
  } while (pageToken)

  return items
}

export async function syncGoogleCalendar(): Promise<{ count: number }> {
  const client = await getAuthorizedClient()

  const timeMin = new Date()
  timeMin.setDate(timeMin.getDate() - SYNC_DAYS_BACK)
  const timeMax = new Date()
  timeMax.setDate(timeMax.getDate() + SYNC_DAYS_FORWARD)

  const items = await fetchAllEvents(client, timeMin, timeMax)

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
