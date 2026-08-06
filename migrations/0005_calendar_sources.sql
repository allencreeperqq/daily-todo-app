-- Support multiple Google Calendars (not just "primary") and let events be
-- locally hidden without a write-scope delete against Google.
ALTER TABLE events RENAME TO events_old;

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  google_event_id TEXT,
  title TEXT NOT NULL,
  location TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'google',
  hidden INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (calendar_id, google_event_id)
);

INSERT INTO events (id, calendar_id, google_event_id, title, location, start_at, end_at, all_day, source, synced_at)
SELECT id, 'primary', google_event_id, title, location, start_at, end_at, all_day, source, synced_at FROM events_old;

DROP TABLE events_old;

CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);

CREATE TABLE IF NOT EXISTS calendar_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO calendar_sources (calendar_id, label) VALUES ('primary', '主要日曆');
