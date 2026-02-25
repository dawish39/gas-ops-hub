/**
 * @fileoverview schema.gs — 系統 Schema 文件（唯讀）
 *
 * 本檔案不含任何可執行邏輯。
 * 目的：用 JSDoc @typedef 定義整個 gas-ops-hub 的資料合約，
 * 包含所有 ScriptProperties key、readConfig() 回傳結構、
 * 以及模組間的隱含依賴關係。
 *
 * 閱讀順序建議：
 *   1. SECTION A — ScriptProperties 清單
 *   2. SECTION B — readConfig() 回傳型別
 *   3. SECTION C — 模組間隱含依賴（Property 作為訊號管道）
 *   4. SECTION D — 其他共用資料型別
 *
 * @version 1.0.0
 * @see config.js        ConfigManager / PROPERTY_KEYS 定義
 * @see dao.js           BaseDAO / ConfigDAO / LogEntryDAO / CategoryDAO
 * @see main.js          readConfig() / readMailSettings() 工具函式
 * @see api_web_gui.js   Controller 層，呼叫所有 Service / DAO
 * @see api_line_bot.js  LINE Bot Controller
 * @see report_v2.js     日報產生服務
 * @see mail.js          郵件寄送服務
 * @see analytics.js     統計分析服務
 * @see triggers.js      時間驅動觸發器
 * @see category_management.js  分類管理服務
 * @see lib_gemini.js    Gemini AI 解析服務
 */

