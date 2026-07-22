import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (db) return db

  const userDataDir = app.getPath('userData')
  if (!existsSync(userDataDir)) mkdirSync(userDataDir, { recursive: true })

  db = new DatabaseSync(join(userDataDir, 'daily_todo.db'))
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  runMigrations(db)
  return db
}

function runMigrations(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const migrationsDir = join(app.getAppPath(), 'migrations')
  if (!existsSync(migrationsDir)) return

  const applied = new Set(
    (
      database.prepare('SELECT name FROM _migrations').all() as unknown as { name: string }[]
    ).map((row) => row.name)
  )

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const recordMigration = database.prepare('INSERT INTO _migrations (name) VALUES (?)')

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')

    database.exec('BEGIN')
    try {
      database.exec(sql)
      recordMigration.run(file)
      database.exec('COMMIT')
    } catch (err) {
      database.exec('ROLLBACK')
      throw err
    }
    console.log(`[db] applied migration ${file}`)
  }
}

export function closeDb(): void {
  db?.close()
  db = null
}
