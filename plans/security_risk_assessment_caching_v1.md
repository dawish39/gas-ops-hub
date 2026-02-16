# 快取策略資安風險評估報告

**文件編號:** `SEC-CACHE-20260204-02`
**日期:** 2026-02-04
**主題:** 針對 `plans/caching_spec_v1.md` 提出之快取策略進行資安風險評估。

---

## 1. 概述

本報告旨在評估在 IT Logbook 系統中使用 Google Apps Script 的 `CacheService` 可能帶來的資訊安全風險，特別是 `ScriptCache` (腳本快取) 與 `UserCache` (使用者快取) 之間的選擇。

**評估前註記:** 本次評估未能定位到名為「全域後端計算函式分析報告」的既有文件。因此，以下的函式分析是基於對核心後端檔案 [`src/api_web_gui.js`](src/api_web_gui.js:1) 的直接程式碼審查。

---

## 2. `CacheService` 範疇分析

`CacheService` 提供了兩種不同範疇的快取機制，其選擇對系統的安全性至關重要。

| 特性 | `CacheService.getScriptCache()` | `CacheService.getUserCache()` |
| :--- | :--- | :--- |
| **資料可見性** | **所有使用者共享** | **每個使用者獨立** |
| **生命週期** | 與腳本執行實例相關 | 與執行腳本的單一使用者綁定 |
| **儲存空間** | 100MB | 100MB (每個使用者) |
| **適用場景** | 儲存對所有用戶都相同的通用資料，例如系統設定、公開的報表數據、非個人化的下拉選單選項等。 | 儲存僅限特定使用者存取的個人化資料，例如「我回報的任務」、個人偏好設定、草稿等。 |
| **風險** | **高風險。** 若誤將使用者特定資料存入，將導致嚴重的**跨使用者資料洩漏**。A 使用者的資料可能會被 B 使用者讀取。 | **低風險。** 資料被隔離在使用者層級，天然地防止了跨使用者資料洩漏。 |

---

## 3. 跨使用者資料洩漏風險評估

基於對 `src/api_web_gui.js` 的分析，以下是針對主要後端計算函式提出的快取策略建議。

**核心評估原則:** 經審查，目前所有用於儀表板和分析的後端函式 (`apiGetGlobalSummary`, `apiGetAnalysisData`, `apiGetTrendData` 等) 皆是從共享的資料來源 (`Spreadsheet`) 進行數據匯總，並且**不包含**任何基於 `Session.getActiveUser().getEmail()` 的個人化資料過濾邏輯。回傳的結果對於所有使用者都是一致的。

### 全域後端計算函式快取策略建議表

| 函式名稱 | 檔案位置 | 是否適合快取 | 建議快取類型 | 理由 |
| :--- | :--- | :--- | :--- | :--- |
| `apiGetGlobalSummary` | `src/api_web_gui.js` | 是 | `ScriptCache` | 回傳全域 KPI、最新動態與待處理項目，對所有使用者均相同。 |
| `apiGetAnalysisData` | `src/api_web_gui.js` | 是 | `ScriptCache` | 根據傳入的類型與期間產生統計報告，結果不因使用者而異。 |
| `apiGetTrendData` | `src/api_web_gui.js` | 是 | `ScriptCache` | 回傳指定時間範圍內的趨勢分析數據，屬於公開資訊。 |
| `apiGetFormOptions` | `src/api_web_gui.js` | 是 | `ScriptCache` | 提供表單所需的下拉選單選項 (部門、分類)，此為全域設定。 |
| `apiGetAdminMenu` | `src/api_web_gui.js` | 是 | `ScriptCache` | 回傳靜態的後台管理菜單結構。 |

---

## 4. 風險應對與結論

**目前風險等級: 低**

根據現有程式碼，`plans/caching_spec_v1.md` 中提議使用 `ScriptCache` 的策略是**安全的**，因為被快取的函式回傳的是全域共享數據。

**緩解策略與未來開發準則:**

1.  **嚴格遵守建議:** 對於上表所列函式，可安全採用 `ScriptCache` 以提升系統性能。
2.  **使用者特定功能必須使用 `UserCache`:** 未來若新增任何個人化功能 (例如，「我關注的任務」、「我的草稿」)，其對應的後端資料獲取函式**必須強制使用 `UserCache`**，絕不允許使用 `ScriptCache`。
3.  **程式碼審查 (Code Review):** 在任何新的快取邏輯上線前，必須進行程式碼審查，確認快取類型 (`ScriptCache`/`UserCache`) 的選擇是否正確，以防止潛在的資料洩漏。

**總結:**
當前架構下，`ScriptCache` 的使用是恰當的。然而，團隊必須建立明確的開發規範，確保在未來擴充功能時，能夠正確區分共享數據與個人數據，並為後者選擇 `UserCache`，以維護系統的資訊安全。
