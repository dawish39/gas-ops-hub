# 專案架構討論：缺乏嚴格的分層隔離

## 缺乏隔離的細節闡述

在 Google Apps Script (GAS) 環境中，缺乏嚴格的分層隔離是最大的架構挑戰之一。

### 1. 問題的根源：GAS 的全域作用域

GAS 專案的所有 `.js` 文件中的頂層函式和變數，即使分散在不同文件中，最終都會被編譯到一個**單一的全域作用域**中。這意味著：

*   **無隱私邊界 (No Privacy Boundary)：** 任何文件中的任何函式，都可以直接調用其他文件中的任何函式，且無需明確的 `import` 或 `require`。
*   **鼓勵橫向耦合 (Horizontal Coupling)：** 程式設計師傾向於為了便利而直接跨越架構層次調用函式。例如，**介面層** (Controller, 如 [`api_web_gui.js`](src/api_web_gui.js:1) 中的 `doPost`) 可能直接呼叫 **資料存取層** (DAO, 如 `SpreadsheetApp.openById()`) 或 **業務邏輯層** (Service, 如 [`report_v2.js`](src/report_v2.js:1))，而沒有經過主要的業務核心 [`main.js`](src/main.js:1) 進行協調。

### 2. 高耦合性的風險範例

一個典型的**反模式 (Anti-Pattern)** 如下所示：

*   **理想 (分層隔離)：**
    [`api_web_gui.js`](src/api_web_gui.js:1) (Controller) -> `LogService.recordLog(...)` (Service) -> `LogDAO.insertRow(...)` (DAO) -> Spreadsheet
*   **現狀 (全域耦合風險)：**
    [`api_web_gui.js`](src/api_web_gui.js:1) (Controller) 可能直接包含 `SpreadsheetApp.openById("ID").getSheetByName("Logs").appendRow(data)` 等程式碼。

如果資料表的名稱或 ID 改變，您必須檢查所有檔案（[`api_web_gui.js`](src/api_web_gui.js:1), [`main.js`](src/main.js:1), [`report_v2.js`](src/report_v2.js:1), [`maintenance.js`](src/maintenance.js:1) 等）進行修復。這就是高度耦合的表現。

### 3. 如何強制執行隔離：實作 Class 與 DAO 層

為了解決這個問題，我們必須透過 **程式設計約定 (Programming Convention)** 和 **物件封裝 (Object Encapsulation)** 來模擬模組化：

*   **Class 封裝 (Encapsulation)：** 將每一個模組（例如，Category Management、Maintenance、Reporting）的相關函式和變數封裝在一個 JavaScript Class 內部。
    *   **優點：** 只有 Class 的公開方法 (Public Methods) 可以從外部被調用，將內部實作細節隱藏起來，減少全域作用域的污染。
*   **導入 DAO 層 (Data Access Object)：**
    *   創建專門的 Class（例如 `LogbookDAO`）來處理所有與 Spreadsheet 互動的程式碼。
    *   **約定：** 業務邏輯層 (Service) 只能呼叫 DAO 層的 Class 實例方法，永遠不能直接使用 `SpreadsheetApp` 或 `DriveApp` 等 GAS 服務來讀寫資料。
    *   **結果：** 業務邏輯與資料存取細節完全分離。如果資料源從 Spreadsheet 換成 Firestore，您只需要修改 DAO 層的實作，其他數十個業務邏輯函式則無需變動。

## 4. 實作 DAO 層的下一步規劃

既然我們已經確認了隔離的重要性，下一步的重點將是實作 DAO 層。

我們建議的詳細規劃如下：

1.  **定義資料存取介面：** 識別系統中所有資料實體（如 Log Entry, Category, Maintenance Schedule），並定義它們所需的 CRUD (Create, Read, Update, Delete) 操作。
2.  **創建 DAO 模組：** 創建一個新的檔案，例如 `src/data_access.js`，並在其中建立基礎的 `BaseDAO` Class 或多個特定實體的 DAO Class (e.g., `LogDAO`, `CategoryDAO`)。
3.  **重構資料存取點：** 識別現有程式碼 (如 [`main.js`](src/main.js:1), [`category_management.js`](src/category_management.js:1), [`report_v2.js`](src/report_v2.js:1)) 中所有直接操作 `SpreadsheetApp` 的程式碼。
4.  **遷移動作：** 將這些存取邏輯遷移到新的 DAO Class 中，並將原文件的程式碼修改為調用 DAO 實例的方法。

### 5. DAO 實作範例與效能優勢 (Example and Performance Benefit)

#### a. DAO 實作範例 (Log Entry)

假設我們有一個用於記錄日誌的 Sheet，在引入 DAO 模式後，資料存取邏輯會被集中管理。

**[重構前 - 高耦合風險]**
```javascript
// 位於 api_web_gui.js 或 main.js
function recordNewLog(logData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("LogEntries");
  sheet.appendRow([logData.timestamp, logData.category, logData.content]); // 直接操作 Spreadsheet
  // 其他業務邏輯...
}
```

**[重構後 - 良好隔離]**

1.  **創建 LogDAO 類 (在 src/data_access.js)**
    ```javascript
    class LogDAO {
      constructor() {
        this.sheetName = "LogEntries";
        this.ssId = CONFIG.SPREADSHEET_ID; // 假設配置中有 ID
      }

      insert(logData) {
        // 集中處理所有 GAS API 呼叫
        const ss = SpreadsheetApp.openById(this.ssId);
        const sheet = ss.getSheetByName(this.sheetName);
        sheet.appendRow([logData.timestamp, logData.category, logData.content]);
      }

      getAll() {
        // 集中處理批次讀取
        const ss = SpreadsheetApp.openById(this.ssId);
        const sheet = ss.getSheetByName(this.sheetName);
        return sheet.getDataRange().getValues();
      }
    }
    const LogbookDAO = new LogDAO(); // 創建單例供其他模組使用
    ```

2.  **Service 層呼叫 (在 main.js)**
    ```javascript
    // 業務邏輯層只關注業務，不關心資料儲存細節
    function recordNewLog(logData) {
      LogbookDAO.insert(logData); // 呼叫 DAO 實例
      // 其他業務邏輯...
    }
    ```

#### b. 效能優勢 (Performance Benefit)

GAS 的執行速度瓶頸通常在於**對 Google 服務的 API 呼叫頻率**。實作 DAO 層能帶來的核心效能益處是**批次處理 (Batch Processing)**：

| 挑戰 | 實作 DAO 層的益處 |
| :--- | :--- |
| **迴圈內頻繁讀寫** | DAO 可以將多個單行 `appendRow()` 請求替換為單次 `setValues()` 呼叫，極大減少 API 延遲。 |
| **重複開啟資源** | DAO 可以在 Class 內部初始化時快取 Spreadsheet 物件或 ID，避免在每個函式呼叫中重複 `SpreadsheetApp.openById()`，從而節省執行時間。 |
| **資料緩存優化** | 可以在 DAO Class 內實作簡單的緩存邏輯 (Caching)，如使用 `CacheService` 或記憶體變數來暫存不常變動的資料（如 Category 列表），減少對 Spreadsheet 的讀取。 |

**結論：** 雖然 DAO 本身是一種架構模式，但它通過強制將所有資料操作集中化，為實作高效能的**批次讀寫**和**資源快取**提供了唯一的優化切入點。

## 6. 下一步：制定實作 DAO 層的計畫

**請問您是否同意此優化方向，並讓我開始制定詳細的實作步驟清單？**