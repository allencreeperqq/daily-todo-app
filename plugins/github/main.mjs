// Defaults to your own profile rather than the bare github.com homepage —
// change this if you'd rather it land somewhere else (a specific repo, etc).
const URL = 'https://github.com/allencreeperqq'

let panelWindow = null

export function onload(app) {
  app.registerCommand('open', '開啟 GitHub', () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.show()
      panelWindow.focus()
      return
    }
    panelWindow = app.openPanel(URL, {
      width: 1200,
      height: 860,
      title: 'GitHub'
    })
    panelWindow.on('closed', () => {
      panelWindow = null
    })
  })
}
