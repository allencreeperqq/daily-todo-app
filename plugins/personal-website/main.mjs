const URL = 'https://personal-website.allencreeperqq.workers.dev'

let panelWindow = null

export function onload(app) {
  app.registerCommand('open', '開啟個人網站', () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.show()
      panelWindow.focus()
      return
    }
    panelWindow = app.openPanel(URL, {
      width: 1200,
      height: 860,
      title: '個人網站'
    })
    panelWindow.on('closed', () => {
      panelWindow = null
    })
  })
}
