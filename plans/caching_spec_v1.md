### **分析模組暫存機制技術規格書 (v1.0)**

**文件編號:** `SPEC-CACHE-20260204-01`
**日期:** 2026-02-04
**主題:** 為 `api_web_gui.js` 中的分析圖表功能導入具備版本控制的伺服器端暫存機制。

#### **1. 概述**

本文件旨在定義「IT Logbook 系統」分析主控台的性能優化方案。為解決動態圖表因即時運算所造成的載入延遲問題，本規格書將詳述一套伺服器端暫存（Caching）機制的實作細節。此機制將利用 Google Apps Script 原生服務，以確保在提升性能的同時，維持資料的即時性與準確性。

#### **2. 規格詳情**

##### **2.1. 快取失效輔助函式 (`invalidateAnalysisCache`)**

*   **函式名稱:** `invalidateAnalysisCache`
*   **檔案位置:** `src/api_web_gui.js`
*   **功能:** 建立一個全域性的快取版本標識符。
*   **執行邏輯:**
    *   函式被呼叫時，必須使用 `PropertiesService.getScriptProperties()`。
    *   必須設定一個名為 `ANALYSIS_CACHE_VERSION` 的屬性。
    *   其值必須是當前時間戳的字串格式，即 `new Date().getTime().toString()`。
*   **用途:** 此函式將在任何可能影響分析資料的操作（新增、修改任務）後被呼叫，以宣告所有現存快取失效。

##### **2.2. 資料讀取邏輯 (修改 `apiGetAnalysisData`)**

*   **目標函式:** `apiGetAnalysisData(payload)`
*   **執行流程:**
    1.  **版本獲取:** 函式啟動時，必須先從 `PropertiesService` 讀取 `ANALYSIS_CACHE_VERSION` 的值。若該值不存在（首次執行），則應在記憶體中將版本設為一個初始值（例如 `'init'`)。
    2.  **快取鍵生成:**
        *   必須生成一個確定性（Deterministic）的快取鍵。
        *   **格式約束:** 快取鍵必須嚴格遵循 `"{version}_analysis_{type}_{period}"` 的字串拼接格式。其中 `{version}`、`{type}`、`{period}` 分別對應版本標識符、`payload.type` 和 `payload.period` 的值。
        *   **禁止事項:** 嚴禁使用 `JSON.stringify(payload)` 作為快取鍵的一部分。
    3.  **快取讀取:** 使用 `CacheService.getScriptCache().get(cacheKey)` 嘗試獲取快取資料。
    4.  **快取命中 (Cache Hit):** 如果 `get` 方法回傳非 `null` 的值，函式必須立即使用 `JSON.parse` 解析該字串，並將解析後的物件回傳，終止後續執行。
    5.  **快取未命中 (Cache Miss):** 如果 `get` 方法回傳 `null`，則繼續執行函式中現有的資料庫查詢與統計邏輯。
    6.  **快取回寫:**
        *   在計算出最終結果物件後，返回給客戶端之前，必須先將結果 `JSON.stringify`。
        *   使用 `CacheService.getScriptCache().put(cacheKey, stringifiedData, 21600)` 將字串化的資料存入快取，有效期限（TTL）設為 6 小時（21600 秒）。
        *   **風險管理:** `put` 操作必須被包含在一個 `try...catch` 區塊內。如果發生錯誤（例如，資料超過 100KB 上限），`catch` 區塊必須靜默處理，或僅執行 `console.log`，不得中斷函式的正常回傳。

##### **2.3. 資料寫入邏輯 (修改 `apiCreateTask` & `apiUpdateTask`)**

*   **目標函式:** `apiCreateTask(payload)` 和 `apiUpdateTask(payload)`
*   **注入點:** 在這兩個函式的 `try` 區塊內，找到 `SpreadsheetApp.flush()` 或等效的資料庫寫入確認操作。
*   **執行指令:** 在資料庫寫入確認之後，必須立即呼叫 `invalidateAnalysisCache()` 函式。