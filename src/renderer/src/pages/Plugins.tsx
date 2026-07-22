import { useEffect, useState } from 'react'
import type { PluginsList } from '../../../shared/types'

export default function Plugins() {
  const [data, setData] = useState<PluginsList | null>(null)

  useEffect(() => {
    window.api.plugins.list().then(setData)
  }, [])

  if (!data) return <p className="loading">載入中...</p>

  return (
    <div className="plugins-page">
      <h1>插件</h1>

      {data.plugins.length === 0 && (
        <p className="empty">
          尚未安裝任何插件。把插件資料夾(含 <code>manifest.json</code>)放進專案的{' '}
          <code>plugins/</code> 目錄,重新啟動 app 即可載入。
        </p>
      )}

      <ul className="plugin-list">
        {data.plugins.map((plugin) => (
          <li key={plugin.id}>
            <div className="plugin-info">
              <span className="plugin-name">{plugin.name}</span>
              <span className="plugin-version">v{plugin.version}</span>
            </div>
            <div className="plugin-commands">
              {data.commands
                .filter((cmd) => cmd.pluginId === plugin.id)
                .map((cmd) => (
                  <button key={cmd.id} onClick={() => window.api.plugins.run(cmd.id)}>
                    {cmd.label}
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
