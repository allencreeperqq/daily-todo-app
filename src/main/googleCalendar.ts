import { getDb } from './db'
import { getAuthorizedClient } from './googleAuth'
import type { CalendarEvent, CalendarSource } from '../shared/types'

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
  calendar_id: string
  google_event_id: string | null
  title: string
  location: string | null
  start_at: string
  end_at: string | null
  all_day: number
  source: string
  hidden: number
  synced_at: string
}

// A rolling window, not just "today" — wide enough to cover browsing several
// months back/forward in the calendar grid without needing a per-view sync.
const SYNC_DAYS_BACK = 90
const SYNC_DAYS_FORWARD = 365

// Users naturally copy Google Calendar's "shareable link"
// (https://calendar.google.com/calendar/u/0?cid=<base64>) rather than
// hunting down the raw Calendar ID in settings. The cid param is just the
// real calendar ID, base64-encoded — decode it so pasting the link works.
export function parseCalendarId(input: string): string {
  const trimmed = input.trim()
  try {
    const url = new URL(trimmed)
    const cid = url.searchParams.get('cid')
    if (cid) {
      const normalized = cid.replace(/-/g, '+').replace(/_/g, '/')
      const decoded = Buffer.from(normalized, 'base64').toString('utf-8')
      if (decoded.includes('@')) return decoded
    }
  } catch {
    // not a URL — use the raw input as-is
  }
  return trimmed
}

export function listCalendarSources(): CalendarSource[] {
  return getDb()
    .prepare('SELECT * FROM calendar_sources ORDER BY id ASC')
    .all() as unknown as CalendarSource[]
}

export function addCalendarSource(calendarId: string, label: string): CalendarSource {
  const trimmedId = parseCalendarId(calendarId)
  const trimmedLabel = label.trim() || trimmedId
  getDb()
    .prepare(
      `INSERT INTO calendar_sources (calendar_id, label) VALUES (@calendar_id, @label)
       ON CONFLICT(calendar_id) DO UPDATE SET label = excluded.label`
    )
    .run({ calendar_id: trimmedId, label: trimmedLabel })
  return getDb()
    .prepare('SELECT * FROM calendar_sources WHERE calendar_id = ?')
    .get(trimmedId) as unknown as CalendarSource
}

export function removeCalendarSource(id: number): void {
  const db = getDb()
  const row = db.prepare('SELECT calendar_id FROM calendar_sources WHERE id = ?').get(id) as
    | { calendar_id: string }
    | undefined
  db.prepare('DELETE FROM calendar_sources WHERE id = ?').run(id)
  if (row) db.prepare('DELETE FROM events WHERE calendar_id = ?').run(row.calendar_id)
}

