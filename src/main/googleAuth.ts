import { OAuth2Client, type Credentials } from 'google-auth-library'
import { shell } from 'electron'
import http from 'node:http'
import { getJsonSetting, getSetting, setJsonSetting, setSetting } from './settings'

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
const AUTH_TIMEOUT_MS = 120_000

function getClientConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = getSetting('google_client_id')
  const clientSecret = getSetting('google_client_secret')
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function isGoogleConfigured(): boolean {
  return getClientConfig() !== null
}

export function isGoogleConnected(): boolean {
  return getJsonSetting<Credentials>('google_tokens') !== null
}

export function setGoogleClientConfig(clientId: string, clientSecret: string): void {
  setSetting('google_client_id', clientId)
  setSetting('google_client_secret', clientSecret)
}

export function disconnectGoogleAccount(): void {
  setSetting('google_tokens', null)
}

function waitForAuthorizationCode(
  clientId: string
): Promise<{ code: string; redirectUri: string }> {
  return new Promise((resolve, reject) => {
    let redirectUri = ''
    let settled = false

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        error
          ? '<h1>授權失敗</h1><p>你可以關閉這個頁面,回到 Daily Todo 重試。</p>'
          : '<h1>已完成授權</h1><p>你可以關閉這個頁面,回到 Daily Todo。</p>'
      )

      if (settled) return
      settled = true
      server.close()

      if (error || !code) {
        reject(new Error(error ?? '未取得授權碼'))
        return
      }
      resolve({ code, redirectUri })
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (typeof address !== 'object' || address === null) {
        settled = true
        reject(new Error('無法啟動本地授權伺服器'))
        return
      }
      redirectUri = `http://127.0.0.1:${address.port}`
      const authClient = new OAuth2Client({ clientId, redirectUri })
      const authUrl = authClient.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES
      })
      shell.openExternal(authUrl)
    })

    setTimeout(() => {
      if (settled) return
      settled = true
      server.close()
      reject(new Error('授權逾時,請再試一次'))
    }, AUTH_TIMEOUT_MS)
  })
}

export async function connectGoogleAccount(): Promise<void> {
  const config = getClientConfig()
  if (!config) throw new Error('請先儲存 Google Client ID 與 Client Secret')

  const { code, redirectUri } = await waitForAuthorizationCode(config.clientId)
  const client = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri
  })
  const { tokens } = await client.getToken(code)
  setJsonSetting('google_tokens', tokens)
}

export async function getAuthorizedClient(): Promise<OAuth2Client> {
  const config = getClientConfig()
  if (!config) throw new Error('尚未設定 Google Client ID / Secret')
  const tokens = getJsonSetting<Credentials>('google_tokens')
  if (!tokens) throw new Error('尚未連接 Google 帳號')

  const client = new OAuth2Client({ clientId: config.clientId, clientSecret: config.clientSecret })
  client.setCredentials(tokens)
  client.on('tokens', (newTokens) => {
    setJsonSetting('google_tokens', { ...tokens, ...newTokens })
  })
  return client
}
