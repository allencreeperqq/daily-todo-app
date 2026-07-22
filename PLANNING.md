# 個人化本地助理軟體 — 詳細規劃

> 目標:一套在 Windows 上常駐執行的本地軟體,整合「每日待辦」「Google / Apple 日曆」「固定提醒」「記帳」,並預留「插件系統」與「個人網站整合」的擴充空間。

---

## 1. 技術棧建議

| 項目 | 建議 | 原因 |
|---|---|---|
| 應用框架 | **Electron + TypeScript** | 常駐系統匣 (tray)、跨視窗、原生通知、開機自啟動都是一級公民支援;npm 生態齊全 (Google API SDK、CalDAV、排程、圖表)。 |
| 前端 UI | React + Vite (或 Svelte,喜好皆可) | 開發速度快,元件化適合多分頁 (Today / Calendar / Finance / Plugins)。 |
| 本地資料庫 | **SQLite (better-sqlite3)** | 單機、零設定、查詢語法與你個人網站的 **Cloudflare D1 (也是 SQLite)** 幾乎相同 — 未來要跟網站同步資料時,schema 和 migration 寫法可以直接沿用同一套邏輯。 |
| 排程/提醒 | 內建 Node `setInterval` + 簡單排程表,或 `node-cron` | 提醒邏輯本質是「每分鐘檢查一次到期項目」,不需要重量級排程框架。 |
| 通知 | Electron `Notification` API | 直接觸發 Windows 內建的 Action Center 通知,不用另外做 UI。 |

**替代方案(僅供參考,暫不建議作為起點):** Tauri (Rust 核心 + WebView) 體積更小、資源占用更低,但插件系統與系統層功能(如常駐、開機啟動)需要碰 Rust。考慮到你的個人網站 (`worker.js`) 是純 JS/SQL 寫法,Electron 路線跟你現有技能與程式碼風格銜接更順,先用 Electron 把產品做出來,之後若真的在意體積/效能,再評估是否用 Tauri 重寫核心。

---

## 2. 功能模組規劃

### 2.1 每日待辦 (Daily To-Do)
- CRUD:標題、備註、到期時間、優先級、分類/標籤、子任務。
- 重複規則(每天/每週/自訂 RRULE),逾期未完成自動捲動到「今天」。
- 「Today 首頁」統一顯示:待辦 + 日曆行程 + 記帳提醒,一頁看完今天的一切。

```sql
tasks(
  id, title, notes, due_at, priority,
  category, recurrence_rule,
  completed_at, source, -- 'local' | 'google' | 'icloud'
  created_at, updated_at
)
```

### 2.2 日曆整合 (Google)
- **Google Calendar**:OAuth2 (loopback redirect,`googleapis` 套件),用 `syncToken` 做增量同步,背景每 15 分鐘刷新一次 + 手動刷新按鈕。
- 本地維護一張 `events` cache table,合併 Google + 本地待辦成單一「今日議程」視圖。
- 先做「唯讀同步」較安全,雙向寫入之後再評估要不要做。
- ~~Apple / iCloud 日曆~~:使用者決定暫不需要,已移出目前開發範圍。日後若要加,做法是把 iCloud 當 CalDAV 帳號串接(用 App 專用密碼 + `tsdav`),跟 Google 是平行路徑,schema 不需為此重做。

### 2.3 提醒系統
- 背景常駐於系統匣,每分鐘掃描:即將到期的待辦、即將開始的行程、使用者自訂提醒規則(如「提前 10 分鐘」「提前 1 小時」)。
- 每天早上固定時間(可設定,如 08:00)發一則「今日總覽」通知:今天有幾個行程、幾個待辦、本月預算還剩多少。
- 通知支援「延後 10 分鐘」「標記完成」等快速動作按鈕。

### 2.4 記帳 / 開銷管控
```sql
accounts(id, name, type, balance)          -- 現金/銀行/信用卡
transactions(id, account_id, amount, category, note, type, occurred_at, created_at)
budgets(id, category, monthly_limit)
```
- 快速記帳:考慮做一個全域快捷鍵喚起的「懸浮輸入框」,不用切到主視窗就能記一筆。
- 月報表:分類長條圖 + 預算 vs 實際支出比較(可用 Recharts)。
- 之後可加 CSV 匯入(銀行對帳單)。

