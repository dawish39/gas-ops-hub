# 專案潛在資安風險評估報告

## 1. 關鍵風險點列表

目前專案基於 GAS/Web App 的特性，存在以下潛在的資安風險。

| 風險編號 | 資安風險點 | 說明 |
| :--- | :--- | :--- |
| **S1** | **XSS (Cross-Site Scripting)** | Web GUI ([`src/index.html`](src/index.html:1)) 中的 HTML 輸出是否經過嚴格過濾？如果未經 `HtmlService.createTemplateFromFile().evaluate()` 處理，或使用 `HtmlService.createHtmlOutput()` 但未正確轉義外部內容，可能導致 XSS 攻擊。 |
| **S2** | **Formula Injection (公式注入)** | 寫入 SpreadSheet 的文本數據 (例如 Line Bot 訊息或 Web GUI 欄位) 是否有開頭為 `=`、`+`、`-`、`@` 等符號？如果未經清洗，攻擊者可藉此執行惡意 Spreadsheet 公式。 |
| **S3** | **Web App 權限洩漏** | Web App (`doGet`/`doPost`) 部署的執行身分權限是否過高？如果以「使用者本人」身份執行，當惡意用戶訪問時，可能洩露該使用者的 Google 身份和數據。 |
| **S4** | **Line Bot 白名單繞過** | [`src/api_line_bot.js`](src/api_line_bot.js:12) 中的 `ALLOWED_USERS` 是硬編碼。一旦程式碼外流，惡意用戶可能知道如何繞過或嘗試猜測 User ID 訪問系統。 |
| **S5** | **配置屬性洩露** | 專案中儲存在 `PropertiesService` 的 Key (如 LINE Token, Folder ID) 雖然相對安全，但如果程式碼中存在未經授權的讀取路徑或錯誤地將其輸出到前端，仍有洩露風險。 |
| **S6** | **DDOS/資源耗盡 (Web)** | Web App 的 API（如 `apiGetGlobalSummary`）執行時間長，且未對請求進行限制。單一攻擊者或惡意腳本頻繁調用可能迅速耗盡 GAS 的每日配額 (Quota)。 |

---

## 2. 待辦事項更新 (保留優化計畫)

為了保持架構升級的軌道，我將性能優化和 Line Bot 管理的計畫保留在您的待辦清單中。

| # | 項目 | 狀態 | 來源 |
| :--- | :--- | :--- | :--- |
| **1.** | **實作 Web GUI 預熱觸發器** | Completed (Code Ready) | [`src/triggers.js`](src/triggers.js:63) |
| **2.** | **Line 使用者管理優化** (Spreadsheet + Cache) | Pending | [`plans/line_user_management_plan.md`](plans/line_user_management_plan.md:1) |
| **3.** | **Web GUI 前端配置抽象化** | Pending | [`plans/plan_c_abstraction.md`](plans/plan_c_abstraction.md:1) |

請問您對上述資安風險評估是否有任何現有處理方式或緩解措施可以提供？