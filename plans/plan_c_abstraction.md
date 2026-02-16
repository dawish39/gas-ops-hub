# 可擴散性升級計畫：Web GUI 配置抽象化 (領域 C)

## 風險與複雜度評估

*   **複雜度：** 中等。工作範圍集中在 [`src/api_web_gui.js`](src/api_web_gui.js:1) 和 [`src/index.html`](src/index.html:1)。
*   **服務/寫入異常風險：** **低。** 由於我們已完成 DAO 分層，本次修改不涉及底層數據寫入邏輯，只涉及數據**讀取**和 **介面初始化**的邏輯。

## 實作目標
移除前端對特定 Sheet Name (如 `RepairCategory`) 的硬依賴，使其透過 API 獲取最新的配置資訊。

## 執行步驟清單 (Code Mode Todos for Plan C)

1.  **[ ] 創建 Utility 函式：** 在 [`src/main.js`](src/main.js:1) 或新增 [`src/utils.js`](src/utils.js:1) 檔案，將所有通用的工具函式 (如 `formatDateValue`, `parseOutputColumns`) 集中於此，避免全域污染。
2.  **[ ] 強化配置 API：** 在 [`src/api_web_gui.js`](src/api_web_gui.js:1) 中創建新的 API 函式 `apiGetSystemMeta()`，用於一次性返回所有配置 Metadata：
    *   `repairCategorySheetName` (從 `CONFIG` 讀取)
    *   `needsCategorySheetName` (從 `CONFIG` 讀取)
    *   `departmentSheetName` (硬編碼值 `Department` 需移入 `CONFIG` 並讀取)
3.  **[ ] 重構 `apiGetFormOptions()`：** 修改 [`src/api_web_gui.js`](src/api_web_gui.js:22) 中的 `apiGetFormOptions()` 函式，使其從 `CONFIG` 讀取 Sheet Names，而不是使用硬編碼字串。
4.  **[ ] 更新前端調用：** 修改 [`src/index.html`](src/index.html:1) 及其包含的 JavaScript，首先調用 `apiGetSystemMeta()` 獲取 Sheet Names，然後使用這些動態名稱呼叫後續的數據 API。

## 💡 前置任務提醒

在進行抽象化升級之前，我們必須先執行您已同意的 **Web GUI 預熱優化**，以確保系統響應速度提升：

*   **[ ] 實作 Web GUI 預熱觸發器：** 執行 [`src/triggers.js`](src/triggers.js:63) 函式 `setupPerformanceTriggers()`。

請問您是否同意此 **配置抽象化計畫**，並確認我現在應該先切換回 **Code 模式** 執行 **預熱優化** 還是 **配置抽象化**？