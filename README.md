# Daily Todo

個人化本地助理:每日待辦、日曆整合、固定提醒、記帳,並預留插件系統與個人網站整合空間。詳細規劃見 [PLANNING.md](PLANNING.md)。

## 開發

```bash
npm install
npm run dev
```

`npm run dev` 會啟動 Electron 視窗與 Vite 開發伺服器(含 HMR)。應用程式關閉視窗後會常駐在系統匣,可從匣圖示選單重新開啟或結束。

## 資料庫

本地資料存放於 Electron 的 `userData` 目錄下的 `daily_todo.db`(SQLite),不會進入專案資料夾。首次啟動會自動套用 `migrations/` 內的 schema。

## 打包

尚未設定(未來加入 `electron-builder` 時再補上 `npm run build:win` 等腳本)。
