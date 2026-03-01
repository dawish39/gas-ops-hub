/**
 * @fileoverview Configuration module using Google Apps Script PropertiesService.
 * This ensures sensitive IDs and configuration values are not hardcoded.
 */

// Global configuration keys used in Script Properties
const PROPERTY_KEYS = {
  SPREADSHEET_ID: 'MAIN_CONFIG_SPREADSHEET_ID', 
  SHEET_LOG_ENTRIES: 'SHEET_LOG_ENTRIES', 
  SHEET_CATEGORIES: 'SHEET_CATEGORIES', 
  
  SHEET_CONFIG: 'SHEET_CONFIG_NAME',     
  SHEET_EMAIL_SETTINGS: 'SHEET_EMAIL_SETTINGS_NAME', 
  SHEET_CATEGORY_CODE_MAP: 'SHEET_CATEGORY_CODE_MAP_NAME', 

  SHEET_REPAIR_CATEGORY: 'SHEET_REPAIR_CATEGORY_NAME', // New: RepairCategory
  SHEET_NEEDS_CATEGORY: 'SHEET_NEEDS_CATEGORY_NAME',   // New: NeedsCategory

  REPORTS_FOLDER_ID: 'REPORTS_FOLDER_ID',
  DATA_SOURCES_FOLDER_ID: 'DATA_SOURCES_FOLDER_ID', // 資料來源資料夾（1_DataSources）
  NEEDS_FOLDER_ID: 'NEEDS_FOLDER_ID',       // 需求統計報表資料夾（3_Analytics）
  REPORT_TEMPLATE_ID: 'REPORT_TEMPLATE_ID',
  
  GUI_CACHE_SS_ID: 'GUI_CACHE_SS_ID',       
  ANALYSIS_SHEET_ID: 'ANALYSIS_SHEET_ID',   
  COMPARISON_FOLDER_ID: 'COMPARISON_FOLDER_ID', 

  // LINE_CHANNEL_ACCESS_TOKEN and other sensitive keys should be added here
};

/**
 * Configuration Manager Class.
 * Retrieves configuration values from Script Properties, prioritizing
 * User properties (for testing) over Script properties (for deployment).
 */
class ConfigManager {
  constructor() {
    this.scriptProperties = PropertiesService.getScriptProperties();
    this.userProperties = PropertiesService.getUserProperties();
    this.cache = {};
  }

  /**
   * Retrieves a configuration value by key.
   * Caches the value for subsequent calls to minimize API calls to PropertiesService.
   * @param {string} key The property key defined in PROPERTY_KEYS.
   * @returns {string|null} The configuration value or null if not found.
   */
  get(key) {
    if (this.cache[key] !== undefined) {
      return this.cache[key];
    }

    // Prioritize user properties (good for development/testing)
    let value = this.userProperties.getProperty(key);
    
    // Fallback to script properties (good for final deployment)
    if (value === null) {
      value = this.scriptProperties.getProperty(key);
    }

    this.cache[key] = value;
    return value;
  }
}

// Export a singleton instance for global use
const CONFIG = new ConfigManager();

/**
 * Global constant reference to the configuration manager instance.
 */
// eslint-disable-next-line no-unused-vars
function getConfig() {
  return CONFIG;
}

/**
 * 初始化 Drive 資料夾結構，確保四個子資料夾存在。
 *
 * @param {string} rootFolderId - 現有根資料夾 ID；空字串則自動建立 'gas-ops-hub-project'
 * @returns {{ rootFolderId: string, folders: { config: string, dataSources: string, reports: string, analytics: string } }}
 * @throws {Error} 若 rootFolderId 有值但無法開啟時拋出
 */
function _initFolders(rootFolderId) {
  let rootFolder;
  if (rootFolderId) {
    try {
      rootFolder = DriveApp.getFolderById(rootFolderId);
    } catch (e) {
      throw new Error('無法開啟根資料夾：' + e.message);
    }
  } else {
    rootFolder = DriveApp.createFolder('gas-ops-hub-project');
  }

  const getOrCreate = (parent, name) => {
    const iter = parent.getFoldersByName(name);
    return iter.hasNext() ? iter.next() : parent.createFolder(name);
  };

  const configFolder      = getOrCreate(rootFolder, '0_Config');
  const dataSourcesFolder = getOrCreate(rootFolder, '1_DataSources');
  const reportsFolder     = getOrCreate(rootFolder, '2_Reports');
  const analyticsFolder   = getOrCreate(rootFolder, '3_Analytics');

  return {
    rootFolderId: rootFolder.getId(),
    folders: {
      config:      configFolder.getId(),
      dataSources: dataSourcesFolder.getId(),
      reports:     reportsFolder.getId(),
      analytics:   analyticsFolder.getId(),
    },
  };
}

