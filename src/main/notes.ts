import { getDb } from './db'
import type { CreateNoteInput, Note, NotePatch } from '../shared/types'

export function listNotes(): Note[] {
  return getDb()
    .prepare('SELECT * FROM notes ORDER BY updated_at DESC')
    .all() as unknown as Note[]
}

export function getNote(id: number): Note | undefined {
  return getDb().prepare('SELECT * FROM notes WHERE id = ?').get(id) as unknown as
    | Note
    | undefined
}

export function createNote(input: CreateNoteInput): Note {
  const result = getDb()
    .prepare('INSERT INTO notes (title, content) VALUES (@title, @content)')
    .run({ title: input.title ?? '', content: input.content ?? '' })
  return getNote(result.lastInsertRowid as number)!
}

export function updateNote(id: number, patch: NotePatch): Note | undefined {
  const current = getNote(id)
  if (!current) return undefined

  getDb()
    .prepare(
      `UPDATE notes SET title = @title, content = @content, updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({
      id,
      title: patch.title ?? current.title,
      content: patch.content ?? current.content
    })
  return getNote(id)
}

export function deleteNote(id: number): void {
  getDb().prepare('DELETE FROM notes WHERE id = ?').run(id)
}
