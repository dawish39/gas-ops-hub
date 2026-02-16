/**
 * @fileoverview System namespace for system-level functions.
 */

// eslint-disable-next-line no-unused-vars
const System = {
  /**
   * Scans the Config spreadsheet and returns a list of all non-system sheet names.
   * System sheets are defined as any sheet whose name begins with an underscore '_'.
   *
   * @returns {string[]} An array of sheet names.
   */
  getConfigSheets() {
    try {
      const configProvider = getConfigProvider(); // Assuming a global accessor
      const ssId = configProvider.ssId;
      if (!ssId) {
        throw new Error("Spreadsheet ID is not configured.");
      }
      const ss = SpreadsheetApp.openById(ssId);
      const allSheets = ss.getSheets();
      const configSheets = allSheets
        .map(sheet => sheet.getName())
        .filter(name => !name.startsWith('_') && name !== '工作表1' && name !== 'Sheet1');
      
      Logger.log(`Found config sheets: ${configSheets.join(', ')}`);
      return configSheets;
    } catch (e) {
      Logger.log(`Error in System.getConfigSheets: ${e.message}`);
      // In case of error, return an empty array to prevent frontend crashes.
      return [];
    }
  },

  /**
   * Updates the source sheets configuration and immediately triggers the regeneration
   * of the IMPORTRANGE formula in the Data spreadsheet.
   *
   * @param {string[]} selectedSheets - An array of sheet names selected by the user.
   * @returns {{success: boolean, message: string}} Result object.
   */
  updateSourceSheetsAndApply(selectedSheets) {
    try {
      // 1. Save the setting
      const configProvider = getConfigProvider();
      configProvider.setAppSettings('sourceSheets', selectedSheets);
      Logger.log(`Successfully saved source sheets setting: ${selectedSheets.join(', ')}`);

      // 2. Trigger the installer's formula update logic
      // This function will be created in installer.js
      updateImportRangeFormula(); 
      Logger.log(`Successfully triggered IMPORTRANGE formula update.`);

      return { success: true, message: '設定已儲存並成功更新至 Data 試算表。' };
    } catch (e) {
      Logger.log(`Error in updateSourceSheetsAndApply: ${e.stack}`);
      return { success: false, message: `更新失敗: ${e.message}` };
    }
  }
};