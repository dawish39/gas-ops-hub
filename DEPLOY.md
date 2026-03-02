# 部署指南

部署 gas-ops-hub 不需要準備伺服器，只需透過 Google Apps Script (GAS) 搭配 `clasp` 工具即可完成。

---

## 系統特色

* **無伺服器架構 (Serverless)**：完全基於 Google Apps Script，直接利用現有 Google 帳號運行，無需額外主機成本。
* **雙介面協作**：LINE Bot 行動端即時登打（巡檢、突發任務）；Web GUI 電腦端綜合管理（儀表板、狀態更新、報表分析）。
* **實戰驗證**：於真實飯店環境穩定運行超過六個月，累積處理數千筆維運紀錄。
* **自動化核心**：整合工單管理、日報自動產出與寄送、數據分析。

---

## 技術架構

| 項目 | 說明 |
| :--- | :--- |
| API 容量 | 每日可承受 100,000 次 URL Fetch（LINE 訊息互動） |
| 寫入效能 | 使用 LockService 處理併發請求，單次寫入約 1~3 秒 |
| 讀取優化 | Web GUI 實作 CacheService 與分頁限制（Limit 2000），加速儀表板載入 |
| 運算核心 | 模組化設計（`api_line_bot.js`、`api_web_gui.js`、`dao.js`），職責分離易於維護 |

> 適用於一般中小企業或部門內部使用，效能受限於 Google Sheets 讀寫速度。

---

## 前置需求

* Node.js v14 以上
* 一個 Google 帳號

---

## 第一階段：環境準備

**1. 開啟 GAS API 權限**
前往 [script.google.com/home/settings](https://script.google.com/home/settings)，確認「Google Apps Script API」已開啟。

**2. 安裝 clasp**
```bash
npm install -g @google/clasp

```

**3. 登入 Google 帳號**

```bash
clasp login

```

執行後會自動開啟瀏覽器，登入要用來部署的 Google 帳號並授予權限。

---

## 第二階段：建立專案並推送程式碼

**1. Clone 專案到本地**

```bash
git clone [https://github.com/dawish39/gas-ops-hub.git](https://github.com/dawish39/gas-ops-hub.git)
cd gas-ops-hub

```

**2. 設定 `.clasp.json**`
前往 [script.google.com](https://script.google.com) 手動建立新專案，取得 Script ID，在專案根目錄建立 `.clasp.json`：

```json
{
  "scriptId": "你的 Script ID",
  "rootDir": "./"
}

```

> **注意：** 建議手動設定以避免環境衝突。

**3. 推送程式碼**

```bash
clasp push

```

---

## 第三階段：發布為 Web App

1. 開啟 GAS 專案，點擊右上角「部署」→「新增部署作業」。
2. 類型選擇「網頁應用程式」。
3. 執行身分選「我 (Me)」，存取權選「擁有 Google 帳號的任何人」。
4. 點擊「部署」，取得 Web App URL。

---

## 第四階段：系統初始化 (Onboarding)

首次開啟 Web App URL 時，系統會自動進入 Setup 初始化畫面。

**執行「開始初始化」：**
系統會自動在 Google Drive 產生資料夾結構、建立資料來源 Sheets、部署日報範本並寫入 Script Properties。

### 安全機制：Setup Guard

系統會檢查 `MAIN_CONFIG_SPREADSHEET_ID` 是否已存在，若存在則阻擋重複初始化以防止覆蓋設定。

---

## 第五階段：營運參數設定

初始化完成後，需於 Config 試算表中設定：

1. **日報收件人**：`Email` 工作表設定收件人與副本。
2. **LINE Bot 白名單**：將 User ID 加入 `LINE_ALLOWED_USERS` 屬性。
3. **組織與分類架構**：編輯 `Department`、`CategoryCodeMap` 等工作表。
4. **每日觸發器**：於 GAS 後台啟用 `dailyJob` 觸發器。

---

## 維護與除錯

* **UUID 追蹤**：每筆紀錄皆配有唯一識別碼，請勿手動修改。
* **除錯模式**：至 GAS 編輯器的「執行項目」查看詳細 Log。

---

## 上線 Checklist

* [ ] Web App URL 是否可正常存取？
* [ ] LINE Bot 是否能正確回應？
* [ ] Email 收件人是否已設定？
* [ ] 每日觸發器 (Trigger) 是否已啟用？


將此內容覆蓋至專案根目錄的 `DEPLOY.md` 文件中。

```
