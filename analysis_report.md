# 三向驗證分析報告：IT Logbook 系統

本報告旨在對 IT Logbook 系統的文件 (`README.md`)、核心源碼 (`api_line_bot.js`, `api_web_gui.js`, `dao.js`) 及 Mermaid 流程圖進行交叉比對，以驗證其一致性並揭示潛在的差異。

## 1. 總體一致性評估

整體而言，系統的 `README.md` 文件與核心源碼的實現有著高度的一致性。文件的架構圖、資料流程和函式職責描述，都準確地反映了程式碼的實際行為。這表明文件有被良好地維護，可作為理解系統的主要參考。

- **`README.md` vs. 源碼**：文件準確描述了 `api_line_bot.js` 作為 LINE Webhook 入口、`api_web_gui.js` 作為 Web GUI 後端，以及 `dao.js` 作為資料存取層的核心職責。
- **Mermaid 流程圖 vs. 源碼**：圖表清晰地展示了使用者請求的處理路徑，與程式碼中的函式呼叫鏈（例如 `doPost` -> `processUserMessage` -> `writeToWorkLogSheet` -> `getLogEntryDAO`）完全相符。

## 2. 發現的差異點與分析

儘管總體一致，但在細節層面仍發現一些文件與實作之間的微小差異或未明確說明的行為。這些差異不影響系統核心功能的理解，但值得注意。

### 2.1. `api_line_bot.js` 的路由邏輯細節

- **文件描述**: `README.md` 說明 `processUserMessage` 函式會根據訊息內容（如 "儀表板", "日報"）進行路由。
- **源碼實現**: `api_line_bot.js` 的 `processUserMessage` 函式使用了正則表達式 `match(/^(日報|info|daily)/i)` 等模式來匹配關鍵字。此外，程式碼中還包含了文件中未提及的 **Help (`?`) 路由**，用於回傳指令說明。
- **一致性分析**: **高度一致**。源碼的實現方式比文件的描述更具體。文件省略了 Help 指令這個次要功能，屬於合理的簡化。

### 2.2. 資料寫入的目標工作表選擇邏輯

- **文件描述**: `README.md` 在 `sequenceDiagram` 中描述的流程為 `LineBot->>DAO: getLogEntryDAO(source)`，接著 `LineBot->>GSheet: writeToWorkLogSheet(data)`。這給人的印像是 `writeToWorkLogSheet` 函式是直接被呼叫的。
- **源碼實現**: `api_line_bot.js` 的 `writeToWorkLogSheet` 函式內部，會先呼叫 `readConfig()` 讀取所有可用的資料來源 (sources)，然後根據 `targetMode` (repair, daily, needs) 透過 `matchSource` 函式來**動態尋找**最匹配的工作表。如果找不到精確匹配，它會使用設定檔中的第一個來源 (`sources[0]`) 作為備援 (fallback)。
- **一致性分析**: **中度一致**。文件的流程圖為了簡潔性，省略了「動態尋找目標 Sheet」這一步。源碼的邏輯比圖表更複雜且更具彈性，包含了備援機制，這是文件未提及的重要細節。

### 2.3. DAO (資料存取物件) 的角色與互動

- **文件描述**: `README.md` 正確地將 `dao.js` 定義為一個抽象層，封裝了對 Google Sheets 的底層操作，並提供了 `getLogEntryDAO(source)` 的工廠函式。
- **源碼實現**: `dao.js` 的 `getLogEntryDAO(src)` 函式實現了**快取機制** (`DAO_MAP`)，避免對同一個 Spreadsheet 和 Sheet 重複建立 DAO 實例。此外，`ConfigDAO` 和 `CategoryDAO` 的職責也被清晰地分離。
- **一致性分析**: **高度一致**。源碼包含了文件中未提及的性能優化（DAO 實例快取），這屬於實現層面的細節，不影響對架構的理解。

### 2.4. `api_web_gui.js` 的快取機制

- **文件描述**: `README.md` 在「系統上限分析」一章中提到了 `api_web_gui.js` 中加入了 `CacheService` 快取機制，以避免每次刷新都重新計算儀表板數據。
- **源碼實現**: `api_web_gui.js` 中明確包含了 `clearDashboardCache()` 函式，並在 `apiCreateTask` 和 `apiUpdateTask` 函式的結尾處呼叫它。這確保了在資料發生變更時，快取會被清除，前端下次讀取時能獲取最新數據。
- **一致性分析**: **完全一致**。源碼的實現細節（快取失效機制）完美地印證了文件中的描述。

## 3. 結論與建議

`IT Logbook` 系統的技術文件與其實際程式碼之間維護得相當出色，展現了良好的開發實踐。

1.  **一致性**: 核心架構、主要資料流程和模組職責在文件和程式碼之間是完全一致的。Mermaid 圖表準確地描繪了系統的高階工作流程。
2.  **細節差異**: 發現的差異點主要源於文件對實現細節的合理簡化（如錯誤處理、備援邏輯、性能優化），這些差異不構成誤導。
3.  **改進建議**:
    - **輕微**: 可考慮在 `README.md` 中以註解形式，簡要提及 `writeToWorkLogSheet` 的動態目標選擇邏輯與備援機制，這能讓維護者更快理解其彈性設計。
    - **無需修改**: 像 DAO 快取、Help 指令等細節，保留在程式碼中即可，無需增加文件的複雜度。

總體而言，本次三向驗證的結果是正面的，可以確認 `README.md` 是理解和維護此系統的可靠起點。