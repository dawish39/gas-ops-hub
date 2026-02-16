# 架構優化與重構總結報告 (相較於舊版本)

本次重構將專案從單純的函式集合 (Functional Soup) 提升為結構化分層架構 (Layered Architecture)。

## 1. 核心改進點總覽

| 改進領域 | 舊版本問題 (高風險/技術債) | 新版本優勢 (已實現) | 相關模組 |
| :--- | :--- | :--- | :--- |
| **配置管理 (Security & Maintainability)** | 所有的 Spreadsheet ID、Folder ID 和 Token 等機密資料硬編碼在多個 .js 檔案中，且難以集中管理。 | 採用 **Config Manager** ([`src/config.js`](src/config.js:1) / `PropertiesService`)，實現配置與程式碼分離，大幅提高安全性與部署彈性。 | [`src/config.js`](src/config.js:1), 所有模組 |
| **資料存取分層 (Decoupling & Testability)** | 業務邏輯（如 `main.js`）直接呼叫 `SpreadsheetApp.openById()`，導致邏輯與資料庫細節高度耦合。 | 導入 **DAO Layer** ([`src/dao.js`](src/dao.js:1))，將所有 I/O 操作封裝。未來更換資料庫（如換成 Firestore）只需修改 DAO 內部，不影響上層業務邏輯。 | [`src/dao.js`](src/dao.js:1), [`src/main.js`](src/main.js:1), [`src/category_management.js`](src/category_management.js:1) |
| **命名空間與模組化 (Scalability)** | 所有分類管理邏輯、配置讀取邏輯散落在頂層函式中，容易產生全域命名衝突，且難以維護。 | 透過 `ConfigDAO`, `CategoryDAO`, `LogEntryDAO` 等 **Class 實例**，實現邏輯上的物件封裝，減少全域污染。 | [`src/dao.js`](src/dao.js:1), [`src/category_management.js`](src/category_management.js:1) |
| **數據存取效率 (I/O Standardization)** | 不同的功能模組以不同的方式開啟 Spreadsheet 和存取數據，缺乏統一的錯誤處理。 | DAO 統一了 `getSheet()` 的錯誤處理，並確保所有複雜操作（如分類 ID 生成和儀表板數據讀取）都通過標準化的 DAO 介面進行數據獲取，為未來的批次操作優化鋪路。 | [`src/api_web_gui.js`](src/api_web_gui.js:1), [`src/maintenance.js`](src/maintenance.js:1) |

## 2. 下一步：性能優化 (Performance Optimization)

雖然我們已完成架構重構，但儀表板的 12 秒延遲屬於 GAS 環境特性（冷啟動）。為了真正解決此問題，下一步是實作 **Web GUI 預熱觸發器**。

我們將實作的計畫在 [`plans/web_gui_performance_plan.md`](plans/web_gui_performance_plan.md:1) 中有詳細說明。請問是否同意切換至 Code 模式執行此優化？