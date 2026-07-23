# Daily Todo

個人化本地助理:待辦、日曆(含 Google 日曆同步)、記帳、固定提醒,並支援插件擴充。原始規劃見 [PLANNING.md](PLANNING.md)。

## 功能

### 今天 / 日曆(同一頁,右上角切換檢視)
- **今天**檢視:新增待辦(可設到期時間)、勾選完成、刪除,並列出今天的 Google 日曆行程(可個別刪除)。
- **月 / 週 / 日**檢視:傳統日曆格線,合併顯示待辦與 Google 日曆行程。月檢視點某一天可直接跳到那天的日檢視。日曆行程(含整天行程)都可以在週/日檢視個別刪除。

### 記帳
- 交易 CRUD(收入/支出、分類、備註、日期、帳戶),月份可左右切換。
- 帳戶可自訂新增(現金/銀行/信用卡),不是只有預設的「現金」。
- 分類支出用甜甜圈圖呈現(固定色階、通過色盲安全驗證),中間顯示本月總支出。
- 近半年收入/支出趨勢長條圖。
- 預算設定:每個分類可設每月上限,超支時進度條變紅。

### Google 日曆整合(唯讀同步)
- OAuth2(桌面應用程式的 loopback redirect 流程),需要你自己在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 建立憑證(見下方「設定 Google 日曆」)。
- 背景每 15 分鐘自動同步一次,同步範圍是「前 90 天到後 365 天」,涵蓋多個月份的日曆瀏覽。
- 預設只同步「主要日曆」,可以在「設定」頁貼其他日曆的 ID 加入同步(自己的次要日曆,或別人分享、你已接受邀請的日曆)。
- 手動同步按鈕在「設定」頁,同步失敗的日曆(例如 ID 打錯)會列出個別錯誤訊息,不會擋住其他日曆正常同步。
- 刪除某筆日曆行程只是**在這個 app 裡不再顯示**(因為只有唯讀權限,無法真的從 Google 刪除),下次同步也不會讓它重新出現。

### 提醒通知
- 待辦到期前、Google 行程開始前,會跳出一個**永遠置頂**的小視窗提醒(不是系統通知中心,不會被 Windows 的勿擾模式擋掉)。提前幾分鐘可在「設定 → 一般」調整(預設 10 分鐘)。
- 每天固定時間發一則今日總覽(幾個行程、幾件待辦),時間可在「設定 → 一般」調整(預設早上 8 點)。
- 「設定」頁有「測試提醒通知」按鈕可以隨時預覽。

### 插件系統
- 把插件資料夾放進專案根目錄的 `plugins/` 即可載入,格式仿 Obsidian:`manifest.json`(id/name/version/main)+ 進入點模組(`export function onload(app) {...}`)。
- 插件可用的 API:`app.registerCommand()`(出現在系統匣選單與「插件」頁)、`app.showNotification()`、`app.openPanel(htmlOrUrl, options)`(開一個獨立小視窗,傳本地 HTML 相對路徑或 `http(s)://` 網址都可以,回傳該 `BrowserWindow`)、`app.storage`(插件專屬的 key-value 儲存)。插件是在主行程用 `import()` 載入,等於有完整 Node/Electron 權限(自己開子行程、call HTTP 都可以)——目前只用來跑自己寫的插件,還沒做沙箱隔離。
- 內建範例插件 `plugins/metronome`:節拍器,BPM 滑桿 + Tap Tempo,用 Web Audio API 排點擊音。
- 內建插件 `plugins/rvc-auto-machine`:把另一個專案([`RVC-auto-machine`](../RVC-auto-machine),UVR 人聲分離 + RVC 聲線訓練/推理的 Flask 網頁介面)包成一個指令。點「開啟 RVC 自動化」會(1)先 ping `127.0.0.1:5000` 看服務是否已在跑,沒有的話用 `shell:true` 呼叫 `python ui/app.py`(cwd 設成該專案根目錄)背景啟動,輪詢等它就緒;(2)開一個面板視窗載入這個網址,已經開著的話直接把視窗帶到前面而不是重開一個。app 結束時(`before-quit`)會用 `taskkill /pid <pid> /t /f` 砍掉整個 process tree,避免 Flask 開發伺服器變成孤兒行程留在背景。這個插件的路徑是寫死的(`D:\coding\RVC-auto-machine`),因為只是個人串接自己另一個專案,不是給別人共用的插件。
- 兩個純書籤型插件,`plugins/personal-website`(開啟個人網站 `personal-website.allencreeperqq.workers.dev`)、`plugins/github`(開啟 GitHub 個人頁 `github.com/allencreeperqq`):點指令直接 `openPanel(url)` 開一個面板視窗,已開著就把視窗帶到前面。改網址就直接改對應資料夾裡 `main.mjs` 開頭的 `URL` 常數。

### 外觀
- 視窗用純 `transparent: true` + `backgroundColor: '#00000000'` 做真正的視窗透明(`frame: false`、`roundedCorners: true`)。這台機器上 Windows 11 的 `backgroundMaterial: 'acrylic'` 完全不會生效(不管有沒有搭配 `transparent: true` 都一樣),已改用這個確認有效的方案。
- 介面卡片本身用 CSS `backdrop-filter: blur()` 做毛玻璃模糊,實際的透明/不透明程度由「設定 → 外觀」的滑桿即時調整(拖曳時會即時預覽,放開才寫入),存在 `settings` 表裡,重開 app 也會記得。
- 深色 / 淺色模式自動跟隨系統。若整個視窗看起來完全不透明,檢查 Windows 設定裡「透明效果」有沒有開啟(設定 > 個人化 > 色彩),以及「省電模式」是否關閉(開啟省電模式時 Windows 11 會停用毛玻璃效果)。

### 一般設定
- 「設定 → 一般」可開關「開機時自動啟動」(`app.setLoginItemSettings`)。這個開關只在**打包安裝後的版本**才會真的註冊到 Windows 開機項目;開發模式(`npm run dev`/跑 `out/` 未打包版本)下只會保存這個選項的值,不會動到系統設定,避免把開機項目指向開發用的執行檔路徑。

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
