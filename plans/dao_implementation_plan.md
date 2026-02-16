# 實作 Data Access Object (DAO) 層詳細執行計畫

## 核心目標
將目前散佈在各個 `.js` 檔案中的 `SpreadsheetApp` 相關程式碼集中到一個專門的 DAO 層。目標是實現業務邏輯與資料存取細節的徹底解耦，並優化資料讀寫效能。

## 執行步驟清單 (Code Mode Todos)

以下是切換至 Code 模式後，將執行的詳細步驟：

1.  **[ ] 創建配置層：** 在 [`src/`](src/) 目錄下新增檔案 [`src/config.js`](src/config.js:1)，實作一個 Class 或物件，統一透過 `PropertiesService` 讀取所有配置變數（如 Spreadsheet ID, Sheet Names, 外部金鑰等）。
2.  **[ ] Refactor 配置變數：** 遍歷所有檔案，將硬編碼的配置變數（如 Spreadsheet ID, Sheet Names, LINE Token）修改為透過新配置層讀取。
3.  **[ ] 創建 DAO 文件：** 在 [`src/`](src/) 目錄下新增檔案 [`src/dao.js`](src/dao.js:1)，用於存放所有資料存取類別。
4.  **[ ] 實作 LogDAO：** 在 [`src/dao.js`](src/dao.js:1) 中，實作 `LogDAO` Class，負責 IT Log Entry 資料表的 CRUD 操作，並引入**批次讀取**邏輯 (`.getDataRange().getValues()`)。
5.  **[ ] 實作 CategoryDAO：** 在 [`src/dao.js`](src/dao.js:1) 中，實作 `CategoryDAO` Class，負責類別資料表的 CRUD 操作。
6.  **[ ] Refactor [`main.js`](src/main.js:1)：** 修改 [`main.js`](src/main.js:1) 中所有涉及 Log 紀錄的程式碼，替換為調用 `LogDAO` 的方法。
7.  **[ ] Refactor [`category_management.js`](src/category_management.js:1)：** 修改 [`category_management.js`](src/category_management.js:1) 中所有類別存取程式碼，替換為調用 `CategoryDAO` 的方法。
8.  **[ ] Refactor 報表/維護模組：** 審查 [`report_v2.js`](src/report_v2.js:1) 和 [`maintenance.js`](src/maintenance.js:1)，將其資料讀取邏輯導向至 DAO 層。
9.  **[ ] 驗證功能：** 確保所有重構後的 Web App (via [`api_web_gui.js`](src/api_web_gui.js:1)) 和 LINE Bot (via [`api_line_bot.js`](src/api_line_bot.js:1)) 接口功能正常。

## 執行藍圖 (Mermaid Diagram)

此優化將強制 Controller/Service/DAO 的單向依賴關係：

\`\`\`mermaid
graph TD
    A[Controller - api_web_gui/api_line_bot] --> B(Service - main/report/maintenance);
    B --> C(DAO - dao.js);
    C --> D[Spreadsheet Service];
    style C fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#ccf,stroke:#333,stroke-width:2px
    style A fill:#cfc,stroke:#333,stroke-width:2px
\`\`\`

**此為最終實作規劃。請您審查並確認是否同意切換至 Code 模式執行上述步驟。**