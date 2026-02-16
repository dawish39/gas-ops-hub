# 性能優化計畫：Web GUI 儀表板讀取速度提升 (12秒 -> 5秒內)

## 1. 診斷 (Diagnosis)

Web GUI 載入慢 (12 秒) 的主要瓶頸在於 `apiGetGlobalSummary` 函式。根據 [`src/api_web_gui.js`](src/api_web_gui.js:644) 的邏輯，它需要完成以下工作：

1.  **讀取所有配置的資料來源：** `readConfig()` (每次讀取配置表，約 0.5-1.5 秒)。
2.  **迭代處理所有資料來源 (Sources)：**
    *   對每個來源呼叫 `SpreadsheetApp.openById(src.id)`。
    *   對每個來源呼叫 `sheet.getRange(...).getValues()` **讀取多個工作表的大量數據** (KPI 計算)。
3.  **快取檢查：** 雖然有快取機制 (`CacheService`)，但首次載入 (Cold Start) 必 Miss，且快取失效時必須重新執行全部 I/O 操作。

即使使用了 DAO 模式，由於 GAS 的 I/O 成本高昂，只要讀取來源數量多，且每個來源的資料量大，冷啟動時 12 秒的延遲是常見的。

## 2. 策略：強制快取與快取預熱 (Forced Caching and Pre-warming)

目標是將 12 秒的延遲轉移到後台，並確保前端僅在快取準備好後才顯示數據。

### 策略一：快取精確控制 (Refine Cache Logic)

修改 [`apiGetGlobalSummary()`](src/api_web_gui.js:644) 邏輯，避免在快取 Miss 時讓使用者等待 12 秒的重新計算。

*   **優化點：** 檢查快取 Miss 時，不立即執行 `generateGlobalSummary()`，而是返回一個「正在載入/請稍候」的狀態，並在後台觸發一個單次執行的函式來更新快取。
*   **優勢：** 將 12 秒的等待時間分散到後台，用戶界面反應快。

### 策略二：預熱觸發器 (Pre-warming Trigger)

使用時間驅動觸發器，確保儀表板的快取 (`DASHBOARD_DATA`) 始終是熱的或最新的。

*   **實作點：** 創建一個新的 GAS 觸發器，每 5 或 10 分鐘執行一次 `clearDashboardCache()`，然後緊接著呼叫 `apiGetGlobalSummary()` (或一個專門的快取生成函式)。
*   **優勢：** 儀表板的快取命中率將接近 100%，消除冷啟動和 I/O 延遲。

## 3. 執行計畫 (Code Mode Todos)

我們將專注於 **策略二：預熱觸發器**，因為這是最有效且影響範圍最小的性能提升方法。

1.  **[ ] 創建預熱函式：** 在 [`src/triggers.js`](src/triggers.js:1) 中創建一個名為 `warmUpCacheJob()` 的函式，該函式執行 `clearDashboardCache()` 然後調用 `apiGetGlobalSummary()`。
2.  **[ ] 配置觸發器設定：** 在 [`src/triggers.js`](src/triggers.js:1) 中加入 `setupPerformanceTriggers()` 函式，用於建立每 5 分鐘執行的時間驅動觸發器 (Time-driven Trigger)，指向 `warmUpCacheJob`。
3.  **[ ] 驗證：** 執行 `setupPerformanceTriggers()` 並確認儀表板載入時間是否穩定在 5 秒內（取決於網路環境，冷啟動部分可能會保持 1-2 秒的延遲）。

請問您是否同意此優化方向，並讓我切換回 **Code 模式** 實作 **預熱觸發器**？