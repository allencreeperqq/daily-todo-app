import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import type { GoogleAuthStatus } from '../../../shared/types'

export default function Settings() {
  const [status, setStatus] = useState<GoogleAuthStatus | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refresh(): Promise<void> {
    setStatus(await window.api.calendar.getGoogleAuthStatus())
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
      setMessage(`已同步 ${result.count} 筆行程`)
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

  function openCredentialsConsole(e: MouseEvent): void {
    e.preventDefault()
    window.api.shell.openExternal('https://console.cloud.google.com/apis/credentials')
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
    </div>
  )
}
