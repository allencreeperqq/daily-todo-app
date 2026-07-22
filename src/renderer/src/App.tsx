import { useState } from 'react'
import Today from './pages/Today'

type PageKey = 'today' | 'finance' | 'settings' | 'plugins'

const NAV_ITEMS: { key: PageKey; label: string; enabled: boolean }[] = [
  { key: 'today', label: '今天', enabled: true },
  { key: 'finance', label: '記帳', enabled: false },
  { key: 'settings', label: '設定', enabled: false },
  { key: 'plugins', label: '插件', enabled: false }
]

export default function App() {
  const [page, setPage] = useState<PageKey>('today')

  return (
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
      <main className="content">{page === 'today' && <Today />}</main>
    </div>
  )
}
