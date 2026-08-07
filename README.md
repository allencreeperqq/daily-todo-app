# Daily Todo

個人化本地助理:待辦、日曆(含 Google 日曆同步)、記帳、固定提醒,並支援插件擴充。原始規劃見 [PLANNING.md](PLANNING.md)。

## 功能

### 今天 / 日曆(同一頁,右上角切換檢視)
- 預設打開是**月**檢視,一進來就看到整個月的行事曆。
- **今天**檢視:新增待辦(可設到期時間)、勾選完成、刪除,並列出今天的 Google 日曆行程(可個別刪除)。
- **月 / 週 / 日**檢視:傳統日曆格線,合併顯示待辦與 Google 日曆行程。月檢視點某一天可直接跳到那天的日檢視。日曆行程(含整天行程)都可以在週/日檢視個別刪除。
- **日檢視也能新增待辦**:不是只有「今天」分頁能新增,日檢視上方有一個小表單(標題 + 選填時間,預設早上 9 點),新增的待辦會掛在正在看的那一天,不限今天。這只是本地 `tasks` 表的資料,跟 Google 日曆完全無關——Google 那邊還是唯讀同步,刪除 Google 行程也還是只在本機標記隱藏(`hidden` 欄位),兩者都不會反過來動到 Google 日曆本身的資料。
- **跨天行程會顯示在每一天**:一個連續多天的 Google 行程(例如三天的旅遊)以前只會出現在開始那一天,現在 `buildAgenda()`(`Today.tsx`)會算出行程實際涵蓋的本地日期區間(`[開始日, 結束日)`,全天行程照 Google 的慣例把結束日當成不含),讓它出現在跨到的每一天。月檢視裡這種跨天行程會被固定排在每天清單的最上面(這樣才能對齊),而且中間的格子會把左右邊界的圓角去掉、延伸到格子邊緣(`.cell-item.multiday.flush-left` / `.flush-right`),同一週的格子橫向排起來時看起來就像一條連續的橫條;跨到下一週會自然斷開重新開始一條,跟 Google 日曆月檢視的畫法一致。

