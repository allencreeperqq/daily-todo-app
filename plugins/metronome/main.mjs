export function onload(app) {
  app.registerCommand('open', '開啟節拍器', () => {
    app.openPanel('ui.html', {
      width: 280,
      height: 420,
      title: '節拍器',
      alwaysOnTop: true
    })
  })
}

export function onunload() {}