// =============================================================================
// SECTION A — ScriptProperties 清單
// =============================================================================
//
// 讀取優先權：UserProperties（開發用）> ScriptProperties（部署用）
// 所有讀取皆透過 ConfigManager.get(key)，除下方標注「直接存取」者例外。
//
// ┌──────────────────────────────────┬──────────────────────────────────────┬──────────────────────────────────────┬────────────────────────────────────┐
// │  Property Key（實際字串）          │ PROPERTY_KEYS 別名                    │ 寫入者                                │ 讀取者                              │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ MAIN_CONFIG_SPREADSHEET_ID       │ PROPERTY_KEYS.SPREADSHEET_ID         │ initializeProject()                  │ ConfigDAO, provisionSource(),       │
// │                                  │                                      │ apiSetupProject()                    │ apiGetProjectStatus()（直接存取）   │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ SHEET_CONFIG_NAME                │ PROPERTY_KEYS.SHEET_CONFIG           │ initializeProject()（預設值 "Config"）│ ConfigDAO.configSheetName           │
// │                                  │                                      │                                      │ provisionSource()                   │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ SHEET_EMAIL_SETTINGS_NAME        │ PROPERTY_KEYS.SHEET_EMAIL_SETTINGS   │ initializeProject()（預設值 "Email"） │ ConfigDAO.emailSheetName            │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ SHEET_CATEGORY_CODE_MAP_NAME     │ PROPERTY_KEYS.SHEET_CATEGORY_CODE_MAP│ initializeProject()（預設值          │ getCategoryDao(SHEET_CATEGORY_CODE_MAP)│
// │                                  │                                      │   "CategoryCodeMap"）                │                                    │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ SHEET_REPAIR_CATEGORY_NAME       │ PROPERTY_KEYS.SHEET_REPAIR_CATEGORY  │ initializeProject()（預設值          │ getCategoryDao(SHEET_REPAIR_CATEGORY)│
// │                                  │                                      │   "RepairCategory"）                 │ apiGetFormOptions()                 │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ SHEET_NEEDS_CATEGORY_NAME        │ PROPERTY_KEYS.SHEET_NEEDS_CATEGORY   │ initializeProject()（預設值          │ getCategoryDao(SHEET_NEEDS_CATEGORY) │
// │                                  │                                      │   "NeedsCategory"）                  │ apiGetFormOptions()                 │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ REPORTS_FOLDER_ID                │ PROPERTY_KEYS.REPORTS_FOLDER_ID      │ initializeProject()                  │ report_v2.generateReport()          │
// │                                  │                                      │                                      │ analytics.createNewStatsSheet()     │
// │                                  │                                      │                                      │ analytics.outputCategoryStatsToSheet│
// │                                  │                                      │                                      │ apiGetProjectStatus()（直接存取）   │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ REPORT_TEMPLATE_ID               │ PROPERTY_KEYS.REPORT_TEMPLATE_ID     │ initializeProject()                  │ report_v2.generateReport()          │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ GUI_CACHE_SS_ID                  │ PROPERTY_KEYS.GUI_CACHE_SS_ID        │ api_web_gui.getOrInitCacheSS()       │ api_web_gui.getOrInitCacheSS()      │
// │                                  │                                      │   （自動建立，若不存在）             │                                    │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ ANALYSIS_SHEET_ID                │ PROPERTY_KEYS.ANALYSIS_SHEET_ID      │ （未設定則由 analytics 建立新 SS）    │ analytics.outputStatsToSheet()      │
// │                                  │                                      │                                      │ analytics.writeToAnalysisSheet()    │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ COMPARISON_FOLDER_ID             │ PROPERTY_KEYS.COMPARISON_FOLDER_ID   │ （手動設定）                         │ analytics.exportComparisonStats()   │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │  ── 未收錄進 PROPERTY_KEYS 的 raw key ──                                                                                                            │
// ├──────────────────────────────────┬──────────────────────────────────────┬──────────────────────────────────────┬────────────────────────────────────┤
// │ LINE_CHANNEL_ACCESS_TOKEN        │ （無別名，直接用字串）                │ initializeProject()                  │ api_line_bot.replyToLine()          │
// │                                  │                                      │                                      │ apiGetProjectStatus()（直接存取）   │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ LINE_ALLOWED_USERS               │ （無別名）                            │ initializeProject()                  │ api_line_bot.getAllowedUsers_()     │
// │                                  │                                      │                                      │ （逗號分隔 userId 字串）            │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ WEB_APP_URL                      │ （無別名）                            │ （手動設定，未由程式寫入）            │ api_line_bot.processUserMessage()   │
// │                                  │                                      │                                      │ 透過 getConfig().get("WEB_APP_URL") │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ GEMINI_API_KEY                   │ （無別名）                            │ （手動設定）                         │ lib_gemini.callGeminiParser()      │
// │                                  │                                      │                                      │ 直接呼叫 getScriptProperties()      │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ LAST_REPORT_ID                   │ （無別名）                            │ report_v2.generateReport()           │ mail.sendReport()                  │
// │                                  │                                      │                                      │ ⚠️ 關鍵訊號管道，見 SECTION C       │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ CATEGORY_CODE_MAP                │ （無別名）                            │ category_management.getCategoryCode()│ category_management.getCategoryCode()│
// │                                  │                                      │ category_management.refreshCategory  │ （JSON 字串快取，見 SECTION C）     │
// │                                  │                                      │   CodeCache()                        │                                    │
// ├──────────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────┤
// │ ⚠️ SHEET_LOG_ENTRIES              │ PROPERTY_KEYS.SHEET_LOG_ENTRIES      │ （未使用——已定義但無讀寫呼叫）        │ ——                                 │
// │ ⚠️ SHEET_CATEGORIES              │ PROPERTY_KEYS.SHEET_CATEGORIES       │ （未使用——已定義但無讀寫呼叫）        │ ——                                 │
// │ ⚠️ NEEDS_FOLDER_ID               │ PROPERTY_KEYS.NEEDS_FOLDER_ID        │ ❌ 未定義於 PROPERTY_KEYS！            │ analytics.createNewStatsSheet()     │
// │                                  │                                      │    CONFIG.get(undefined) → null      │ analytics.outputCategoryStatsToSheet│
// └──────────────────────────────────┴──────────────────────────────────────┴──────────────────────────────────────┴────────────────────────────────────┘
//
// ⚠️ 已知缺陷：PROPERTY_KEYS 中沒有定義 NEEDS_FOLDER_ID，
//    但 analytics.js 的兩個函式呼叫 CONFIG.get(PROPERTY_KEYS.NEEDS_FOLDER_ID)，
//    因為 PROPERTY_KEYS.NEEDS_FOLDER_ID === undefined，get(undefined) 會回傳 null，
//    導致需求統計報表永遠存在根目錄而不會移至指定資料夾。


