import appIcon from '../assets/app-icon.png'

export default function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <img className="titlebar-icon" src={appIcon} alt="" />
        <span className="titlebar-title">Daily Todo</span>
      </div>
      <div className="titlebar-buttons">
        <button
          className="titlebar-btn"
          onClick={() => window.api.window.minimize()}
          aria-label="最小化"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="titlebar-btn close"
          onClick={() => window.api.window.close()}
          aria-label="關閉"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 0L10 10M10 0L0 10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
