/**
 * @fileoverview Data Access Object (DAO) Module.
 * Provides an abstraction layer for interacting with Google Spreadsheet data,
 * enforcing separation of concerns and facilitating batch operations for performance.
 */

// Global constant to access the singleton ConfigManager
// const CONFIG = getConfig(); 
// const PROPERTY_KEYS = PROPERTY_KEYS; 

/**
 * Base DAO class containing common methods for Spreadsheet access.
 * Enforces the principle of opening the Spreadsheet only once per transaction/request.
 */
class BaseDAO {
  /**
   * @param {string} sheetNameKey - The key from PROPERTY_KEYS that holds the target sheet name (e.g., 'SHEET_LOG_ENTRIES').
   * @param {string} [ssIdKey='MAIN_CONFIG_SPREADSHEET_ID'] - The key from PROPERTY_KEYS that holds the Spreadsheet ID.
   */
  constructor(sheetNameKey, ssIdKey = PROPERTY_KEYS.SPREADSHEET_ID) {
    this.ssId = getConfig().get(ssIdKey);
    this.sheetName = getConfig().get(sheetNameKey);

    if (!this.ssId && sheetNameKey) { // Only log error if SS ID is missing, or if a non-null sheet name is expected
        Logger.log(`CRITICAL ERROR: Missing Spreadsheet ID for DAO. Sheet Name Key: ${sheetNameKey}`);
    }
  }