async function fetchAllEvents(
  client: Awaited<ReturnType<typeof getAuthorizedClient>>,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleEventItem[]> {
  const items: GoogleEventItem[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    )
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

export interface SyncOutcome {
  count: number
  errors: { calendarId: string; message: string }[]
}

// google-auth-library's client.request() throws a gaxios-style error whose
// generic .message (e.g. "Request failed with status code 404") hides the
// actual reason. The real explanation is in the response body.
function describeGoogleApiError(err: unknown): string {
  const anyErr = err as {
    message?: string
    response?: { status?: number; data?: { error?: { message?: string } } }
  }
  const status = anyErr.response?.status
  const apiMessage = anyErr.response?.data?.error?.message
  if (apiMessage) return status ? `${status}: ${apiMessage}` : apiMessage
  return anyErr.message ?? '未知錯誤'
}

export async function syncGoogleCalendar(): Promise<SyncOutcome> {
  const client = await getAuthorizedClient()
  const sources = listCalendarSources()

  const timeMin = new Date()
  timeMin.setDate(timeMin.getDate() - SYNC_DAYS_BACK)
  const timeMax = new Date()
  timeMax.setDate(timeMax.getDate() + SYNC_DAYS_FORWARD)

  const db = getDb()
  const upsert = db.prepare(
    `INSERT INTO events (calendar_id, google_event_id, title, location, start_at, end_at, all_day, source)
     VALUES (@calendar_id, @google_event_id, @title, @location, @start_at, @end_at, @all_day, 'google')
     ON CONFLICT(calendar_id, google_event_id) DO UPDATE SET
       title = excluded.title,
       location = excluded.location,
       start_at = excluded.start_at,
       end_at = excluded.end_at,
       all_day = excluded.all_day,
       synced_at = datetime('now')`
  )

  let totalCount = 0
  const errors: { calendarId: string; message: string }[] = []

  for (const src of sources) {
    // Self-heal any source added before parseCalendarId existed (e.g. a
    // pasted share link stored verbatim) so it doesn't need manual removal.
    const calendarId = parseCalendarId(src.calendar_id)
    if (calendarId !== src.calendar_id) {
      db.prepare('UPDATE calendar_sources SET calendar_id = ? WHERE id = ?').run(
        calendarId,
        src.id
      )
    }

    let items: GoogleEventItem[]
    try {
      items = await fetchAllEvents(client, calendarId, timeMin, timeMax)
    } catch (err) {
      errors.push({ calendarId, message: describeGoogleApiError(err) })
      continue
    }

    const seenIds: string[] = []

    db.exec('BEGIN')
    try {
      for (const item of items) {
        if (item.status === 'cancelled') continue
        const rawStart = item.start?.dateTime ?? item.start?.date
        if (!rawStart) continue
        const allDay = Boolean(item.start?.date && !item.start?.dateTime)
        const rawEnd = item.end?.dateTime ?? item.end?.date ?? null

        // Google returns timed events in the event's own timezone offset (e.g.
        // "+08:00"), not UTC. Storing that raw string breaks the plain-text
        // range comparisons in listEvents()/checkEventReminders() below, which
        // compare against timeMin/timeMax/now.toISOString() (always "Z"-suffixed
        // UTC) — lexicographic comparison of two ISO strings only sorts
        // correctly when both use the same offset. Normalize timed values to
        // UTC at write time so every stored start_at/end_at is directly
        // comparable. All-day "date" values (no time/offset) are left as-is.
        const startAt = allDay ? rawStart : new Date(rawStart).toISOString()
        const endAt = rawEnd && !allDay ? new Date(rawEnd).toISOString() : rawEnd

        upsert.run({
          calendar_id: calendarId,
          google_event_id: item.id,
          title: item.summary ?? '(無標題)',
          location: item.location ?? null,
          start_at: startAt,
          end_at: endAt,
          all_day: allDay ? 1 : 0
        })
        seenIds.push(item.id)
      }

      if (seenIds.length > 0) {
        const placeholders = seenIds.map(() => '?').join(',')
        db.prepare(
          `DELETE FROM events
           WHERE calendar_id = ? AND source = 'google' AND start_at >= ? AND start_at < ?
           AND google_event_id NOT IN (${placeholders})`
        ).run(calendarId, timeMin.toISOString(), timeMax.toISOString(), ...seenIds)
      } else {
        db.prepare(
          `DELETE FROM events
           WHERE calendar_id = ? AND source = 'google' AND start_at >= ? AND start_at < ?`
        ).run(calendarId, timeMin.toISOString(), timeMax.toISOString())
      }

      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }

    totalCount += seenIds.length
  }

  return { count: totalCount, errors }
}

export function listEvents(fromDate: string, toDate: string): CalendarEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM events WHERE hidden = 0 AND start_at >= ? AND start_at < ? ORDER BY start_at ASC`
    )
    .all(fromDate, toDate) as unknown as EventRow[]

  return rows.map((row) => ({ ...row, all_day: row.all_day === 1, hidden: row.hidden === 1 }))
}

export function hideEvent(id: number): void {
  getDb().prepare('UPDATE events SET hidden = 1 WHERE id = ?').run(id)
}
