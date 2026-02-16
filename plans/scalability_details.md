# 可擴散性升級：領域 A 與 C 詳細說明

## A. 部署自動化與租戶 ID 實作 (Multi-Tenancy & Automation)

此領域的目標是讓系統可以輕鬆地為不同部門或客戶創建獨立的、互不干擾的實例 (Instance)，實現多租戶 (Multi-Tenant) 模式。

### 1. 部署自動化 (Clasp & Scripting)
*   **痛點：** 目前每次部署都需要手動複製專案、修改 ID、設定 Web App 和 Line Bot Webhook。
*   **方案：** 引入 **Google Apps Script CLI (Clasp)** 和一個 Node.js/Python 腳本來自動化這個過程。
    1.  腳本從主範本複製程式碼。
    2.  腳本創建新的 Google Spreadsheet 和 Drive 資料夾。
    3.  腳本使用 Clasp 部署程式碼並獲取新的 Web App URL。
    4.  腳本將新的 Spreadsheet ID、Folder ID 和 Web App URL 寫入新實例的 `PropertiesService`。
    5.  腳本自動設置 Line Bot 的 Webhook (如果可能) 和必要的 `setupTriggers`。
*   **效益：** 系統從「手工作坊」升級為「工廠」，實現一鍵部署。

### 2. 租戶 ID (Tenant ID) 與資料隔離
*   **概念：** 雖然 GAS 實例本身是隔離的，但為了更清晰地追蹤和管理，應為每個實例配置一個 `TENANT_ID`（例如 `IT_DEPT_01` 或 `HR_LOG`）。
*   **實作點：** 在 `ConfigManager` 中讀取這個 `TENANT_ID`。所有外部溝通 (例如 Line 訊息、錯誤日誌) 都應帶上這個 ID，以便快速識別問題來源。
*   **效益：** 即使未來所有客戶共用一個中央服務層，也能基於此 ID 進行數據和錯誤的隔離/路由。

## C. Web GUI 前端配置抽象化 (Frontend Decoupling)

此領域的目標是將前端（HTML/JavaScript）對後端數據結構的「硬知識」移除，讓數據表可以更靈活地客製化。

### 1. 移除硬編碼的 Sheet Name
*   **痛點：** 在 [`src/api_web_gui.js`](src/api_web_gui.js:644) 的 `apiGetFormOptions()` 函式中，前端下拉選單的數據來源是寫死的 `RepairCategory` 和 `NeedsCategory` 這些 Sheet Name。
    ```javascript
    // 舊有問題代碼範例
    repairItems: getActiveItems("RepairCategory"), 
    needsItems: getActiveItems("NeedsCategory")
    ```
*   **方案：** 將 Sheet Name 放入 `PropertiesService` 中，並透過 `apiGetFormOptions()` API 傳輸給前端。
    1.  `ConfigManager` 中包含 `SHEET_REPAIR_CATEGORY_NAME` 等 Keys。
    2.  `apiGetFormOptions()` 應從 `ConfigManager` 獲取這些 Sheet Name。
    3.  前端不再依賴寫死的名稱，而是根據 API 返回的配置來決定調用哪個 Sheet 的數據。

### 2. 欄位名稱抽象化 (Column Abstraction)
*   **痛點：** 前端 JS 必須知道「狀態」、「新增日期」、「UUID」等欄位的確切名稱和拼寫。
*   **方案：** 在 `readConfig()` 的數據結構中，增加一個映射層 (Mapping Layer)。
    *   例如，每個 Source 的配置中，除了 ID 和 Sheet Name，還要加上 `{ StatusCol: "狀態", DateCol: "新增日期" }`。
*   **效益：** 允許使用者對 Spreadsheet 中的欄位名稱進行輕微調整，而無需修改任何 GAS 程式碼。

---

請問您是否已充分了解這兩個領域的目標與實作細節，並可以決定接下來的優化方向？

*   **A.** **部署自動化與租戶 ID 實作**
*   **C.** **Web GUI 前端配置抽象化**