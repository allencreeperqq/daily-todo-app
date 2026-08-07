import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { Note } from '../../../shared/types'

const AUTOSAVE_DELAY_MS = 800

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  async function refresh(): Promise<void> {
    const list = await window.api.notes.list()
    setNotes(list)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId])

  // Loading a different note shouldn't carry over the previous note's
  // in-flight autosave timer onto the newly selected note.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setTitle(selected?.title ?? '')
    setContent(selected?.content ?? '')
    setPreviewing(false)
    if (selected) titleInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function scheduleSave(nextTitle: string, nextContent: string): void {
    if (selectedId === null) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const updated = await window.api.notes.update(selectedId, {
        title: nextTitle,
        content: nextContent
      })
      if (!updated) return
      setNotes((prev) =>
        [...prev.filter((n) => n.id !== updated.id), updated].sort((a, b) =>
          b.updated_at.localeCompare(a.updated_at)
        )
      )
    }, AUTOSAVE_DELAY_MS)
  }

  function handleTitleChange(value: string): void {
    setTitle(value)
    scheduleSave(value, content)
  }

  function handleContentChange(value: string): void {
    setContent(value)
    scheduleSave(title, value)
  }

  async function handleNewNote(): Promise<void> {
    const note = await window.api.notes.create({})
    setNotes((prev) => [note, ...prev])
    setSelectedId(note.id)
  }

  async function handleDelete(id: number): Promise<void> {
    await window.api.notes.delete(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const previewHtml = useMemo(() => {
    if (!previewing) return ''
    return DOMPurify.sanitize(marked.parse(content, { async: false, breaks: true }) as string)
  }, [previewing, content])

  if (loading) return <p className="loading">載入中...</p>

  return (
    <div className="notes-page">
      <h1>記事本</h1>
      <div className="notes-body">
        <aside className="notes-sidebar">
          <button className="notes-new" onClick={handleNewNote}>
            + 新增筆記
          </button>
          <ul className="notes-list">
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  className={`notes-list-item${note.id === selectedId ? ' active' : ''}`}
                  onClick={() => setSelectedId(note.id)}
                >
                  <span className="notes-list-title">{note.title.trim() || '無標題筆記'}</span>
                  <span className="notes-list-time">{formatUpdatedAt(note.updated_at)}</span>
                </button>
                <button
                  className="delete"
                  onClick={() => handleDelete(note.id)}
                  aria-label="刪除筆記"
                >
                  刪除
                </button>
              </li>
            ))}
            {notes.length === 0 && <li className="empty">還沒有筆記,先記一些東西吧</li>}
          </ul>
        </aside>

        <section className="notes-editor">
          {!selected && <p className="empty">從左邊選一則筆記,或新增一則</p>}
          {selected && (
            <>
              <div className="notes-editor-header">
                <input
                  ref={titleInputRef}
                  className="notes-title-input"
                  type="text"
                  placeholder="標題..."
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
                <div className="view-switch">
                  <button className={!previewing ? 'active' : ''} onClick={() => setPreviewing(false)}>
                    編輯
                  </button>
                  <button className={previewing ? 'active' : ''} onClick={() => setPreviewing(true)}>
                    預覽
                  </button>
                </div>
              </div>

              {!previewing && (
                <textarea
                  className="notes-content-input"
                  placeholder="支援 Markdown,例如 # 標題、- 清單、**粗體**..."
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                />
              )}
              {previewing && (
                <div
                  className="notes-preview"
                  dangerouslySetInnerHTML={{
                    __html: previewHtml || '<p class="empty">沒有內容可以預覽</p>'
                  }}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
