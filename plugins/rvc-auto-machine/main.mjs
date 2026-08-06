import { spawn, execFile } from 'node:child_process'
import http from 'node:http'
import { app as electronApp } from 'electron'

// RVC-auto-machine lives outside this repo as its own separate project;
// its Flask UI expects to be launched with this as the cwd (README: `python ui/app.py`).
const RVC_ROOT = 'D:\\coding\\RVC-auto-machine'
const PORT = 5000
const BASE_URL = `http://127.0.0.1:${PORT}`

let serverProcess = null
let startingPromise = null
let panelWindow = null

function pingServer(timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(BASE_URL, { timeout: timeoutMs }, (res) => {
      res.resume()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitForServer(maxAttempts = 40, intervalMs = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await pingServer()) return true
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

function spawnServer() {
  // shell:true so Windows resolves `python` off PATH the same way a manual
  // terminal invocation would (matches how the RVC-auto-machine README says to run it).
  // Single command string (not an args array) avoids Node's shell-escaping
  // deprecation warning — safe here since nothing in it is user input.
  const child = spawn('python ui/app.py', {
    cwd: RVC_ROOT,
    shell: true,
    windowsHide: true
  })
  child.stdout?.on('data', (d) => console.log(`[rvc-auto-machine] ${d.toString().trim()}`))
  child.stderr?.on('data', (d) => console.error(`[rvc-auto-machine] ${d.toString().trim()}`))
  child.on('exit', (code) => {
    console.log(`[rvc-auto-machine] server process exited (code ${code})`)
    serverProcess = null
  })
  child.on('error', (err) => {
    console.error('[rvc-auto-machine] failed to spawn server', err)
    serverProcess = null
  })
  return child
}

function killServer(onDone) {
  const pid = serverProcess?.pid
  serverProcess = null
  if (!pid) {
    onDone?.()
    return
  }
  // spawn() was called with shell:true, so `pid` is cmd.exe's pid, not python's —
  // /t kills the whole descendant tree so the actual python.exe doesn't linger.
  execFile('taskkill', ['/pid', String(pid), '/t', '/f'], () => onDone?.())
}

async function ensureServerRunning() {
  if (await pingServer()) return true
  if (!startingPromise) {
    startingPromise = (async () => {
      serverProcess = spawnServer()
      const ok = await waitForServer()
      startingPromise = null
      return ok
    })()
  }
  return startingPromise
}

export function onload(app) {
  app.registerCommand('open', '開啟 RVC 自動化', async () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.show()
      panelWindow.focus()
      return
    }

    app.showNotification('正在啟動 RVC 自動化服務,請稍候...')
    const ok = await ensureServerRunning()
    if (!ok) {
      app.showNotification('RVC 服務啟動失敗,請確認 python 環境是否正常(可看終端機 log)。')
      return
    }

    panelWindow = app.openPanel(BASE_URL, {
      width: 1200,
      height: 860,
      title: 'RVC 自動化'
    })
    panelWindow.on('closed', () => {
      panelWindow = null
    })
  })

  // execFile('taskkill', ...) is async — without preventDefault(), Electron can
  // finish quitting before the kill even gets scheduled, leaving python.exe
  // orphaned. Delay the actual quit until the tree is confirmed dead, then
  // re-trigger it (this handler runs again, but serverProcess is already
  // cleared by then so it's a no-op the second time through).
  electronApp.on('before-quit', (event) => {
    if (!serverProcess) return
    event.preventDefault()
    killServer(() => electronApp.quit())
  })
}

export function onunload() {
  killServer()
}
