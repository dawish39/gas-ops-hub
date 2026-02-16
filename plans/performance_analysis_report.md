# 專案性能分析報告：冷啟動與 I/O 瓶頸

## 1. 需求本質重述 (Core Goal Restatement)
用戶回報 Web GUI 首次載入慢、Line Bot 響應慢的問題。核心目標是診斷 Google Apps Script (GAS) 環境中常見的性能瓶頸，並提出優化策略。

## 2. 顧問式挑戰 (Mandatory Challenge)
儘管已實施 DAO 架構優化，但性能瓶頸依然存在。這並非程式碼邏輯的錯誤，而是 **Google Apps Script 的底層運行特性**。我們必須區分 **Cold Start (冷啟動)** 與 **Hot Run (熱運行)** 的性能差異。

### 瓶頸診斷
1.  **Web GUI / 首次載入慢 (Cold Start)：**
    *   **原因：** 首次調用 Web App 或長時間閒置後，GAS 必須從零開始載入執行環境、初始化所有全域變數和物件（包括您在 [`src/config.js`](src/config.js:1) 和 [`src/dao.js`](src/dao.js:1) 中定義的 Class 實例），並執行第一次 `SpreadsheetApp.openById()` 等重量級 API 呼叫。這個初始化過程會產生數秒到十數秒的延遲。
    *   **DAO 影響：** DAO 模式雖然在邏輯上優化了代碼，但其建構子 (Constructor) 中對 `PropertiesService` 和 `SpreadsheetApp` 的呼叫，增加了冷啟動時的初始化負載。
2.  **Line Bot 響應慢 (I/O Latency)：**
    *   **原因：** Line Webhook 必須在短時間內響應（通常約 5 秒），否則 Line 平台會判定為超時。
    *   您的 [`src/api_line_bot.js`](src/api_line_bot.js:1) 內部的 `writeToWorkLogSheet` 函式在單次 Webhook 處理中，需要執行數次 I/O 操作 (e.g., `readConfig()`, `getLogEntryDAO().getSheet()`, `sheet.getLastRow()`, `sheet.getRange().getValues()`, `sheet.getRange().setValue()`, `SpreadsheetApp.flush()`)。即使使用了批次讀取 (Bulk Read)，但每一次服務呼叫（例如 `SpreadsheetApp.openById`）都是獨立且昂貴的。

## 3. 執行藍圖：架構優化策略 (不改 Code)

針對上述瓶頸，在不修改現有業務邏輯的前提下，建議採取以下 GAS 環境級優化：

### 策略一：解決冷啟動問題 (Keep-Alive Trigger)
目標：確保 GAS 實例始終保持熱運行狀態。

1.  **建立外部排程：** 使用 Google Cloud Platform (GCP) 的 Cloud Scheduler 或一個簡單的外部 Cron 服務，設定每 5-10 分鐘對部署後的 Web App URL (Exec URL) 發送一次簡單的 GET 請求。
2.  **結果：** 這將強制 GAS 實例保持活躍，避免使用者首次訪問時遇到的初始化延遲。

### 策略二：解決 Line Bot I/O 延遲問題 (Asynchronous Delegation)
目標：讓 Line Bot 立即響應，將耗時的寫入工作轉移至後台執行。

1.  **非同步觸發機制：** 調整 [`src/api_line_bot.js`](src/api_line_bot.js:1) 中的 `processUserMessage` 邏輯。
    *   **修改點：** 移除在 Webhook 執行期間對 `writeToWorkLogSheet` 的直接同步調用。
    *   **替代方案：** 改為使用 `ScriptApp.newTrigger` 搭配 `lockService`，將 `writeToWorkLogSheet` 設為一個延遲 1-2 分鐘執行的單次函式。
2.  **即時響應：** Webhook 應在觸發非同步任務後，立即向 Line 回覆一條「已收到您的訊息，日誌正在背景處理中...」的訊息。
3.  **結果：** 將 Line Bot 的響應時間從數秒降低到 500 毫秒以下，避免超時。

## 4. 互動確認 (Interactive Confirmation)

這是針對性能問題的架構級分析與建議。我們必須先執行 **策略二** 的非同步優化，才能真正解決 Line Bot 的超時問題。

請問您是否同意此分析，並讓我切換回 **Code 模式** 實作 **策略二：Line Bot 非同步委託機制**？