/**
 * 初始化專案 Script Properties。
 * 僅需傳入 Config Spreadsheet ID，其餘工作表名稱皆有預設值。
 *
 * 在 GAS 編輯器執行：
 *   initializeProject('YOUR_CONFIG_SS_ID')
 *   initializeProject('YOUR_CONFIG_SS_ID', { lineToken: 'xxx' })
 *   initializeProject('YOUR_CONFIG_SS_ID', { rootFolderId: 'EXISTING_FOLDER_ID' })
 *   initializeProject('YOUR_CONFIG_SS_ID', { rootFolderId: '' })  // 自動建立根資料夾
 *
 * 資料夾初始化（options.rootFolderId 存在時啟用）：
 *   若 rootFolderId 為有效 ID → 開啟現有資料夾
 *   若 rootFolderId 為空字串  → 在根目錄建立 "gas-ops-hub-project"
 *   接著確保以下子資料夾存在（不存在則建立）：
 *     0_Config, 1_DataSources, 2_Reports, 3_Analytics
 *   並自動將 REPORTS_FOLDER_ID、NEEDS_FOLDER_ID、COMPARISON_FOLDER_ID 寫入 ScriptProperties。
 *
 * @param {string} configSsId - 主設定 Spreadsheet ID（必填）
 * @param {Object} [options]  - 選填覆蓋值
 * @param {string} [options.sheetConfig='Config']
 * @param {string} [options.sheetEmail='Email']
 * @param {string} [options.sheetCategoryCodeMap='CategoryCodeMap']
 * @param {string} [options.sheetRepairCategory='RepairCategory']
 * @param {string} [options.sheetNeedsCategory='NeedsCategory']
 * @param {string} [options.lineToken]
 * @param {string} [options.lineUsers]
 * @param {string} [options.reportTemplateId]
 * @param {string} [options.rootFolderId] - 傳入此參數以啟用資料夾初始化。
 *   有效 Drive 資料夾 ID → 使用現有資料夾；空字串 → 自動建立新資料夾。
 * @param {string} [options.reportsFolderIdOverride]    - 直接指定 REPORTS_FOLDER_ID（不呼叫 _initFolders）
 * @param {string} [options.needsFolderIdOverride]      - 直接指定 NEEDS_FOLDER_ID
 * @param {string} [options.comparisonFolderIdOverride] - 直接指定 COMPARISON_FOLDER_ID
 * @returns {string|{success: boolean, rootFolderId: string, folders: {config: string, dataSources: string, reports: string, analytics: string}}}
 *   未傳入 rootFolderId 時回傳執行結果字串；
 *   傳入 rootFolderId 時回傳結構化物件。
 */
