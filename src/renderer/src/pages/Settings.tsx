import { useEffect, useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react'
import type { CalendarSource, GeneralSettings, GoogleAuthStatus } from '../../../shared/types'
import { applyGlassOpacity } from '../glass'

export default function Settings() {
  const [status, setStatus] = useState<GoogleAuthStatus | null>(null)
  const [sources, setSources] = useState<CalendarSource[]>([])
  const [general, setGeneral] = useState<GeneralSettings | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [newCalendarId, setNewCalendarId] = useState('')
  const [newCalendarLabel, setNewCalendarLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [generalMessage, setGeneralMessage] = useState<string | null>(null)

  async function refresh(): Promise<void> {
    const [authStatus, sourceList, generalSettings] = await Promise.all([
      window.api.calendar.getGoogleAuthStatus(),
      window.api.calendar.listSources(),
      window.api.settings.getGeneral()
    ])
    setStatus(authStatus)
    setSources(sourceList)
    setGeneral(generalSettings)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleSaveConfig(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!clientId.trim() || !clientSecret.trim()) return

    await window.api.calendar.setGoogleClientConfig(clientId.trim(), clientSecret.trim())
    setClientId('')
    setClientSecret('')
    setMessage('已儲存憑證設定')
    await refresh()
  }

  async function handleConnect(): Promise<void> {
    setBusy(true)
    setMessage('請在瀏覽器完成授權...')
    try {
      await window.api.calendar.connectGoogle()
      setMessage('已成功連接 Google 日曆')
      await refresh()
    } catch (err) {
      setMessage(`連接失敗:${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleSync(): Promise<void> {
    setBusy(true)
    try {
      const result = await window.api.calendar.syncGoogle()
      if (result.errors.length > 0) {
        const detail = result.errors.map((e) => `${e.calendarId}(${e.message})`).join('、')
        setMessage(`已同步 ${result.count} 筆行程,但有日曆失敗:${detail}`)
      } else {
        setMessage(`已同步 ${result.count} 筆行程`)
      }
    } catch (err) {
      setMessage(`同步失敗:${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleDisconnect(): Promise<void> {
    await window.api.calendar.disconnectGoogle()
    setMessage('已中斷連接')
    await refresh()
  }

  async function handleAddSource(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!newCalendarId.trim()) return
    await window.api.calendar.addSource(newCalendarId.trim(), newCalendarLabel.trim())
    setNewCalendarId('')
    setNewCalendarLabel('')
    await refresh()
  }

  async function handleRemoveSource(id: number): Promise<void> {
    await window.api.calendar.removeSource(id)
    await refresh()
  }

  function handleGlassPreview(e: ChangeEvent<HTMLInputElement>): void {
    const value = Number(e.target.value)
    setGeneral((g) => (g ? { ...g, glassOpacity: value } : g))
    applyGlassOpacity(value)
  }

  async function commitGlassOpacity(): Promise<void> {
    if (!general) return
    const merged = await window.api.settings.updateGeneral({ glassOpacity: general.glassOpacity })
    setGeneral(merged)
  }

  async function handleToggleOpenAtLogin(): Promise<void> {
    if (!general) return
    const merged = await window.api.settings.updateGeneral({ openAtLogin: !general.openAtLogin })
    setGeneral(merged)
    setGeneralMessage(
      merged.openAtLogin ? '已設定開機自動啟動(僅安裝版本生效)' : '已取消開機自動啟動'
    )
  }

  function handleReminderLeadInput(e: ChangeEvent<HTMLInputElement>): void {
    const value = Number(e.target.value)
    setGeneral((g) => (g ? { ...g, reminderLeadMinutes: value } : g))
  }

  async function commitReminderLead(): Promise<void> {
    if (!general) return
    const clamped = Math.min(120, Math.max(1, Math.round(general.reminderLeadMinutes) || 10))
    const merged = await window.api.settings.updateGeneral({ reminderLeadMinutes: clamped })
    setGeneral(merged)
  }

  function handleDigestHourInput(e: ChangeEvent<HTMLInputElement>): void {
    const value = Number(e.target.value)
    setGeneral((g) => (g ? { ...g, morningDigestHour: value } : g))
  }

  async function commitDigestHour(): Promise<void> {
    if (!general) return
    const clamped = Math.min(23, Math.max(0, Math.round(general.morningDigestHour) || 0))
    const merged = await window.api.settings.updateGeneral({ morningDigestHour: clamped })
    setGeneral(merged)
  }

  function openCredentialsConsole(e: MouseEvent): void {
    e.preventDefault()
    window.api.shell.openExternal('https://console.cloud.google.com/apis/credentials')
  }

  function openCalendarSettings(e: MouseEvent): void {
    e.preventDefault()
    window.api.shell.openExternal('https://calendar.google.com/calendar/u/0/r/settings')
  }

  if (!status) return <p className="loading">載入中...</p>

  return (
    <div className="settings-page">
      <h1>設定</h1>

      <section className="settings-section">
        <h2>Google 日曆</h2>
        <p className="settings-hint">
          到{' '}
          <a href="#" onClick={openCredentialsConsole}>
            Google Cloud Console
          </a>{' '}
          建立一個「電腦版應用程式」(Desktop app)類型的 OAuth 用戶端,啟用 Google Calendar API,
          再把 Client ID 與 Client Secret 貼在下面。目前只做唯讀同步,不會修改你的日曆。
        </p>

        <div className="status-row">
          <span className={`status-badge${status.configured ? ' ok' : ''}`}>
            {status.configured ? '已設定憑證' : '尚未設定憑證'}
          </span>
          <span className={`status-badge${status.connected ? ' ok' : ''}`}>
            {status.connected ? '已連接' : '未連接'}
          </span>
        </div>

        <form className="settings-form" onSubmit={handleSaveConfig}>
          <input
            type="text"
            placeholder="Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <input
            type="password"
            placeholder="Client Secret"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
          <button type="submit">儲存設定</button>
        </form>

        <div className="settings-actions">
          <button disabled={!status.configured || busy} onClick={handleConnect}>
            {status.connected ? '重新連接' : '連接 Google 日曆'}
          </button>
          <button disabled={!status.connected || busy} onClick={handleSync}>
            立即同步
          </button>
          <button disabled={!status.connected || busy} onClick={handleDisconnect}>
            中斷連接
          </button>
        </div>

        {message && <p className="settings-message">{message}</p>}
      </section>

      <section className="settings-section">
        <h2>日曆來源</h2>
        <p className="settings-hint">
          預設只同步「主要日曆」。如果你有其他日曆(自己建立的次要日曆,或別人分享給你、你已經接受邀請的日曆),到{' '}
          <a href="#" onClick={openCalendarSettings}>
            Google 日曆設定
          </a>{' '}
          點選該日曆 →「整合」→ 複製「日曆 ID」或「公開網址」貼在下面新增(兩種格式都吃,貼分享連結的話會自動解析出日曆 ID)。分享的日曆要先在 Google 日曆裡接受邀請、確定它出現在你的日曆清單中,才有辦法同步。
        </p>

        <form className="settings-form" onSubmit={handleAddSource}>
          <input
            type="text"
            placeholder="日曆 ID(例如 xxxx@group.calendar.google.com)"
            value={newCalendarId}
            onChange={(e) => setNewCalendarId(e.target.value)}
          />
          <input
            type="text"
            placeholder="顯示名稱(選填)"
            value={newCalendarLabel}
            onChange={(e) => setNewCalendarLabel(e.target.value)}
          />
          <button type="submit">新增</button>
        </form>

        <ul className="source-list">
          {sources.map((src) => (
            <li key={src.id}>
              <span className="source-label">{src.label}</span>
              <span className="source-id">{src.calendar_id}</span>
              <button className="delete" onClick={() => handleRemoveSource(src.id)}>
                移除
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h2>提醒通知</h2>
        <p className="settings-hint">
          提醒會用一個永遠置頂的小視窗跳出來(不是系統通知中心),不容易被忽略。
        </p>
        <div className="settings-actions">
          <button onClick={() => window.api.notifications.test()}>測試提醒通知</button>
        </div>
      </section>

      {general && (
        <section className="settings-section">
          <h2>外觀</h2>
          <p className="settings-hint">調整整個視窗的玻璃透明度,拖曳時會即時預覽。</p>
          <div className="settings-field">
            <label htmlFor="glass-opacity">
              透明度({Math.round(((0.9 - general.glassOpacity) / 0.6) * 100)}% 透明)
            </label>
            <input
              id="glass-opacity"
              type="range"
              min={0.3}
              max={0.9}
              step={0.02}
              value={general.glassOpacity}
              onChange={handleGlassPreview}
              onMouseUp={commitGlassOpacity}
              onTouchEnd={commitGlassOpacity}
              onKeyUp={commitGlassOpacity}
            />
          </div>
        </section>
      )}

      {general && (
        <section className="settings-section">
          <h2>一般</h2>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={general.openAtLogin}
              onChange={handleToggleOpenAtLogin}
            />
            開機時自動啟動(僅安裝版本生效,開發模式下只會保存設定)
          </label>

          <div className="settings-field">
            <label htmlFor="reminder-lead">待辦 / 行程提前提醒(分鐘)</label>
            <input
              id="reminder-lead"
              type="number"
              min={1}
              max={120}
              value={general.reminderLeadMinutes}
              onChange={handleReminderLeadInput}
              onBlur={commitReminderLead}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="digest-hour">每日總覽通知時間(0-23 時)</label>
            <input
              id="digest-hour"
              type="number"
              min={0}
              max={23}
              value={general.morningDigestHour}
              onChange={handleDigestHourInput}
              onBlur={commitDigestHour}
            />
          </div>

          {generalMessage && <p className="settings-message">{generalMessage}</p>}
        </section>
      )}
    </div>
  )
}
