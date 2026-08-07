import { useLayoutEffect, useState } from 'react'
import Today from './pages/Today'
import Finance from './pages/Finance'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import Plugins from './pages/Plugins'
import TitleBar from './components/TitleBar'
import { applyGlassOpacity } from './glass'
import { applyThemeMode } from './theme'

type PageKey = 'today' | 'finance' | 'notes' | 'settings' | 'plugins'

const NAV_ITEMS: { key: PageKey; label: string; enabled: boolean }[] = [
  { key: 'today', label: '今天', enabled: true },
  { key: 'finance', label: '記帳', enabled: true },
  { key: 'notes', label: '記事本', enabled: true },
  { key: 'settings', label: '設定', enabled: true },
  { key: 'plugins', label: '插件', enabled: true }
]

export default function App() {
  const [page, setPage] = useState<PageKey>('today')

  useLayoutEffect(() => {
    window.api.settings.getGeneral().then((s) => {
      applyGlassOpacity(s.glassOpacity)
      applyThemeMode(s.themeMode)
    })
  }, [])

  return (
    <div className="app-root">
      <TitleBar />
      <div className="app-shell">
        <nav className="sidebar">
          <div className="brand">Daily Todo</div>
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <button
                  className={item.key === page ? 'active' : ''}
                  disabled={!item.enabled}
                  onClick={() => setPage(item.key)}
                >
                  {item.label}
                  {!item.enabled && <span className="badge">即將推出</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="content">
          {page === 'today' && <Today />}
          {page === 'finance' && <Finance />}
          {page === 'notes' && <Notes />}
          {page === 'settings' && <Settings />}
          {page === 'plugins' && <Plugins />}
        </main>
      </div>
    </div>
  )
}
