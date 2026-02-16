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

// Optional: Add a setup function to populate properties easily
// eslint-disable-next-line no-unused-vars
function setInitialProperties() {
  const properties = {
    // 從 src/main.js, src/category_management.js 取得的初始值 (請注意：實際部署時應替換 ID)
    [PROPERTY_KEYS.SPREADSHEET_ID]: '1CjNALBfP_n3LZ2hT5xE4XPbIe1q0P-UCgwgsY-aFEEU', 
    [PROPERTY_KEYS.SHEET_LOG_ENTRIES]: 'LogEntries', 
    [PROPERTY_KEYS.SHEET_CATEGORIES]: 'Categories', 
    [PROPERTY_KEYS.SHEET_CONFIG]: 'Config',
    [PROPERTY_KEYS.SHEET_EMAIL_SETTINGS]: 'Email',
    [PROPERTY_KEYS.SHEET_CATEGORY_CODE_MAP]: 'CategoryCodeMap',
    [PROPERTY_KEYS.SHEET_REPAIR_CATEGORY]: 'RepairCategory', // New
    [PROPERTY_KEYS.SHEET_NEEDS_CATEGORY]: 'NeedsCategory',   // New
    [PROPERTY_KEYS.REPORTS_FOLDER_ID]: '137ScpXsXsPFRArveytTsfzykW5H2bELA',
    [PROPERTY_KEYS.REPORT_TEMPLATE_ID]: '153ZHVrDmrA1j1i0ElHYSGeBNZwMpINr47LpQxmp-KJg',
    [PROPERTY_KEYS.GUI_CACHE_SS_ID]: 'GUI_CACHE_SS_ID_PLACEHOLDER', 
    [PROPERTY_KEYS.ANALYSIS_SHEET_ID]: 'ANALYSIS_SHEET_ID_PLACEHOLDER', 
    [PROPERTY_KEYS.COMPARISON_FOLDER_ID]: 'COMPARISON_FOLDER_ID_PLACEHOLDER', 
  };
  
  // Use ScriptProperties for deployment
  PropertiesService.getScriptProperties().setProperties(properties);
  Logger.log('Initial Script Properties set. **CRITICAL: Remember to replace ALL placeholder IDs and tokens**');
}