// eslint-disable-next-line no-unused-vars
function initializeProject(configSsId, options = {}) {
  if (!configSsId) return '❌ 請提供 Config Spreadsheet ID（第一個參數）';

  // 驗證 Spreadsheet 是否可存取
  let ssName;
  try {
    ssName = SpreadsheetApp.openById(configSsId).getName();
  } catch (e) {
    return `❌ 無法開啟 Spreadsheet（ID: ${configSsId}）：${e.message}`;
  }

  const properties = {
    [PROPERTY_KEYS.SPREADSHEET_ID]:          configSsId,
    [PROPERTY_KEYS.SHEET_CONFIG]:            options.sheetConfig          || 'Config',
    [PROPERTY_KEYS.SHEET_EMAIL_SETTINGS]:    options.sheetEmail           || 'Email',
    [PROPERTY_KEYS.SHEET_CATEGORY_CODE_MAP]: options.sheetCategoryCodeMap || 'CategoryCodeMap',
    [PROPERTY_KEYS.SHEET_REPAIR_CATEGORY]:   options.sheetRepairCategory  || 'RepairCategory',
    [PROPERTY_KEYS.SHEET_NEEDS_CATEGORY]:    options.sheetNeedsCategory   || 'NeedsCategory',
  };

  if (options.lineToken)        properties['LINE_CHANNEL_ACCESS_TOKEN']      = options.lineToken;
  if (options.lineUsers)        properties['LINE_ALLOWED_USERS']              = options.lineUsers;
  if (options.reportTemplateId) properties[PROPERTY_KEYS.REPORT_TEMPLATE_ID] = options.reportTemplateId;

  // ── 資料夾初始化 ──────────────────────────────────────────────────────────
  let folderResult = null;
  if ('rootFolderId' in options) {
    try {
      folderResult = _initFolders(options.rootFolderId);
    } catch (e) {
      return `❌ ${e.message}`;
    }
    properties[PROPERTY_KEYS.REPORTS_FOLDER_ID]       = folderResult.folders.reports;
    properties[PROPERTY_KEYS.DATA_SOURCES_FOLDER_ID]  = folderResult.folders.dataSources;
    properties[PROPERTY_KEYS.NEEDS_FOLDER_ID]          = folderResult.folders.analytics;
    properties[PROPERTY_KEYS.COMPARISON_FOLDER_ID]     = folderResult.folders.analytics;
  } else {
    if (options.reportsFolderIdOverride)      properties[PROPERTY_KEYS.REPORTS_FOLDER_ID]       = options.reportsFolderIdOverride;
    if (options.dataSourcesFolderIdOverride)  properties[PROPERTY_KEYS.DATA_SOURCES_FOLDER_ID]  = options.dataSourcesFolderIdOverride;
    if (options.needsFolderIdOverride)        properties[PROPERTY_KEYS.NEEDS_FOLDER_ID]          = options.needsFolderIdOverride;
    if (options.comparisonFolderIdOverride)   properties[PROPERTY_KEYS.COMPARISON_FOLDER_ID]     = options.comparisonFolderIdOverride;
  }

  PropertiesService.getScriptProperties().setProperties(properties);

  const log = [
    `✅ Config Spreadsheet：「${ssName}」`,
    `✅ 工作表：Config="${properties[PROPERTY_KEYS.SHEET_CONFIG]}", Email="${properties[PROPERTY_KEYS.SHEET_EMAIL_SETTINGS]}"`,
    options.lineToken ? '✅ LINE Token 已設定' : '⚠️  LINE Token 未設定（LINE Bot 功能不可用，可稍後補設）',
    folderResult      ? `✅ 資料夾結構已初始化（root: ${folderResult.rootFolderId}）`
                      : '⚠️  報表資料夾未設定（報表功能不可用，請傳入 rootFolderId 以初始化）',
  ];
  Logger.log(['=== initializeProject 完成 ===', ...log].join('\n'));

  if (folderResult) {
    return { success: true, ...folderResult };
  }
  return ['=== initializeProject 完成 ===', ...log, '', '請重新整理 Web GUI 以套用設定。'].join('\n');
}

/**
 * 自動建立符合 SCHEMA.md 定義的 Config 試算表，並寫入預設資料。
 *
 * 在 GAS 編輯器執行：
 *   provisionConfigSs()
 *   provisionConfigSs({ folderId: 'FOLDER_ID' })
 *   provisionConfigSs({ folderId: 'FOLDER_ID', ssName: 'my-config' })
 *
 * @param {Object}  [options]
 * @param {string}  [options.folderId]              - 要在哪個資料夾建立試算表（選填，留空則建在根目錄）
 * @param {string}  [options.ssName='gas-ops-hub-config'] - 試算表名稱
 * @returns {{ success: true, ssId: string, ssName: string, ssUrl: string }
 *         | { success: false, error: string }}
 */