// =============================================================================
// SECTION B — readConfig() 回傳型別
// =============================================================================

/**
 * 單一資料來源設定物件。
 * 由 ConfigDAO.readSourceList() 從主設定 Spreadsheet 的 Config 工作表讀取。
 *
 * Config 工作表欄位對應：
 *   A  = name          (來源名稱)
 *   B  = id            (Spreadsheet 檔案 ID)
 *   C  = sheet         (工作表名稱)
 *   D  = Enabled       (Y/N，篩選條件，不含於回傳物件)
 *   E  = outputColumns (輸出欄位設定字串，由 parseOutputColumns() 解析)
 *   F  = type          (來源類型)
 *
 * @typedef {Object} SourceConfig
 * @property {string} name
 *   來源顯示名稱，例如 "報修記錄 2025"。
 *   用於 api_line_bot.writeToWorkLogSheet() 的 matchSource 邏輯，
 *   以及 api_web_gui.apiCreateTask() / apiUpdateTask() 的 sourceName 比對。
 * @property {string} id
 *   目標 Google Spreadsheet 的 Drive 檔案 ID。
 *   傳入 LogEntryDAO constructor，作為 SpreadsheetApp.openById() 參數。
 * @property {string} sheet
 *   目標工作表名稱，例如 "repair log"。
 *   傳入 LogEntryDAO constructor，作為 getSheetByName() 參數。
 * @property {Array<number>|Array<string>|null} outputColumns
 *   parseOutputColumns() 解析後的輸出欄位設定：
 *   - Array<number>：欄位索引（0-based），例如 [0, 1, 2, 3]
 *   - Array<string>：欄位名稱，例如 ["狀態", "項目", "處理進度簡述"]
 *   - null：輸出全部欄位（E 欄留空時）
 *   用於 report_v2.filterColumnsByConfig()。
 * @property {string} type
 *   來源類型識別符，小寫：
 *   - "repair"：報修記錄
 *   - "daily"：資訊日報 / 工作記錄
 *   - "needs"：部門需求
 *   用於 analytics 的 sourceType 篩選、api_line_bot 的 targetMode 路由。
 */

/**
 * readConfig() 回傳值。
 *
 * 呼叫路徑：
 *   readConfig()  (main.js)
 *     → getMainConfigDAO()  (dao.js)
 *       → ConfigDAO.readSourceList()  (dao.js)
 *
 * 只回傳 Config 工作表中 D 欄 = "Y" 的列。
 *
 * @typedef {Array<SourceConfig>} ReadConfigResult
 */


// =============================================================================
// SECTION C — 模組間隱含依賴（ScriptProperty 作為訊號管道）
// =============================================================================