### 記事本
- 側邊欄在「記帳」跟「設定」中間,獨立一頁,左邊是筆記清單(按更新時間排序)、右邊是編輯區。
- 內容支援 Markdown,標題輸入框旁邊有「編輯 / 預覽」切換,預覽用 [`marked`](https://github.com/markedjs/marked) 轉成 HTML、[`DOMPurify`](https://github.com/cure53/DOMPurify) 過濾後才用 `dangerouslySetInnerHTML` 插入畫面(筆記內容雖然完全是自己寫的本機資料,不會被別人看到,但還是习慣性地不要對還沒清洗過的 HTML 掉以輕心)。
- 打字時每停頓 800ms 自動存檔(`AUTOSAVE_DELAY_MS`),不用手動按儲存;新增筆記後標題輸入框會自動 focus。
- 資料存在新的 `notes` 表(純文字 `title`/`content` 兩個欄位),繁體中文、英文都是原生 UTF-8 存取,沒有額外處理。

### 記帳
- 交易 CRUD(收入/支出、分類、備註、日期、支付方式),月份可左右切換。
- 分類支出用甜甜圈圖呈現(固定色階、通過色盲安全驗證),中間顯示本月總支出。
- 近半年收入/支出趨勢長條圖。
- 預算設定:每個分類可設每月上限,超支時進度條變紅。
- 「支付方式」管理(現金/銀行/信用卡,可自訂新增/刪除)放在頁面最下方「新增支付」區塊——不是核心操作,不用擋在交易明細前面。

### Google 日曆整合(唯讀同步)
- OAuth2(桌面應用程式的 loopback redirect 流程),需要你自己在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 建立憑證(見下方「設定 Google 日曆」)。
- 背景每 15 分鐘自動同步一次,同步範圍是「前 90 天到後 365 天」,涵蓋多個月份的日曆瀏覽。第一次同步會延後 3 秒才開始(見下方「開啟速度」),之後照原本的 15 分鐘週期跑。
- 預設只同步「主要日曆」,可以在「設定」頁貼其他日曆的 ID 加入同步(自己的次要日曆,或別人分享、你已接受邀請的日曆)。
- 手動同步按鈕在「設定」頁,同步失敗的日曆(例如 ID 打錯)會列出個別錯誤訊息,不會擋住其他日曆正常同步。
- 刪除某筆日曆行程只是**在這個 app 裡不再顯示**(因為只有唯讀權限,無法真的從 Google 刪除),下次同步也不會讓它重新出現。
- **時間一律正規化成 UTC 存進本機資料庫**:Google API 回傳的 `dateTime` 預設是行程自己的時區位移(例如 `+08:00`),不是 UTC。同步時(`googleCalendar.ts`)會把有時間的行程 `new Date(...).toISOString()` 轉成 UTC 再存;純日期的全天行程(`YYYY-MM-DD`,沒有時間/時區概念)維持原樣不轉換。這是為了修掉一個曾經讓下午/晚上的行程提醒完全不會響的 bug——見下方「已知問題與修復」。

### 提醒通知
- 待辦到期前、Google 行程開始前,會跳出一個**永遠置頂**的小視窗提醒(不是系統通知中心,不會被 Windows 的勿擾模式擋掉)。提前幾分鐘可在「設定 → 一般」調整(預設 10 分鐘)。
- 每天固定時間發一則今日總覽(幾個行程、幾件待辦),時間可在「設定 → 一般」調整(預設早上 8 點)。
- **記帳提醒**:如果當天到了設定的時間還沒記任何一筆收支,會跳一則「今天還沒有記錄任何收支」的提醒。預設開啟,預設時間晚上 9 點,可在「設定 → 一般」關閉或調整時間(`expenseReminderEnabled` / `expenseReminderHour`)。判斷邏輯跟每日總覽一樣,用本地日期比對當天的交易紀錄,不是看月份總表。
- 「設定」頁有「測試提醒通知」按鈕可以隨時預覽。

### 已知問題與修復:下午的提醒不會響
之前 Google 行程的提醒(`checkEventReminders`)、月/週/日檢視抓的行程列表(`listEvents()` 的 SQL 查詢)都用純文字比對 `start_at >= ? AND start_at < ?`,查詢邊界是 `now.toISOString()`(一定是 `...Z` 結尾的 UTC 字串),但存進資料庫的 `start_at` 卻是 Google 回傳的原始時區位移字串(例如 `2026-08-06T14:00:00+08:00`)。這兩種格式用文字排序比較是不可靠的——UTC+8 使用者的本地時間字面上的「小時」數字一定比同一時刻的 UTC 字串大 8,所以本地時間只要落在大約早上 8 點以後,行程的 `start_at` 文字幾乎永遠不會小於用 UTC 算出來的查詢上限,提醒因此幾乎不會觸發(不是精準卡在中午,是「本地時間越晚越容易中獎」,剛好使用者最常在下午/晚上碰到)。修法是在同步寫入時就把有時間的行程正規化成 UTC(見上面「Google 日曆整合」),讓存進資料庫的格式跟查詢邊界的格式永遠一致,純文字比較才會等於實際時間先後。連帶也把「每日總覽」判斷「今天」用的日期字串從 `now.toISOString().slice(0,10)`(會在本地時間凌晨 0 點到 8 點這段落後一天)改成用本地年月日組字串(`scheduler.ts` 的 `localDateKey()`)。

### 開啟速度
`startScheduler()` 啟動時原本會立刻打一次 Google 日曆同步(最多抓将近 1.25 年份的行程、多個日曆來源、同步的 SQLite 寫入),這段工作跟 renderer 剛開窗時第一次的 IPC 資料請求(`tasks:list`、`calendar:events:list`)搶同一條主行程 JS 執行緒,是開啟軟體感覺卡頓的主因之一。現在第一次同步會延後 3 秒(`INITIAL_CALENDAR_SYNC_DELAY_MS`)才開始,讓視窗先完成第一次繪製、renderer 先把初始資料拿到,之後每 15 分鐘一次的排程不受影響。

### 插件系統
- 把插件資料夾放進專案根目錄的 `plugins/` 即可載入,格式仿 Obsidian:`manifest.json`(id/name/version/main/**description**)+ 進入點模組(`export function onload(app) {...}`)。「插件」頁的每張卡片會顯示 `description` 這行簡短說明,按鈕一律顯示「啟動」(不管底層指令的實際 label 是什麼)。
- 插件可用的 API:`app.registerCommand()`(出現在系統匣選單與「插件」頁)、`app.showNotification()`、`app.openPanel(htmlOrUrl, options)`(開一個獨立小視窗,傳本地 HTML 相對路徑或 `http(s)://` 網址都可以,回傳該 `BrowserWindow`)、`app.storage`(插件專屬的 key-value 儲存)。插件是在主行程用 `import()` 載入,等於有完整 Node/Electron 權限(自己開子行程、call HTTP 都可以)——目前只用來跑自己寫的插件,還沒做沙箱隔離。
- **面板頁面可以呼叫回插件的主行程程式碼**:`openPanel(html, { methods })` 現在多一個選填的 `methods` 參數,是一個 `{ 方法名: (參數) => 結果 }` 的物件。面板本身沒有 Node 權限(`sandbox: true`,沒有掛 preload),所以像挑資料夾、讀檔案這種事沒辦法自己做——只要傳了 `methods`,`openPanel` 就會自動掛上 `resources/plugin-panel-preload.cjs`(純 CommonJS,因為 sandbox 模式的 preload 只吃 `require()`,吃不了這個專案預設的 ESM),讓面板頁面可以用 `window.plugin.invoke('方法名', ...參數)` 呼叫,實際會透過一個共用的 `ipcMain.handle('plugin-panel:invoke', ...)`、依呼叫者的 `webContents.id` 找到對應插件的 `methods` 物件執行(`api.ts`)。音樂播放器插件就是這樣做資料夾選擇跟掃描的。
- 內建範例插件 `plugins/metronome`:節拍器,BPM 滑桿 + Tap Tempo,用 Web Audio API 排點擊音。
- 內建插件 `plugins/music-player`:選一個資料夾,播放裡面的 `.wav`/`.flac`。「選擇資料夾」呼叫 `dialog.showOpenDialog`(主行程原生對話框,面板本身叫不動),掃到的檔案交給 [`music-metadata`](https://github.com/Borewit/music-metadata) 解析,秀出格式(WAVE/FLAC)、取樣率、位元深度、聲道數、時長、是否無損,以及 Vorbis Comment/ID3 讀到的標題/演出者/專輯。播放直接用面板頁面裡的原生 `<audio>` 元素,`src` 指到本機檔案的 `file://` 網址——面板雖然是 sandbox 過的視窗,但媒體元素載入 `file://` 資源不受限制,不用額外做串流/proxy。上一首/下一首、播完自動接下一首都有做;會記住上次選的資料夾(`app.storage`),下次打開自動重新掃描。
  - **已知限制:WAV 的中文標籤可能是亂碼**。FLAC 的 Vorbis Comment 規格明定是 UTF-8,中文標題/演出者/專輯都能正常讀出來;但 WAV 的 `LIST INFO` 標籤沒有統一編碼規範,實際寫入時常常是系統當下的 ANSI 內碼(例如 Windows 中文環境的 Big5),`music-metadata` 沒辦法知道該用哪個編碼去解——這不是這個插件能修的問題,連 VLC、Windows Media Player 遇到舊 WAV 標籤都一樣會亂碼。檔名本身沒有這個問題(檔案系統路徑一律是正確的 Unicode),所以沒有標籤或標籤解析失敗時,一律退回用檔名當標題。
  - **關於串流平台連動**:目前做的是「在 Spotify 搜尋」——用讀到的演出者+標題組成查詢字串,開瀏覽器到 Spotify 的搜尋頁(`shell.openExternal`),不需要任何金鑰或帳號授權。真的要做到「自動比對到 Spotify 曲目 / 加進播放清單」等更深的整合,需要註冊 Spotify 開發者 App、走 OAuth 流程(跟 Google 日曆那套差不多重),如果之後想做可以再說。
- 內建插件 `plugins/rvc-auto-machine`:把另一個專案([`RVC-auto-machine`](../RVC-auto-machine),UVR 人聲分離 + RVC 聲線訓練/推理的 Flask 網頁介面)包成一個指令。點「啟動」會(1)先 ping `127.0.0.1:5000` 看服務是否已在跑,沒有的話用 `shell:true` 呼叫 `python ui/app.py`(cwd 設成該專案根目錄)背景啟動,輪詢等它就緒;(2)開一個面板視窗載入這個網址,已經開著的話直接把視窗帶到前面而不是重開一個。這個插件的路徑是寫死的(`D:\coding\RVC-auto-machine`),因為只是個人串接自己另一個專案,不是給別人共用的插件。
  - **quit 時清掉背景行程**:app 結束時(`before-quit`)要用 `taskkill /pid <pid> /t /f` 砍掉整個 process tree,避免 Flask 開發伺服器變成孤兒行程。第一版直接在 `before-quit` 裡呼叫 `execFile`(非同步)但沒擋著 quit 流程,實測發現 Electron 可能在 taskkill 真的執行前就已經結束行程,導致 python.exe 孤兒程序殘留。修正方式是 `event.preventDefault()` 擋住這次 quit,等 `taskkill` 的 callback 真的觸發後才呼叫 `app.quit()` 繼續(這個 handler 會因此被呼叫兩次,但第二次 `serverProcess` 已經是 `null` 所以直接放行,不會卡死或無限迴圈)。
- 兩個純書籤型插件,`plugins/personal-website`(開啟個人網站 `personal-website.allencreeperqq.workers.dev`)、`plugins/github`(開啟 GitHub 個人頁 `github.com/allencreeperqq`):點指令直接 `openPanel(url)` 開一個面板視窗,已開著就把視窗帶到前面。改網址就直接改對應資料夾裡 `main.mjs` 開頭的 `URL` 常數。

### 外觀
- 視窗用純 `transparent: true` + `backgroundColor: '#00000000'` 做真正的視窗透明(`frame: false`、`roundedCorners: true`)。這台機器上 Windows 11 的 `backgroundMaterial: 'acrylic'` 完全不會生效(不管有沒有搭配 `transparent: true` 都一樣),已改用這個確認有效的方案。
- 介面卡片本身用 CSS `backdrop-filter: blur()` 做毛玻璃模糊,實際的透明/不透明程度由「設定 → 外觀」的滑桿即時調整(拖曳時會即時預覽,放開才寫入),存在 `settings` 表裡,重開 app 也會記得。
- 深色 / 淺色主題預設「跟隨系統」,也可以在「設定 → 外觀」手動切成固定淺色或深色(不想跟著系統變)。實作上是 `theme.ts` 把解析後的主題寫到 `<html data-theme="light|dark">`,CSS 用 `:root[data-theme='dark']` 覆蓋顏色變數(不再只靠 `prefers-color-scheme` media query),選「跟隨系統」時才會額外掛一個系統主題變化的監聽器即時反應。記帳頁的甜甜圈圖顏色也是跟著這個解析後的主題走,不是直接讀系統設定,不然手動切换主題時圖表顏色會跟介面對不上。
- 若整個視窗看起來完全不透明,檢查 Windows 設定裡「透明效果」有沒有開啟(設定 > 個人化 > 色彩),以及「省電模式」是否關閉(開啟省電模式時 Windows 11 會停用毛玻璃效果)。
- App 圖示只有一個來源檔案要換:換掉 `resources/icon.png`(視窗/工作列圖示用)後,重新產生 `resources/icon-16/32/48.png`(系統匣用)與 `resources/icon.ico`(桌面捷徑用)。因為視窗是 `frame: false` 自訂標題列,Windows 不會自動畫出原生標題列圖示,所以標題列左上角那個圖示是另外把 `resources/icon.png` 複製一份到 `src/renderer/src/assets/app-icon.png`、在 `TitleBar.tsx` 裡用 `<img>` 疊上去的——換圖示記得這份也要跟著複製更新,兩邊目前沒有自動同步。

### 一般設定
- 「設定 → 一般」可開關「開機時自動啟動」(`app.setLoginItemSettings`)。這個開關只在**打包安裝後的版本**才會真的註冊到 Windows 開機項目;開發模式(`npm run dev`/跑 `out/` 未打包版本)下只會保存這個選項的值,不會動到系統設定,避免把開機項目指向開發用的執行檔路徑。

### 設定頁的排版順序
由上到下刻意排成:**外觀 → 一般 → 提醒通知 → 日曆來源 → Google 日曆**。前面是整體使用體驗(透明度、主題、開機啟動、提醒時間),越常用越往上放;Google 帳密輸入(Client ID/Secret)最不常改、也最敏感,放在最下面。

## 開發

```bash
npm install
npm run dev
```

`npm run dev` 會啟動 Electron 視窗與 Vite 開發伺服器(含 HMR)。應用程式關閉視窗後會常駐在系統匣,可從匣圖示選單重新開啟或結束。

```bash
npm run build
```

編譯到 `out/`(main / preload / renderer),桌面捷徑與 `electron.exe .` 都是執行這裡的產物。

## 資料儲存

本地資料存放於 Electron 的 `userData` 目錄:`%APPDATA%\daily-todo\daily_todo.db`(SQLite),**不在專案資料夾內、不會被 git 追蹤**(`.gitignore` 已排除 `*.db*`)。首次啟動會自動套用 `migrations/` 內的 schema。

Google 日曆的 Client ID / Client Secret / OAuth token 存在這個資料庫的 `settings` 表,**以純文字儲存**(沒有另外加密)。這是刻意的選擇:桌面應用程式的 OAuth Client Secret 本來就不算真正機密(Google 官方文件也這樣說),而加密儲存曾經因為 app 被強制關閉導致 Windows 的加密金鑰檔案損毀,讓憑證變成解不開的亂碼、需要重新連接——純文字儲存換取的是不會再發生這種情況。

## 設定 Google 日曆

1. 到 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 建立專案,啟用 **Google Calendar API**。
2. 建立 OAuth 用戶端,類型選 **「電腦版應用程式」(Desktop app)**。
3. 把拿到的 Client ID、Client Secret 貼到「設定」頁,按「連接 Google 日曆」,在跳出的瀏覽器完成登入。
4. 之後可以在「設定」頁按「立即同步」手動更新,或等背景排程每 15 分鐘自動同步。

目前只做唯讀同步,不會修改你 Google 日曆上的任何內容。

## 桌面捷徑

專案根目錄的 `resources/icon.ico` 是桌面捷徑用的圖示。捷徑本身(`Daily Todo.lnk`)建立在使用者的 Desktop 資料夾,不屬於這個 git 專案的一部分,重建方式:

```powershell
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Daily Todo.lnk")
$Shortcut.TargetPath = "<專案路徑>\node_modules\electron\dist\electron.exe"
$Shortcut.Arguments = "."
$Shortcut.WorkingDirectory = "<專案路徑>"
$Shortcut.IconLocation = "<專案路徑>\resources\icon.ico"
$Shortcut.Save()
```

## 打包

尚未設定(未來加入 `electron-builder` 時再補上 `npm run build:win` 等腳本,目前都是跑編譯後的 `out/` 未打包版本)。
