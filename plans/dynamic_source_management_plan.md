# 第一階段報告：動態資料來源管理系統架構計畫

## 1. 需求本質重述 (Problem Restatement)

核心問題並非單純的安裝腳本錯誤，而是一個**架構性缺陷**：系統缺乏一個動態、自動化的機制來管理新的「資料來源類別」。目前 `installer.js` 的硬編碼陣列 (`DEFAULT_CATEGORIES`) 造成了嚴重的**前後端狀態不同步**問題。每當使用者期望新增資料來源時（例如，從 `DATABASE`、`LINE` 擴充到 `GA4`），就需要開發者手動修改後端程式碼並重新部署，這完全違背了系統應有的靈活性與使用者賦權 (User Empowerment) 的設計原則。這個斷層導致了不良的使用者體驗與高昂的維運成本。

## 2. 顧問式挑戰 (Mandatory Challenge)

### A. 核心目標 (Core Objective)
讓使用者能透過 Web GUI，**順暢地、無需任何後端手動介入地新增、管理資料來源類別**，並確保整個系統（包含後端 `Config` 試算表、指令碼屬性、前端 UI 介面、以及 `Data` 試算表）能**即時、一致地**反應此變更。

### B. 風險識別與替代方案 (Risks & Alternative)

**當前實作風險：**
1.  **寫死的組態 (`Hardcoded Configuration`)**：`installer.js` 中的 `DEFAULT_CATEGORIES` 是一個靜態設定，完全無法應對動態需求，是架構的主要瓶頸。
2.  **狀態不同步 (`State Desynchronization`)**：前端的 `index.html` 與後端的 `ConfigProvider.js` 對於「有哪些合法的資料來源類別」沒有統一的、即時的認知來源 (Single Source of Truth)，導致資料不一致。
3.  **不良的使用者體驗 (`Poor UX`)**：使用者無法自行擴充系統功能，完全依賴開發者介入，流程緩慢且缺乏效率。
4.  **維運成本高 (`High Maintenance Cost`)**：任何簡單的類別變更都需要走一次完整的開發、測試與部署流程。

**穩健的替代方案：**
我們將建構一個以 `Config` 試算表為「單一事實來源 (Single Source of Truth)」的動態管理流程。

**使用者操作流程 (User Workflow):**
1.  **啟動管理**：使用者在 Web GUI 的「系統設定」頁面，點擊「管理資料來源」按鈕。
2.  **介面呈現**：系統彈出一個管理視窗，顯示目前所有已存在的資料來源類別列表（例如：`DATABASE`, `LINE`），旁邊有一個「新增類別」的輸入框與按鈕。
3.  **新增操作**：使用者在輸入框中填入新的類別名稱（例如：`GA4`），點擊「新增」。
4.  **後端處理**：
    *   前端發送請求至後端 `api_web_gui.js` 的新函式 `addDataSourceCategory(categoryName)`。
    *   後端函式驗證輸入的 `categoryName`（例如，檢查是否重複、是否為空）。
    *   驗證通過後，後端函式會在 `Config` 試算表的 `DataSourceCategories` 工作表中新增一行，內容為 `GA4`。
    *   **同時，系統會自動建立一個名為 `GA4` 的新工作表**，並將 `Data` 試算表中定義的標準欄位（`ID`, `Timestamp`, `Source`, `Content` 等）作為表頭填入。
    *   後端函式會觸發 `System.js` 中的 `refreshConfig()`，強制更新 Script Properties 中的快取。
5.  **前端刷新**：
    *   後端處理成功後，會回傳更新後的完整類別列表。
    *   前端的「管理資料來源」視窗會**自動刷新**，顯示 `GA4` 已成功加入。
    *   當使用者關閉設定視窗，回到主操作介面時，任何與「資料來源」相關的下拉選單（例如，篩選器、新增資料的表單）**都將立即包含 `GA4` 這個新選項**。
6.  **資料表反應**：使用者此時前往 `Data` 試算表，可以看到一個全新的、已預設好欄位的 `GA4` 工作表，可以立即開始使用。

## 3. 執行藍圖 (Execution Blueprint)

### A. 資料流 (Data Flow)

```mermaid
graph TD
    subgraph "Frontend (index.html)"
        A[使用者點擊「新增類別」] --> B{呼叫 google.script.run.addDataSourceCategory('GA4')};
    end

    subgraph "Backend (GAS)"
        B --> C[api_web_gui.js: addDataSourceCategory(name)];
        C --> D{System.js: validateCategory(name)};
        D -- 驗證通過 --> E[ConfigProvider.js: createCategorySheet('GA4')];
        E --> F[ConfigProvider.js: addCategoryToConfig('GA4')];
        F --> G[System.js: refreshConfigCache()];
        G --> H[回傳更新後的類別列表];
    end

    subgraph "Frontend (index.html)"
        H --> I[Callback 函式接收新列表];
        I --> J[動態更新 UI 介面];
    end

    subgraph "Google Sheets"
        E -- 觸發 --> K[建立名為 'GA4' 的新工作表];
        F -- 觸發 --> L[在 'Config' 試算表中新增 'GA4' 記錄];
    end
```

### B. 檔案職責 (File Responsibilities)

*   **`index.html`**：
    *   **職責**：提供使用者互動介面。
    *   **修改**：新增「管理資料來源」按鈕、管理視窗的 HTML/CSS/JS 結構。實作呼叫後端 `addDataSourceCategory` 的客戶端 JavaScript 邏輯，並撰寫 callback 函式來動態刷新前端下拉選單與列表。

*   **`api_web_gui.js`**：
    *   **職責**：作為前後端溝通的 API 端點。
    *   **修改**：**建立新函式 `addDataSourceCategory(name)`** 來接收前端請求，並協調 `System.js` 和 `ConfigProvider.js` 完成業務邏輯。

*   **`ConfigProvider.js`**：
    *   **職責**：封裝所有對 `Config` 與 `Data` 試算表的直接讀寫操作。
    *   **修改**：**建立新函式 `addCategoryToConfig(name)`**，負責在 `Config` 的 `DataSourceCategories` 工作表中新增一行。**建立新函式 `createCategorySheet(name)`**，負責在 `Data` 試算表中建立以 `name` 命名的新工作表，並填入預設欄位。

*   **`System.js`**：
    *   **職責**：管理系統級的狀態與快取邏輯。
    *   **修改**：現有的 `refreshConfig()` 將被 `addDataSourceCategory` 呼叫，以確保在設定變更後，Script Properties 中的快取能被即時更新。可能需要新增一個 `validateCategory(name)` 的輔助函式。

*   **`installer.js`**：
    *   **職責**：初始化系統設定。
    *   **修改**：**移除 `DEFAULT_CATEGORIES` 硬編碼陣列**。安裝邏輯將改為：如果 `Config` 試算表中沒有任何資料來源類別，則自動建立一個預設的（例如，`DATABASE`），而不是依賴寫死的列表。

## 4. 互動確認 (Interaction Confirmation)

我將等待您的回覆「**Go/可以**」，在獲得您的明確授權後，才會將此計畫轉換為具體的程式碼實作任務。