/**
 * @namespace ImplicitDependencies
 * @description
 * 以下三條依賴鏈「不透過函式參數傳遞」，改用 ScriptProperties 作為共享狀態，
 * 因此無法從函式簽名看出耦合關係，須特別留意。
 *
 * ─────────────────────────────────────────────────────────────────────
 * [A] generateReport → sendReport  via  LAST_REPORT_ID
 * ─────────────────────────────────────────────────────────────────────
 *
 *   觸發者：triggers.dailyJob()
 *     1. generateReport()  ← report_v2.js
 *           在完成時執行：
 *           PropertiesService.getScriptProperties()
 *             .setProperty("LAST_REPORT_ID", copy.getId())
 *
 *     2. Utilities.sleep(5000)  ← 延遲 5 秒，等待 Drive 檔案同步
 *
 *     3. sendReport()  ← mail.js
 *           在開頭讀取：
 *           const reportId = props.getProperty("LAST_REPORT_ID")
 *           若 reportId 為 null，寄送錯誤通知信。
 *           若 reportId 對應的檔案名稱不包含今天日期，寄送錯誤通知信。
 *
 *   ⚠️ 風險：
 *   - 若 generateReport() 拋出例外，LAST_REPORT_ID 不會被更新，
 *     sendReport() 會讀到舊的（昨天的）Report ID，並因日期不符而失敗。
 *   - LAST_REPORT_ID 僅記錄「最後一次」產生的報表，
 *     手動重跑 generateReport() 會覆蓋前值。
 *
 * ─────────────────────────────────────────────────────────────────────
 * [B] getCategoryCode() 讀寫快取  via  CATEGORY_CODE_MAP
 * ─────────────────────────────────────────────────────────────────────
 *
 *   寫入者（category_management.js）：
 *     getCategoryCode(mainCategory)
 *       若 ScriptProperties["CATEGORY_CODE_MAP"] 不存在：
 *         map = getCategoryCodeMap()   ← 讀 CategoryCodeMap Sheet
 *         setProperty("CATEGORY_CODE_MAP", JSON.stringify(map))
 *     refreshCategoryCodeCache()
 *         强制重新讀取 Sheet 並更新 ScriptProperties
 *
 *   讀取者（category_management.js）：
 *     getCategoryCode(mainCategory)
 *       先讀 ScriptProperties["CATEGORY_CODE_MAP"]（JSON 字串）
 *       命中則不讀 Sheet，直接 map[mainCategory] || "99"
 *     batchGenerateIdsForSheet()
 *     smartFixIdsForSheet()
 *       皆透過 getCategoryCode() 間接使用快取
 *
 *   ⚠️ 風險：
 *   - CategoryCodeMap Sheet 更新後，若未執行 refreshCategoryCodeCache()，
 *     分類 ID 生成仍會使用舊的快取值。
 *   - ScriptProperties 有 9 KB/value 限制；若分類數量過多，
 *     JSON 字串可能超出上限導致寫入失敗。
 *
 * ─────────────────────────────────────────────────────────────────────
 * [C] getOrInitCacheSS() 自我初始化  via  GUI_CACHE_SS_ID
 * ─────────────────────────────────────────────────────────────────────
 *
 *   api_web_gui.getOrInitCacheSS()：
 *     1. 讀取 ScriptProperties["GUI_CACHE_SS_ID"]
 *     2. 若存在 → 嘗試開啟，成功則回傳
 *     3. 若不存在或開啟失敗 → 建立新 SS "System_Analysis_Cache (Do Not Delete)"
 *        並將新 SS ID 寫回 ScriptProperties["GUI_CACHE_SS_ID"]
 *
 *   使用者：
 *     generateAnalysisReport()  ← api_web_gui.js
 *       將統計圖表暫存於此 SS，再轉為 base64 PNG 回傳前端
 *
 *   ⚠️ 風險：
 *   - 若手動刪除該 SS，下次呼叫時 openById() 會拋出例外，
 *     catch 後自動建立新 SS 並更新 Property，行為符合預期，但會失去舊的快取。
 *   - 若多個執行緒同時初始化，可能產生多個孤立的 Cache SS（無 Lock 保護）。
 */


// =============================================================================
// SECTION D — 其他共用資料型別
// =============================================================================

/**
 * 郵件設定物件，由 readMailSettings() (main.js) 回傳。
 *
 * 讀取路徑：
 *   readMailSettings()
 *     → getMainConfigDAO().readMailSettings()  (dao.js)
 *       → Email 工作表，第 2 列，A~C 欄
 *
 * @typedef {Object} MailSettings
 * @property {string} to           主收件人 email
 * @property {string|null} cc      副本 email（逗號分隔字串），若為空則 null
 * @property {null} bcc            密件副本（目前固定為 null，預留擴充）
 * @property {string} senderName  寄件者顯示名稱
 */

