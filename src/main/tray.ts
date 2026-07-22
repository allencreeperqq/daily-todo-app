import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import type { PluginCommand } from './plugins/api'

export function createTray(
  onShowWindow: () => void,
  onQuit: () => void,
  pluginCommands: PluginCommand[]
): Tray {
  const iconPath = join(__dirname, '../../resources/icon-32.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  const tray = new Tray(icon)
  tray.setToolTip('Daily Todo')

  const menuTemplate: MenuItemConstructorOptions[] = [{ label: '開啟主視窗', click: onShowWindow }]

  if (pluginCommands.length > 0) {
    menuTemplate.push(
      { type: 'separator' },
      {
        label: '插件',
        submenu: pluginCommands.map((cmd) => ({ label: cmd.label, click: cmd.handler }))
      }
    )
  }

  menuTemplate.push({ type: 'separator' }, { label: '結束', click: onQuit })

  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate))
  tray.on('click', onShowWindow)

  return tray
}
