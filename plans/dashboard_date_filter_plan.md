# 儀表板日期篩選功能實作計畫 (交接手冊)

**目標：** 允許使用者在儀表板 (Dashboard) 頁面選擇不同的日期區間（預設為「今日」/「待辦」），以動態更新 KPI 和即時動態/待處理列表。

**系統架構變更摘要：**

| 系統層 | 檔案 | 變更內容 | 備註 |
| :--- | :--- | :--- | :--- |
| **前端 UI (View)** | [`src/index.html`](src/index.html) | 新增日期篩選下拉選單 HTML 結構。 | 沿用 List View (Line 269~) 結構。 |
| **前端邏輯 (Vue)** | [`src/index.html`](src/index.html) | 修改 `data`、`applyFilter` 和 `loadDashboard` 方法。 | 確保日期計算邏輯的重用與正確性。 |
| **後端 API (Controller)** | `src/api_web_gui.js` (待確認) | 修改 `apiGetGlobalSummary()` 函數簽名，使其接受 `filterPeriod` 參數。 | |
| **後端資料 (Service)** | `src/dao.js` (待確認) | 實作高效能的日期範圍過濾邏輯。 | 這是確保長區間查詢不超限的關鍵。 |

---

## 1. 前端實作細節 (Vue & HTML)

### 1.1 HTML 結構變更 (在 `src/index.html` 中)

將 Line 174-177 的靜態日期顯示替換為一個包含日期篩選下拉選單的區塊。

**原代碼 (Static Date Badge):**
```html
:start_line:174
-------
                <span class="ms-3 badge bg-light text-secondary border rounded-pill align-middle" style="font-weight: 500; font-size: 0.9rem;">
                    <i class="bi bi-calendar3 me-1"></i>{{ todayDateStr }}
                </span>
=======
```
**新代碼 (Filter Dropdown):**
使用與 List View 相同的結構 (`filter-toolbar`) 以保持樣式一致性。

### 1.2 Vue Data 變更

在 `data()` 中新增儀表板專用的篩選狀態：
```javascript
:start_line:577
-------
        filterDate: 'default',
        timeLabel: '時間範圍', 
        customStart: '', // 🟢 自訂日期起
        customEnd: '',   // 🟢 自訂日期迄
        jobResult: '',
        sortKey: 'date',
        sortOrder: -1,
        anaType: 'repair', anaPeriod: 'current_month', showChartArea: false, chartImages: [], dashboardData: { total: 0, title: '', period: '' },
        formOptions: { depts: [], repairItems: [], needsItems: [] },
        pollingTimer: null,
        isSaving: false,
        editModalInstance: null,
        editingTask: { uuid: '', source: '', item: '', status: '', progress: '', link: '' },
        isCreating: false,
        createModalInstance: null,
        creatingTask: { sourceName: '', category: '', item: '', status: '○ 待處理', progress: '', dept: '' }
      }
    },
=======
```
**變更：** 需要新增一組專門用於 Dashboard 的狀態，例如 `dashboardFilterDate` 和 `dashboardTimeLabel`。為避免重複邏輯，我們將會重用現有的 `filterDate` 和 `timeLabel`，但在 `loadDashboard` 中處理傳輸。

### 1.3 Vue Methods 變更 (核心邏輯)

**`loadDashboard(period = 'default')` 修改：**
此函數必須能接收篩選參數。如果傳入的是預設區間名稱 (`'week', 'month'`)，需要計算出實際的起始/結束日期，再傳給後端。

**`applyFilter(type, value, view)` 修改：**
需要一個參數來區分是 List View 還是 Dashboard View。

---

## 2. 後端實作細節 (GAS)

### 2.1 API 簽名變更

修改 `apiGetGlobalSummary` 函數，使其能接收日期範圍參數。
```javascript
// 原型: apiGetGlobalSummary()
// 變更為: apiGetGlobalSummary(startDateStr, endDateStr)
```

### 2.2 核心資料過濾與 KPI 計算

`apiGetGlobalSummary` 內部的邏輯需要進行以下調整：

1.  **獲取資料：** 呼叫 DAO 函數取得所有原始資料。
2.  **日期過濾：** 在計算 KPI、`stream` 和 `pending` 之前，使用傳入的 `startDateStr` 和 `endDateStr` 對所有原始資料 (Logs) 進行過濾。
    *   *性能考量：* 必須確保篩選邏輯高效，尤其是在 GAS 的 V8 引擎中。
3.  **KPI 重算：** 使用過濾後的數據集，重新計算 `todayNew`, `todayDone`, `pendingTotal`。
    *   **待處理 (Pending)** 邏輯：待處理項目不應受日期篩選影響 (除非篩選範圍是 'default' 時的「今日」數據)。我們需要在後端區分兩種篩選：
        *   **日期篩選：** 影響 Stream 和 KPI (New/Done)。
        *   **待處理邏輯：** 影響 Pending 列表，它應該總是返回所有時間軸上的待處理項目。
    *   **決策：** 為符合儀表板的核心功能，**待處理列表 (`hudData.pending`) 應無視日期篩選，始終顯示所有未完成任務。** 日期篩選僅影響 KPI (New/Done) 和 Live Stream。

---

## 3. 執行步驟 (更新後的 TODO)

由於需要分析後端文件，我將先執行讀檔步驟。

```mermaid
graph LR
    A[用戶選擇日期區間] --> B(Vue applyFilter 計算日期範圍);
    B --> C{View: Dashboard?};
    C -- Yes --> D[呼叫 loadDashboard(start, end)];
    C -- No --> E[List View: 執行前端過濾];
    D --> F[google.script.run.apiGetGlobalSummary(start, end)];
    F --> G[GAS Backend 接收參數];
    G --> H[DAO: 讀取所有資料];
    H --> I[Service: 依據日期區間過濾資料];
    I --> J[計算 KPI & Stream (使用過濾後資料)];
    I --> K[計算 Pending List (使用未過濾資料)];
    J & K --> L[返回 hudData];
    L --> M[更新 Dashboard UI];
```
以上流程圖闡釋了數據流向和後端過濾的必要性。

我將把這個計畫寫入文件並提交。