/**
 * Gemini AI 解析結果，由 lib_gemini.callGeminiParser() 回傳。
 *
 * @typedef {Object} GeminiParseResult
 * @property {string} item      工作項目標題（簡短）
 * @property {string} progress  處理進度詳述
 * @property {string} status    狀態字串，必須為以下其一：
 *   - "○ 待處理"
 *   - "➤ 處理中"
 *   - "? 待確認"
 *   - "✔ 完成"
 *   - "‖ 暫停"
 *   - "✖ 取消"
 */

/**
 * 來源資料類型定義（用於 provisionSource() 的 SOURCE_SCHEMAS）。
 *
 * @typedef {"repair"|"daily"|"needs"} SourceType
 */

/**
 * 分類定義物件，由 readCategoryDefGeneric() (category_management.js) 回傳。
 *
 * 欄位對應（RepairCategory / NeedsCategory 工作表）：
 *   Col 0 = id            (分類 ID，3-4 位數字)
 *   Col 1 = subCategory   (子項目)
 *   Col 2 = mainCategory  (主項目)
 *   Col 3 = enabled       ("Y"|"N")
 *   Col 4 = effectiveDate (生效日期，選填)
 *   Col 5 = note          (備註，選填)
 *
 * @typedef {Object} CategoryDefinition
 * @property {string} id            分類 ID（3-4 位數字字串）
 * @property {string} subCategory   子項目名稱
 * @property {string} mainCategory  主項目名稱
 * @property {string} enabled       "Y"（readCategoryDefGeneric 只回傳 enabled=Y 的列）
 * @property {string} effectiveDate 生效日期（可為空字串）
 * @property {string} note          備註（可為空字串）
 */

/**
 * Log Sheet 單筆記錄在前端的表示格式，由 apiGetSheetData() (api_web_gui.js) 回傳。
 *
 * @typedef {Object} LogEntry
 * @property {number} id          絕對列號（1-based，含表頭列）
 * @property {string} uuid        UUID 欄位值（可為空字串）
 * @property {string} status      狀態文字
 * @property {string} date        新增日期（格式 "yyyy/MM/dd"）
 * @property {string} item        項目標題
 * @property {string} progress    處理進度簡述
 * @property {string} updated     最後更新時間（格式 "yyyy/MM/dd"）
 * @property {string} category    分類（報修項目 / 需求類型）
 * @property {string} dept        單位（報修單位(組) / 需求單位(組)）
 * @property {string} link        Google Sheets 深層連結（直接跳到該列）
 */

/**
 * 儀表板 KPI 數據，由 apiGetGlobalSummary() (api_web_gui.js) 回傳的 kpi 欄位。
 *
 * @typedef {Object} DashboardKpi
 * @property {number} todayNew      今日新增案件總數（依新增日期）
 * @property {number} todayDone     今日完成案件總數（依最後更新時間判斷）
 * @property {number} pendingTotal  全部未完成案件總數（排除「完成」「取消」狀態）
 */

/**
 * apiGetGlobalSummary() 完整回傳結構。
 *
 * @typedef {Object} GlobalSummaryPayload
 * @property {DashboardKpi}  kpi     KPI 聚合數字
 * @property {LogEntry[]}    stream  今日活動串流（最多 50 筆，依列號倒序）
 * @property {LogEntry[]}    pending 全部待辦清單（最多 50 筆，依狀態優先權+日期倒序）
 */

/**
 * apiGetProjectStatus() 回傳結構。
 * 不依賴 getConfig()，即使 Script Properties 尚未初始化也可呼叫。
 *
 * @typedef {Object} ProjectStatus
 * @property {boolean} isConfigured     MAIN_CONFIG_SPREADSHEET_ID 是否已設定
 * @property {string}  configSsId       MAIN_CONFIG_SPREADSHEET_ID 的值（空字串表示未設定）
 * @property {boolean} hasLineToken     LINE_CHANNEL_ACCESS_TOKEN 是否已設定
 * @property {boolean} hasReportsFolder REPORTS_FOLDER_ID 是否已設定
 */
