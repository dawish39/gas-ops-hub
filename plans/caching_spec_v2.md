# 通用快取機制技術規格書 v2.0

**文件編號:** `SPEC-CACHE-20260204-02`
**日期:** 2026-02-04
**狀態:** **定稿 (Final)**

---

## 1. 概述 (Overview)

本文件為「IT Logbook 系統」的通用快取機制提供最終的技術規格。目標是透過建立一套標準化、可重用的伺服器端快取處理器，顯著提升全系統的後端資料讀取效能、降低延遲，並作為下一階段實作的唯一依據。此規格書整合了先前版本 (`v1`)、資安風險評估、以及效能預估分析的所有結論。

---

## 2. 預期效能改善 (Expected Performance Improvement)

根據 `plans/performance_improvement_estimate_v1.md` 的量化分析，導入此快取策略將帶來以下核心效益：

*   **大幅降低延遲:** 對於快取命中 (Cache Hit) 的請求，其執行時間將從 **3-10 秒**大幅縮短至 **300 毫秒以下**。預期使用者感受到的查詢**延遲將降低 90% 以上**。
*   **優化系統配額:** 顯著減少 `指令碼執行時間 (Script execution time)` 配額的消耗，使系統在相同配額下能服務更多請求，提升系統整體的穩定性與可擴展性。

---

## 3. 資安設計準則 (Security Guidelines)

為防止跨使用者資料洩漏，所有快取實作必須嚴格遵守 Google Apps Script 的 `CacheService` 範疇區分。

*   **`ScriptCache` (腳本快取 - 全域共享):**
    *   **定義:** 由所有使用者共享的快取空間。
    *   **使用時機:** **僅限於**儲存對所有使用者完全相同的通用資料。例如：系統設定、公開的報表數據、非個人化的下拉選單選項等。

*   **`UserCache` (使用者快取 - 使用者獨立):**
    *   **定義:** 每個使用者獨立隔離的快取空間。
    *   **使用時機:** 用於儲存僅限特定使用者存取的個人化資料。例如：「我回報的任務」、個人偏好設定、草稿等。

**🔴 **強制性安全規則**:**
未來系統中，任何回傳「個人化」或經過使用者身分過濾的資料的函式，**必須強制使用 `UserCache`**，絕不允許使用 `ScriptCache`。此項為程式碼審查 (Code Review) 的重點檢查項目。

---

## 4. 系統實作設計 (Implementation Design)

### 4.1. 通用快取處理器 (`withCache`)

為標準化快取邏輯，我們將設計一個名為 `withCache` 的高階函式 (Higher-Order Function)，它將作為一個通用包裝器 (Wrapper)。

*   **函式簽名:** `withCache(targetFunction, options)`
*   **參數:**
    *   `targetFunction`: (Function) 需要被快取的原始目標函式。
    *   `options`: (Object) 一個設定物件，包含：
        *   `keyGenerator`: (Function) 一個函式，接收 `targetFunction` 的所有參數，並回傳一個確定性的快取鍵 (string)。
        *   `cacheService`: (Cache) `CacheService.getScriptCache()` 或 `CacheService.getUserCache()` 的實例。
        *   `ttl`: (Integer) 快取的有效時間 (Time-to-Live)，單位為秒。建議值為 `21600` (6 小時)。
*   **執行邏輯:**
    1.  接收 `targetFunction` 及其參數。
    2.  呼叫 `options.keyGenerator` 產生快取鍵。
    3.  使用 `options.cacheService` 嘗試讀取快取。
    4.  **快取命中:** 若成功讀取，解析快取內容 (JSON) 並直接回傳，中止執行。
    5.  **快取未命中:** 執行 `targetFunction` 取得原始資料。
    6.  將原始資料序列化 (JSON) 後，使用 `options.cacheService` 將其寫入快取，並設定 `ttl`。
    7.  回傳原始資料。
    8.  所有快取寫入操作都必須包含在 `try...catch` 區塊中，以靜默處理可能的錯誤 (如超過大小限制)。

### 4.2. 快取失效函式 (`invalidateAnalysisCache`)

此輔助函式用於宣告所有與分析相關的快取失效。

*   **函式名稱:** `invalidateAnalysisCache`
*   **功能:** 透過更新一個全域版本標識符，間接使所有依賴此標識符的快取鍵失效。
*   **執行邏輯:**
    *   使用 `PropertiesService.getScriptProperties()`。
    *   設定或更新一個名為 `ANALYSIS_CACHE_VERSION` 的屬性。
    *   其值為當前時間戳的字串格式: `new Date().getTime().toString()`。
*   **觸發時機:** 在任何可能影響分析資料的操作（例如：新增、修改、刪除任務）成功執行後，必須呼叫此函式。

---

## 5. 應用範圍 (Scope of Application)

根據全域函式分析，以下函式將是本次快取導入專案的第一批應用對象。它們都回傳非個人化的共享資料，因此適合使用 `ScriptCache`。

| 檔案路徑 | 函式名稱 | 建議快取類型 |
| :--- | :--- | :--- |
| `src/main.js` | `readConfig` | `ScriptCache` |
| `src/api_web_gui.js` | `apiGetGlobalSummary` | `ScriptCache` |
| `src/api_web_gui.js` | `apiGetAnalysisData` | `ScriptCache` |
| `src/api_web_gui.js` | `apiGetTrendData` | `ScriptCache` |
| `src/api_web_gui.js` | `apiGetFormOptions` | `ScriptCache` |
| `src/api_web_gui.js` | `apiGetAdminMenu` | `ScriptCache` |
| `src/api_web_gui.js` | `apiGetSources` | `ScriptCache` |
| `src/category_management.js` | `getCategoryCodeMap` | `ScriptCache` |
