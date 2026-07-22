import { Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'

export function createTray(onShowWindow: () => void, onQuit: () => void): Tray {
  const iconPath = join(__dirname, '../../resources/icon-32.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  const tray = new Tray(icon)
  tray.setToolTip('Daily Todo')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '開啟主視窗', click: onShowWindow },
      { type: 'separator' },
      { label: '結束', click: onQuit }
    ])
  )
  tray.on('click', onShowWindow)

  return tray
}
