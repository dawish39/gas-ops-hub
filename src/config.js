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
 * 初始化專案 Script Properties。
 * 僅需傳入 Config Spreadsheet ID，其餘工作表名稱皆有預設值。
 *
 * 在 GAS 編輯器執行：
 *   initializeProject('YOUR_CONFIG_SS_ID')
 *   initializeProject('YOUR_CONFIG_SS_ID', { lineToken: 'xxx', reportsFolderId: 'yyy' })
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
 * @param {string} [options.reportsFolderId]
 * @param {string} [options.reportTemplateId]
 * @param {string} [options.rootFolderId] - 傳入此參數以啟用資料夾初始化。
 *   有效 Drive 資料夾 ID → 使用現有資料夾；空字串 → 自動建立新資料夾。
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
  if (options.reportsFolderId)  properties[PROPERTY_KEYS.REPORTS_FOLDER_ID]  = options.reportsFolderId;
  if (options.reportTemplateId) properties[PROPERTY_KEYS.REPORT_TEMPLATE_ID] = options.reportTemplateId;

  // ── 資料夾初始化（options.rootFolderId 存在於 options 時啟用）──────────────
  let folderResult = null;
  if ('rootFolderId' in options) {
    let rootFolder;
    if (options.rootFolderId) {
      try {
        rootFolder = DriveApp.getFolderById(options.rootFolderId);
      } catch (e) {
        return `❌ 無法開啟根資料夾（ID: ${options.rootFolderId}）：${e.message}`;
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

    properties[PROPERTY_KEYS.REPORTS_FOLDER_ID]    = reportsFolder.getId();
    properties[PROPERTY_KEYS.NEEDS_FOLDER_ID]      = analyticsFolder.getId();
    properties[PROPERTY_KEYS.COMPARISON_FOLDER_ID] = analyticsFolder.getId();

    folderResult = {
      rootFolderId: rootFolder.getId(),
      folders: {
        config:      configFolder.getId(),
        dataSources: dataSourcesFolder.getId(),
        reports:     reportsFolder.getId(),
        analytics:   analyticsFolder.getId()
      }
    };
  }

  PropertiesService.getScriptProperties().setProperties(properties);

  const log = [
    `✅ Config Spreadsheet：「${ssName}」`,
    `✅ 工作表：Config="${properties[PROPERTY_KEYS.SHEET_CONFIG]}", Email="${properties[PROPERTY_KEYS.SHEET_EMAIL_SETTINGS]}"`,
    options.lineToken ? '✅ LINE Token 已設定' : '⚠️  LINE Token 未設定（LINE Bot 功能不可用，可稍後補設）',
    folderResult      ? `✅ 資料夾結構已初始化（root: ${folderResult.rootFolderId}）`
                      : (options.reportsFolderId ? '✅ 報表資料夾已設定' : '⚠️  報表資料夾未設定（報表功能不可用，可稍後補設）'),
  ];
  Logger.log(['=== initializeProject 完成 ===', ...log].join('\n'));

  if (folderResult) {
    return { success: true, ...folderResult };
  }
  return ['=== initializeProject 完成 ===', ...log, '', '請重新整理 Web GUI 以套用設定。'].join('\n');
}