### 2.5 插件系統(仿 Obsidian 架構)
這是最適合「以後自己慢慢加功能」的設計方式 — Obsidian 的插件模式(純資料夾 + manifest + JS 進入點,無需重新編譯主程式)非常適合個人工具長期擴充。

```
plugins/
  metronome/
    manifest.json   -- { id, name, version, main: "main.js" }
    main.js         -- export function onload(app) { ... }
    ui.html         -- 節拍器介面
```

暴露給插件的 `PluginAPI`(在 preload/主程序定義,插件只能透過這層跟系統互動):
- `app.registerCommand(id, label, handler)` — 出現在 tray 選單或全域快捷鍵。
- `app.showNotification(text)`
- `app.openPanel(htmlPath, options)` — 開一個小型(可選 always-on-top)視窗,節拍器就是靠這個開出一個獨立小視窗,裡面用 Web Audio API 做 BPM 拍點聲音。
- `app.storage(pluginId)` — 給插件用的獨立資料存取區(命名空間化的 SQLite table 或 JSON),避免插件互相污染資料。

節拍器插件範例流程:tray 選單新增「開啟節拍器」→ 呼叫 `app.openPanel('ui.html')` → 開一個 200x300 的小視窗,裡面是 BPM 滑桿 + play/pause,用 `AudioContext` 排程精準拍點。之後可以依樣畫葫蘆做「番茄鐘」「白噪音」等其他小工具插件。

### 2.6 未來與個人網站整合
你的個人網站是 **Cloudflare Workers + D1(SQLite)+ R2**,走 REST API(`worker.js` 處理路由)。因為本地端也選用 SQLite,兩邊的資料模型與 SQL 語法幾乎共通,未來要做同步時阻力最小。建議現階段:
- 在本地 schema 預留 `updated_at`、`remote_id` 欄位,方便日後做增量同步,不需要現在就實作。
- 之後可以寫一支「匯出模組」,用 HTTPS 呼叫網站既有的 `worker.js` API,把想公開的資料(例如「本週待辦」小工具、記帳月報)推送到網站頁面。這階段先設計、不急著做。

---

## 3. 專案結構

```
daily_todo/
  package.json
  electron/
    main.ts              # tray、視窗管理、排程器啟動
    preload.ts            # contextBridge 給 renderer 的安全 API
    db.ts                  # SQLite 初始化 + migration runner
    scheduler.ts            # 提醒引擎
    calendar/
      google.ts
    plugins/
      loader.ts             # 插件掃描/載入/生命週期
      api.ts                 # PluginAPI 定義
  src/                        # renderer (React + TS)
    pages/ Today.tsx  Calendar.tsx  Tasks.tsx  Finance.tsx  Settings.tsx  Plugins.tsx
    components/
  migrations/                  # .sql 檔案,風格比照個人網站的 migrations/
  plugins/                       # 使用者安裝的插件放這裡(不進 src)
    metronome/
  PLANNING.md                     # 本文件
```

---

## 4. 分階段路線圖

| 階段 | 內容 |
|---|---|
| Phase 0 | 專案骨架:Electron + TS + Vite + React、git 初始化、tray icon、SQLite + migration runner |
| Phase 1 (MVP) | 待辦 CRUD、Today 頁面、純本地提醒通知、開機自啟動設定 |
| Phase 2 | 記帳模組:帳戶/交易/預算 CRUD、月報表圖表 |
| Phase 3 | Google 日曆整合(OAuth + 事件快取 + 提醒引擎納入日曆) |
| Phase 4 | 插件系統上線:loader + PluginAPI v1,並實作節拍器插件作為驗證案例 |
| Phase 5(未來) | 與個人網站的同步/發布模組 |

---

## 5. 待你確認的幾個方向(先給預設建議,若沒意見就照這個走)

1. **技術棧**:Electron(預設,開發快、與你現有 JS 技能銜接)vs Tauri(輕量但要碰 Rust)。
2. **UI 框架**:React(預設)vs Svelte/Vue — 憑個人喜好,跟功能規劃無關。
3. **Google 日曆同步方向**:先做唯讀(預設,較安全)還是一開始就要雙向寫入?
4. **記帳複雜度**:先做單一帳本(預設)還是一開始就要多帳戶/多幣別?
5. **是否要開機自動啟動 + 常駐系統匣**(預設是,因為提醒功能依賴這個)。

---

*下一步:確認以上方向後,即可開始 Phase 0 專案骨架建置。*