  /**
   * Opens and returns the target sheet.
   * Throws an error if the sheet cannot be found.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   * @throws {Error} If Spreadsheet or Sheet is not found.
   */
  getSheet() {
    if (!this.ssId) {
        throw new Error(`Spreadsheet ID is not configured for ${this.sheetName}.`);
    }
    const ss = SpreadsheetApp.openById(this.ssId);
    const sheet = ss.getSheetByName(this.sheetName);
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${this.sheetName} (ID: ${this.ssId})`);
    }
    return sheet;
  }

  /**
   * Reads all data from the sheet (excluding headers) using batch operation.
   * @returns {Array<Array<any>>} All data rows.
   */
  getAllDataRows() {
    const sheet = this.getSheet();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 2) return [];

    // Batch read: performance gain
    const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
    return range.getValues();
  }

  /**
   * Reads all data from the sheet including the header row.
   * @returns {Array<Array<any>>} All data rows including header.
   */
  getAllDataWithHeaders() {
    const sheet = this.getSheet();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 1) return [];
    
    // Batch read: performance gain
    const range = sheet.getRange(1, 1, lastRow, lastCol);
    return range.getValues();
  }
}

/**
 * DAO specifically for reading the Main Configuration Spreadsheet sheets (Config and Email Settings).
 */
class ConfigDAO extends BaseDAO {
    constructor() {
        // ConfigDAO deals with multiple sheets within the main config SS, 
        // so we only pass the SS ID key and handle sheet names internally.
        super(null, PROPERTY_KEYS.SPREADSHEET_ID); 
        this.configSheetName = getConfig().get(PROPERTY_KEYS.SHEET_CONFIG);
        this.emailSheetName = getConfig().get(PROPERTY_KEYS.SHEET_EMAIL_SETTINGS);
    }
    
    /**
     * Reads the source list from the Config sheet.
     * @returns {Array<Object>} List of enabled data sources.
     */
    readSourceList() {
      const ss = SpreadsheetApp.openById(this.ssId);
      const sheet = ss.getSheetByName(this.configSheetName);

      if (!sheet || sheet.getLastRow() < 2) return [];
      
      // Assumes columns A-F (6 columns) are Name, ID, Sheet, Enabled, OutputCols, Type
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();

      // Note: parseOutputColumns is a utility function defined globally in main.js
      const parser = (typeof this.parseOutputColumns === 'function') ? this.parseOutputColumns : (typeof parseOutputColumns === 'function' ? parseOutputColumns : null);

      return data
        .filter(row => row[3] && row[3].toString().toUpperCase() === "Y")
        .map(row => ({
          name: row[0],                           // A: 來源名稱
          id: row[1],                             // B: 檔案 ID
          sheet: row[2],                          // C: 工作表名稱
          outputColumns: parser ? parser(row[4]) : row[4], // E: 輸出欄位
          type: row[5]                            // F: type
        }));
    }

    /**
     * Reads the mail settings from the Email sheet.
     * @returns {Object} Mail settings { to, cc, senderName }.
     */
    readMailSettings() {
        const ss = SpreadsheetApp.openById(this.ssId);
        const sheet = ss.getSheetByName(this.emailSheetName);
        
        if (!sheet) {
            Logger.log("⚠️ 找不到 Email Settings 工作表");
            return null;
        }

        // 讀取第 2 列（第 1 列是標題）
        // Assumes columns A-C (Recipient, CC, SenderName)
        if (sheet.getLastRow() < 2) return null;
        const data = sheet.getRange(2, 1, 1, 3).getValues()[0];
        
        const recipient = String(data[0] || "").trim();
        const cc = String(data[1] || "").trim();
        const senderName = String(data[2] || "").trim();

        // Note: parseEmails is a utility function defined globally in main.js
        const parser = (typeof this.parseEmails === 'function') ? this.parseEmails : (typeof parseEmails === 'function' ? parseEmails : null);

        return {
            to: recipient,
            cc: parser ? parser(cc) : cc,
            senderName: senderName
        };
    }
}


/**
 * DAO specifically for Log Entries (Daily/Repair/Needs logs).
 * This DAO should be used for reading and writing new work log entries.
 */
class LogEntryDAO extends BaseDAO {
  /**
   * @param {string} id - Spreadsheet ID (from readConfig result)
   * @param {string} sheetName - Sheet Name (from readConfig result)
   */
  constructor(id, sheetName) {
    // Overriding BaseDAO properties manually as SS ID/Name are dynamic per log source
    super(null, null); 
    this.ssId = id;
    this.sheetName = sheetName;
  }
  
  // NOTE: Full CRUD operations for Log Entries will be implemented during refactoring (Step 11).
  
  /**
   * Appends a single row to the log sheet.
   * WARNING: For heavy write tasks, batch operations are preferred over appendRow.
   * This is kept for compatibility with simpler write flows (e.g., Line Bot).
   * @param {Array<any>} rowData - The data row to append.
   * @returns {number} The row number where the data was inserted.
   */
  appendRow(rowData) {
      const sheet = this.getSheet();
      return sheet.appendRow(rowData).getLastRow();
  }

  // Placeholder for findByUUID/updateByUUID methods to be added later.
}

/**
 * DAO specifically for Category Data (CategoryCodeMap, RepairCategory, NeedsCategory).
 */
class CategoryDAO extends BaseDAO {
  /**
   * @param {string} sheetNameKey - Key for the specific category sheet (e.g., SHEET_CATEGORY_CODE_MAP)
   */
  constructor(sheetNameKey) {
    super(sheetNameKey, PROPERTY_KEYS.SPREADSHEET_ID); // Use the main config SS ID
  }
  
  /**
   * Reads and returns the category code map (Category -> Code).
   * @returns {Object} { categoryName: code }
   */
  getCategoryCodeMap() {
    const data = this.getAllDataRows();
    const codeMap = {};
    
    // Assumes Col 0 = ID (Code), Col 1 = Category (Main Category), Col 2 = Enabled (Y/N)
    for (const row of data) {
      const code = String(row[0] || "").trim();
      const category = String(row[1] || "").trim();
      const enabled = String(row[2] || "").trim();
      
      if (enabled.toUpperCase() === "Y" && code && category) {
        codeMap[category] = code;
      }
    }
    return codeMap;
  }

  /**
   * Reads category definition rows from the sheet (e.g., RepairCategory, NeedsCategory).
   * @returns {Array<Array<any>>} Raw category data rows (excluding header).
   */
  readDefinition() {
    return this.getAllDataRows();
  }
  
  /**
   * Updates a single cell in the ID column for a specific row.
   * @param {number} rowNum - The absolute row number (1-based, including header).
   * @param {string} newId - The new ID value.
   */
  updateId(rowNum, newId) {
    const sheet = this.getSheet();
    // Assuming ID is in Column 1 (index 1)
    sheet.getRange(rowNum, 1).setValue(newId);
  }
  
  /**
   * Reads raw data columns needed for validation/ID generation.
   * Assumes columns A-C (ID, SubCategory, MainCategory) are needed.
   * @returns {Array<Array<any>>} Raw column data (excluding header).
   */
  getRawIdGenerationData() {
    const sheet = this.getSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow < 2) return [];

    // Read Col 1 to 3 (ID, SubCategory, MainCategory)
    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); 
    return data;
  }
  
  /**
   * Reads the entire data range for validation (Col 1 to 6).
   * @returns {Array<Array<any>>} Raw data (excluding header).
   */
  getFullValidationData() {
    const sheet = this.getSheet();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow < 2) return [];
    
    // Read Col 1 to 6 (ID, SubCategory, MainCategory, Enabled, EffectiveDate, Note)
    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    return data;
  }
}

// ==========================================
// 💡 公用實例 (Singletons)
// ==========================================

const DAO_MAP = {};

// eslint-disable-next-line no-unused-vars
function getMainConfigDAO() {
    if (!DAO_MAP.MainConfigDAO) {
        DAO_MAP.MainConfigDAO = new ConfigDAO();
    }
    return DAO_MAP.MainConfigDAO;
}

/**
 * Provides access to a specific source sheet (e.g., repair logs, daily work logs).
 * This is used for reading config and then iterating over sources.
 * @param {Object} src - A source object returned by readConfig().
 */
// eslint-disable-next-line no-unused-vars
function getLogEntryDAO(src) {
    if (!src.id || !src.sheet) {
        throw new Error("Invalid source object provided to getLogEntryDAO.");
    }

    // Cache key based on source ID and sheet name
    const cacheKey = `LogDAO_${src.id}_${src.sheet}`;
    if (!DAO_MAP[cacheKey]) {
        DAO_MAP[cacheKey] = new LogEntryDAO(src.id, src.sheet);
    }
    return DAO_MAP[cacheKey];
}

/**
 * Provides access to the Logbook system's Category Spreadsheet.
 * Use this to fetch DAO instances for known category sheets.
 * @param {string} sheetNameKey - Key for the specific category sheet (e.g., SHEET_CATEGORY_CODE_MAP)
 */
// eslint-disable-next-line no-unused-vars
function getCategoryDao(sheetNameKey) {
    const cacheKey = `CategoryDAO_${sheetNameKey}`;
    if (!DAO_MAP[cacheKey]) {
        DAO_MAP[cacheKey] = new CategoryDAO(sheetNameKey);
    }
    return DAO_MAP[cacheKey];
}
