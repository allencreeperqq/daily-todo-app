import { BrowserWindow, screen } from 'electron'

const TOAST_WIDTH = 340
const TOAST_HEIGHT = 96
const TOAST_MARGIN = 16
const TOAST_GAP = 10
const TOAST_DURATION_MS = 6000

const openToasts: BrowserWindow[] = []

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildToastHtml(title: string, body: string): string {
  const safeTitle = escapeHtml(title)
  const safeBody = escapeHtml(body)
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; height: 100%; overflow: hidden;
    font-family: -apple-system, 'Segoe UI', 'Microsoft JhengHei', system-ui, sans-serif;
    background: transparent;
  }
  .toast {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 14px 16px;
    background: rgba(20, 22, 30, 0.92);
    border: 1px solid rgba(129, 140, 248, 0.45);
    border-radius: 12px;
    color: #e8e9ec;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(129, 140, 248, 0.08);
    position: relative;
    overflow: hidden;
    animation: slide-in 0.22s ease-out;
  }
  @keyframes slide-in {
    from { transform: translateX(24px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  .title { font-size: 0.85rem; font-weight: 700; color: #818cf8; }
  .body {
    font-size: 0.85rem; line-height: 1.4; overflow: hidden;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .bar {
    position: absolute; left: 0; bottom: 0; height: 3px; background: #818cf8;
    width: 100%; animation: countdown ${TOAST_DURATION_MS}ms linear forwards;
  }
  @keyframes countdown {
    from { width: 100%; }
    to { width: 0%; }
  }
</style></head>
<body>
  <div class="toast" onclick="window.close()">
    <div class="title">${safeTitle}</div>
    <div class="body">${safeBody}</div>
    <div class="bar"></div>
  </div>
</body></html>`
}

function repositionToasts(): void {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea
  openToasts.forEach((win, index) => {
    if (win.isDestroyed()) return
    win.setBounds({
      x: x + width - TOAST_WIDTH - TOAST_MARGIN,
      y: y + height - TOAST_MARGIN - (TOAST_HEIGHT + TOAST_GAP) * (index + 1),
      width: TOAST_WIDTH,
      height: TOAST_HEIGHT
    })
  })
}

// A custom always-on-top popup, rather than relying on the OS notification
// center — native toasts are easy to miss (Focus Assist, quiet history) and
// this is meant to be genuinely hard to overlook.
export function showToast(title: string, body: string): void {
  const win = new BrowserWindow({
    width: TOAST_WIDTH,
    height: TOAST_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: { sandbox: true }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.loadURL(`data:text/html,${encodeURIComponent(buildToastHtml(title, body))}`)

  openToasts.push(win)
  repositionToasts()
  win.showInactive()

  const closeTimer = setTimeout(() => {
    if (!win.isDestroyed()) win.close()
  }, TOAST_DURATION_MS)

  win.on('closed', () => {
    clearTimeout(closeTimer)
    const idx = openToasts.indexOf(win)
    if (idx !== -1) openToasts.splice(idx, 1)
    repositionToasts()
  })
}

// Force-destroy any open toasts before the app tears down. A toast is
// alwaysOnTop at the 'screen-saver' level and non-focusable; leaving one
// open can otherwise stall Electron's normal close-then-quit sequence.
export function closeAllToasts(): void {
  for (const win of openToasts) {
    if (!win.isDestroyed()) win.destroy()
  }
  openToasts.length = 0
}
