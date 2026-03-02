# 部署指南

部署 gas-ops-hub 不需要準備伺服器，只需透過 Google Apps Script (GAS) 即可完成。

---

## 選擇部署方式

| | 快速試用 | 正式部署 |
|---|---|---|
| **方式** | 一鍵複製 GAS 專案 | clasp + GitHub |
| **適合** | 想先看看系統長什麼樣 | 實際用在工作環境 |
| **版本更新** | 不同步，快照版本 | 跟隨 GitHub 最新版 |
| **問題回報** | 不提供個別除錯支援 | Issue / PR 走 GitHub |
| **時間** | 5 分鐘 | 30 分鐘 |

### 快速試用（一鍵複製）

點擊以下連結，系統會在你的 Google Drive 建立一份專案副本，跳過所有環境設定：

**[→ 建立 gas-ops-hub 副本](https://script.google.com/d/[SCRIPT_ID]/copy)**

複製完成後直接部署為 Web App，Onboarding 畫面會引導完成剩餘設定。

> **注意：** 一鍵複製為試用沙盒，版本不保證與 GitHub 同步。若要用於正式環境或參與開發，請使用下方的 clasp 流程。

---

## 系統特色

**無伺服器架構 (Serverless)**
完全基於 Google Apps Script，直接利用現有 Google 帳號運行，無需額外主機成本。

**雙介面協作**
LINE Bot 行動端即時登打（巡檢、突發任務）；Web GUI 電腦端綜合管理（儀表板、狀態更新、報表分析）。

**實戰驗證**
於真實飯店環境穩定運行超過六個月，累積處理數千筆維運紀錄。

**自動化核心**
整合工單管理、日報自動產出與寄送、數據分析。

---

## 技術架構

| 項目 | 說明 |
|------|------|
| API 容量 | 每日可承受 100,000 次 URL Fetch（LINE 訊息互動） |
| 寫入效能 | 使用 LockService 處理併發請求，單次寫入約 1~3 秒 |
| 讀取優化 | Web GUI 實作 CacheService 與分頁限制（Limit 2000），加速儀表板載入 |
| 運算核心 | 模組化設計（`api_line_bot.js`、`api_web_gui.js`、`dao.js`），職責分離易於維護 |

> 適用於一般中小企業或部門內部使用，效能受限於 Google Sheets 讀寫速度。

---

## 前置需求

- Node.js v14 以上
- 一個 Google 帳號

---

## 第一階段：環境準備

**1. 開啟 GAS API 權限**

前往 [script.google.com/home/settings](https://script.google.com/home/settings)，確認「Google Apps Script API」已開啟。新帳號預設是關閉的，需手動打開。

**2. 安裝 clasp**

```bash
npm install -g @google/clasp
```

**3. 登入 Google 帳號**

```bash
clasp login
```

執行後會自動開啟瀏覽器，登入要用來部署的 Google 帳號並授予權限，完成後終端機會顯示登入成功訊息。

---

## 第二階段：建立專案並推送程式碼

**1. Clone 專案到本地**

```bash
git clone https://github.com/dawish39/gas-ops-hub.git
cd gas-ops-hub
```

**2. 建立 GAS 專案並設定 `.clasp.json`**

前往 [script.google.com](https://script.google.com) 手動建立新專案，取得 Script ID（位於「專案設定」頁面），在專案根目錄建立 `.clasp.json`：

```json
{
  "scriptId": "你的 Script ID",
  "rootDir": "./"
}
```

> **注意：** 建議直接手動設定 `.clasp.json` 而非使用 `clasp create`，可避免與 gas-guard 的環境衝突。

**3. 推送程式碼**

```bash
clasp push
```

推送成功後，可在 GAS 網頁編輯器中看到所有 `.js` 檔案。

---

## 第三階段：發布為 Web App

1. 前往 [script.google.com](https://script.google.com)，開啟你的 GAS 專案
2. 點擊右上角「部署」→「新增部署作業」
3. 類型選擇「網頁應用程式」
4. 執行身分選「我 (Me)」，存取權選「擁有 Google 帳號的任何人」
5. 點擊「部署」，取得 Web App URL

> ⚠️ **URL 即憑證 (URL is Credential)**
> GAS Web App 本身無登入驗證，擁有網址即擁有存取權。請勿將 Web App URL 張貼於公開頻道，僅分享給授權的 IT 成員。

---

## 第四階段：系統初始化 (Onboarding)

首次開啟 Web App URL 時，系統會自動進入 Setup 初始化畫面。

**選填設定：**
- `LINE Channel Access Token`：啟用 LINE Bot 登打功能
- `Gemini API Key`：啟用 AI 自然語言解析功能

**執行「開始初始化」：**

點擊後系統會自動在背景完成以下配置：

1. 建立資料夾結構：在 Google Drive 產生 `0_Config`、`1_DataSources`、`2_Reports`、`3_Analytics`
2. 生成資料來源：自動建立 repair（報修）、daily（日報）、needs（需求）三份 Google Sheets
3. 部署範本：自動建立每日日報的 Google Doc 範本
4. 寫入設定：將所有 ID 寫入 Script Properties

完成後出現 Onboarding modal，提供 Config 試算表連結，後續設定從這裡進入。

### 安全機制：Setup Guard

系統啟動時會檢查 `MAIN_CONFIG_SPREADSHEET_ID` 是否已存在：
- 已存在 → 阻擋初始化請求，防止誤操作覆蓋現有設定
- 不存在 → 允許執行初始化流程

> ⚠️ **緊急重設（危險操作）**
> 若需強制重設，需手動至 GAS 後台「指令碼屬性」刪除 `MAIN_CONFIG_SPREADSHEET_ID`，並重新整理網頁。

---

## 第五階段：營運參數設定

初始化完成後，還有幾項設定需要手動補齊：

**1. 設定日報收件人**

開啟 Config 試算表 → `Email` 工作表，填入：
- `recipient`：主收件人 Email
- `cc`：副本（多個以逗號分隔，選填）
- `senderName`：寄件者顯示名稱

**2. 設定 LINE Bot 白名單（若有啟用）**

基於安全性，僅允許白名單內的 User ID 透過 LINE 寫入資料。目前需手動將成員的 LINE User ID 加入 `LINE_ALLOWED_USERS` 屬性（未來版本將提供 Admin UI）。

**3. 自訂組織與分類架構**

編輯 Config 試算表中的以下工作表：
- `Department`：定義組織架構（部、組），用於報修單位選單
- `CategoryCodeMap`：定義主分類（如電腦設備、網路設備）
- `RepairCategory` / `NeedsCategory`：定義詳細子項目（如無法開機、IP 衝突）

> ⚠️ **請勿更動工作表名稱**，僅修改表內數據以符合實際業務需求。

**4. 設定每日觸發器**

前往 GAS 編輯器 →「觸發條件」→ 新增時間驅動觸發器，啟用 `dailyJob` 進行每日自動報表寄送。

---

## 維護與除錯

**UUID 追蹤**
每筆紀錄皆配有唯一識別碼，確保資料連結正確。請勿手動修改 UUID 欄位。

**除錯模式**
若遇系統錯誤，請至 GAS 編輯器的「執行項目 (Executions)」查看詳細 Log 與 Stack Trace。

**效能監控**
若儀表板載入變慢，可檢查 daily 或 repair 試算表是否累積過多歷史資料（建議定期封存）。

---

## 上線 Checklist

- [ ] Web App URL 是否可正常存取？
- [ ] LINE Bot 是否能正確回應訊息並寫入 Google Sheets？
- [ ] Config Sheet 中的 Email 收件人是否已設定？
- [ ] 每日觸發器 (Trigger) 是否已啟用？