// eslint-disable-next-line no-unused-vars
function provisionConfigSs(options = {}) {
  try {
    const ssName = options.ssName || 'gas-ops-hub-config';

    // 1. 建立試算表
    const ss = SpreadsheetApp.create(ssName);

    // 2. 將預設 Sheet1 重新命名為 'Config'
    ss.getSheets()[0].setName('Config');

    // 3. 新增其餘工作表
    const statusDefSheet      = ss.insertSheet('StatusDef');
    const emailSheet          = ss.insertSheet('Email');
    const departmentSheet     = ss.insertSheet('Department');
    const categoryCodeMapSheet = ss.insertSheet('CategoryCodeMap');
    const repairCategorySheet = ss.insertSheet('RepairCategory');
    const needsCategorySheet  = ss.insertSheet('NeedsCategory');

    // 4. 若傳入 folderId，移動試算表
    if (options.folderId) {
      DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(options.folderId));
    }

    // 5. 寫入各工作表資料

    // Config（只建 header）
    const configSheet = ss.getSheetByName('Config');
    configSheet.appendRow(['來源名稱', '檔案 ID', '工作表名稱', '啟用', '輸出欄位', 'type']);

    // StatusDef（header + 6 筆預設資料）
    statusDefSheet.getRange(1, 1, 7, 2).setValues([
      ['狀態', '定義'],
      ['○ 待處理', '新進案件，尚未開始'],
      ['➤ 處理中', '正在進行'],
      ['? 待確認', '已完成，等回報或驗收'],
      ['✔ 完成',   '結案'],
      ['‖ 暫停',   '卡在外部因素，暫時不動'],
      ['✖ 取消',   '需求或案件作廢'],
    ]);

    // Email（只建 header）
    emailSheet.appendRow(['recipient', 'cc', 'senderName']);

    // Department（header + 6 筆預設資料）
    departmentSheet.getRange(1, 1, 7, 2).setValues([
      ['部', '組'],
      ['資訊部', '資訊部'],
      ['客務部', '客務組'],
      ['房務部', '房務組'],
      ['業務部', '業務部'],
      ['業務部', '客服組'],
      ['財務部', '財務部'],
    ]);

    // CategoryCodeMap（header + 8 筆預設資料）
    categoryCodeMapSheet.getRange(1, 1, 9, 5).setValues([
      ['代碼', '主項目名稱', '啟用', '說明', '類型'],
      [1, '電腦設備', 'Y', '', 'repair'],
      [2, '網路設備', 'Y', '', 'repair'],
      [3, '軟體系統', 'Y', '', 'repair'],
      [4, '帳號權限', 'Y', '', 'repair'],
      [5, '系統開發', 'Y', '', 'needs'],
      [6, '報表需求', 'Y', '', 'needs'],
      [7, '流程優化', 'Y', '', 'needs'],
      [8, '其他',     'N', '', 'needs'],
    ]);

    // RepairCategory（A 欄純文字 → header + 5 筆資料）
    repairCategorySheet.getRange('A:A').setNumberFormat('@');
    repairCategorySheet.getRange(1, 1, 6, 6).setValues([
      ['ID', '子項目', '主項目名稱', '啟用', '登錄時間', '備註'],
      ['101', '無法開機', '電腦設備', 'Y', '2026-01-01', ''],
      ['102', '螢幕異常', '電腦設備', 'Y', '2026-01-01', ''],
      ['201', '無法連線', '網路設備', 'Y', '2026-01-01', ''],
      ['301', '系統錯誤', '軟體系統', 'Y', '2026-01-01', ''],
      ['401', '帳號鎖定', '帳號權限', 'Y', '2026-01-01', ''],
    ]);

    // NeedsCategory（A 欄純文字 → header + 4 筆資料）
    needsCategorySheet.getRange('A:A').setNumberFormat('@');
    needsCategorySheet.getRange(1, 1, 5, 6).setValues([
      ['ID', '子項目', '主項目名稱', '啟用', '登錄時間', '備註'],
      ['501', '新功能開發', '系統開發', 'Y', '2026-01-01', ''],
      ['601', '月報表',     '報表需求', 'Y', '2026-01-01', ''],
      ['701', '流程自動化', '流程優化', 'Y', '2026-01-01', ''],
      ['702', 'SOP 文件化', '流程優化', 'Y', '2026-01-01', ''],
    ]);

    // 6. 回傳結構化結果
    return {
      success: true,
      ssId:    ss.getId(),
      ssName:  ss.getName(),
      ssUrl:   ss.getUrl(),
    };

  } catch (e) {
    return { success: false, error: e.message };
  }
}
