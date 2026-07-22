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
- 待辦到期前 10 分鐘、Google 行程開始前 10 分鐘,會跳出一個**永遠置頂**的小視窗提醒(不是系統通知中心,不會被 Windows 的勿擾模式擋掉)。
- 每天早上 8 點發一則今日總覽(幾個行程、幾件待辦)。
- 「設定」頁有「測試提醒通知」按鈕可以隨時預覽。

### 插件系統
- 把插件資料夾放進專案根目錄的 `plugins/` 即可載入,格式仿 Obsidian:`manifest.json`(id/name/version/main)+ 進入點模組(`export function onload(app) {...}`)。
- 插件可用的 API:`app.registerCommand()`(出現在系統匣選單與「插件」頁)、`app.showNotification()`、`app.openPanel()`(開一個獨立小視窗)、`app.storage`(插件專屬的 key-value 儲存)。
- 內建範例插件 `plugins/metronome`:節拍器,BPM 滑桿 + Tap Tempo,用 Web Audio API 排點擊音。

### 外觀
- Windows 11 原生 acrylic 毛玻璃背景(`backgroundMaterial: 'acrylic'` + `backgroundColor: '#00000000'`)。**注意:`transparent: true` 絕對不要跟 `backgroundMaterial` 一起設定**——這是 Electron 社群已知的地雷組合,會讓 Aero Snap、視窗陰影失效,甚至讓毛玻璃效果整個不出現;只靠 alpha 為 0 的 `backgroundColor` 就足夠讓 DWM 畫出材質了。
- 介面採半透明玻璃卡片風格,自訂無邊框標題列(可拖曳、最小化/關閉按鈕)。
- 深色 / 淺色模式自動跟隨系統。若還是看起來完全不透明,檢查 Windows 設定裡「透明效果」有沒有開啟(設定 > 個人化 > 色彩),以及「省電模式」是否關閉(開啟省電模式時 Windows 11 會停用毛玻璃效果)。

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
