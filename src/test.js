  /***********************
   *  測試函式集合
   ***********************/

  // ==================== 自動化工具 ====================

  /**
   * 自動顯示所有可用的測試函式
   * 透過反射機制自動偵測並分類所有全域函式
   */
  function 顯示所有測試函式() {
    Logger.log("========== 可用的測試函式（自動偵測）==========\n");
    
    // 取得所有全域函式
    const allFunctions = Object.keys(this)
      .filter(key => typeof this[key] === 'function')
      .filter(key => !key.startsWith('_') && 
                    key !== 'Function' && 
                    key !== 'eval' &&
                    key !== 'constructor' &&
                    !isInternalFunction(key))
      .sort();
    
    // 分類函式
    const categories = {
      '📅 日報系統': [],
      '🔧 分類管理': [],
      '📊 報修統計 - 部門': [],
      '📊 報修統計 - 主項目': [],
      '📊 需求統計 - 部門': [],
      '📊 需求統計 - 主項目': [],
      '📊 對比分析': [],
      '⚙️  系統管理': [],
      '🔍 設定與環境': [],
      '🛠️  其他工具': []
    };
    
    // 自動分類
    allFunctions.forEach(funcName => {
      const category = categorizeFunction(funcName);
      if (category && categories[category]) {
        categories[category].push(funcName);
      }
    });
    
    // 輸出分類結果
    let totalCount = 0;
    
    Object.keys(categories).forEach(category => {
      const funcs = categories[category];
      if (funcs.length > 0) {
        Logger.log(`${category}`);
        funcs.forEach(func => {
          Logger.log(`  • ${func}()`);
          totalCount++;
        });
        Logger.log("");
      }
    });
    
    Logger.log("===================================");
    Logger.log(`共偵測到 ${totalCount} 個可用函式`);
    Logger.log("===================================\n");
    
    Logger.log("💡 使用提示：");
    Logger.log("1. 在上方「函式」下拉選單選擇要執行的函式");
    Logger.log("2. 點擊「執行」按鈕（▶️）");
    Logger.log("3. 按 Ctrl+Enter 查看「執行記錄」");
  }

  /**
   * 判斷是否為內建函式
   */
  function isInternalFunction(funcName) {
    const internalFunctions = [
      'categorizeFunction',
      'isInternalFunction',
      'onOpen',
      'onEdit',
      'doGet',
      'doPost'
    ];
    return internalFunctions.includes(funcName);
  }

  /**
   * 根據函式名稱自動分類
   */
  function categorizeFunction(funcName) {
    // 日報系統
    if (funcName.includes('logbook') || funcName.includes('日報')) {
      return '📅 日報系統';
    }
    
    // 分類管理（包含「測試_」開頭的分類管理相關函式）
    if (funcName.startsWith('測試_') && 
        !funcName.includes('統計') && 
        !funcName.includes('對比')) {
      return '🔧 分類管理';
    }
    
    // 報修統計 - 主項目
    if (funcName.includes('報修') && (funcName.includes('主項目') || funcName.includes('項目別'))) {
      return '📊 報修統計 - 主項目';
    }
    
    // 報修統計 - 部門
    if (funcName.includes('報修') && 
        (funcName.includes('統計') || funcName.includes('月') || funcName.includes('季'))) {
      return '📊 報修統計 - 部門';
    }
    
    // 需求統計 - 主項目
    if (funcName.includes('需求') && (funcName.includes('主項目') || funcName.includes('項目別'))) {
      return '📊 需求統計 - 主項目';
    }
    
    // 需求統計 - 部門
    if (funcName.includes('需求') && 
        (funcName.includes('統計') || funcName.includes('月') || funcName.includes('季'))) {
      return '📊 需求統計 - 部門';
    }
    
    // 對比分析
    if (funcName.includes('對比') || funcName.includes('vs')) {
      return '📊 對比分析';
    }
    
    // 系統管理
    if (funcName === 'setupTriggers' || 
        funcName === 'listTriggers' || 
        funcName === 'clearTriggers' ||
        funcName === 'dailyJob') {
      return '⚙️  系統管理';
    }
    
    // 設定與環境
    if (funcName.includes('test') || 
        funcName.includes('check') || 
        funcName.includes('檢查') || 
        funcName.includes('環境')) {
      return '🔍 設定與環境';
    }
    
    // 其他工具
    if (funcName.includes('顯示') || 
        funcName.includes('完整') ||
        funcName.includes('Performance') ||
        funcName.includes('DataSize') ||
        funcName.includes('統計函式數量') ||
        funcName.includes('搜尋')) {
      return '🛠️  其他工具';
    }
    
    return null;
  }

  // ==================== 日報測試 ====================

  /**
   * 手動測試流程（不走排程）
   */
  function 重新寄送本日logbook() {
    try {
      Logger.log('開始更新並寄送今日日報...');
      
      // 產生日報
      generateReport();
      
      // 等待 5 秒
      Utilities.sleep(5000);
      
      // 寄送時加上「更新」標記
      sendReport('更新');
      
      Logger.log('✅ 日報已寄送');
      
    } catch (error) {
      Logger.log('❌ 錯誤：' + error.toString());
    }
  }

  // ==================== 報修統計測試 ====================

  /**
   * 測試：匯出本月報修統計
   */
  function 本月報修統計() {
    exportCurrentMonth();
  }

  /**
   * 測試：匯出上個月報修統計
   */
  function 上月報修統計() {
    exportLastMonth();
  }

  /**
   * 測試：匯出本季報修統計
   */
  function 本季報修統計() {
    exportCurrentQuarterRepair();
  }

  // ==================== 需求統計測試 ====================

  /**
   * 測試：匯出本月需求統計
   */
  function 本月需求統計() {
    exportCurrentMonthNeeds();
  }

  /**
   * 測試：匯出上個月需求統計
   */
  function 上月需求統計() {
    exportLastMonthNeeds();
  }

  /**
   * 測試：匯出本季需求統計
   */
  function 本季需求統計() {
    exportCurrentQuarterNeeds();
  }

  // ==================== 分類管理測試 ====================

  /**
   * 測試：讀取代碼對照表
   */
  function 測試_讀取代碼對照表() {
    const map = getCategoryCodeMap();
    
    Logger.log("========== 主項目代碼對照表 ==========");
    
    if (Object.keys(map).length === 0) {
      Logger.log("❌ 沒有讀取到任何資料！");
      Logger.log("請檢查：");
      Logger.log("1. PropertiesService 中的 MAIN_CONFIG_SPREADSHEET_ID 是否正確");
      Logger.log("2. CategoryCodeMap 工作表是否存在");
      Logger.log("3. 資料格式是否正確");
      return;
    }
    
    Object.keys(map).sort().forEach(category => {
      Logger.log(`${map[category]} → ${category}`);
    });
    
    Logger.log("=====================================");
    Logger.log(`✅ 共讀取 ${Object.keys(map).length} 個主項目`);
  }

  /**
   * 測試：讀取報修分類
   */
  function 測試_讀取報修分類() {
    const categories = readRepairCategory();
    
    Logger.log("========== 報修分類 ==========");
    Logger.log(`共 ${categories.length} 個啟用的分類`);
    
    categories.slice(0, 10).forEach(cat => {
      Logger.log(`${cat.id}: ${cat.mainCategory} - ${cat.subCategory}`);
    });
    
    if (categories.length > 10) {
      Logger.log(`...還有 ${categories.length - 10} 個分類`);
    }
    
    Logger.log("============================");
  }

  /**
   * 測試：讀取需求分類
   */
  function 測試_讀取需求分類() {
    const categories = readNeedsCategory();
    
    Logger.log("========== 需求分類 ==========");
    Logger.log(`共 ${categories.length} 個啟用的分類`);
    
    categories.forEach(cat => {
      Logger.log(`${cat.id}: ${cat.mainCategory} - ${cat.subCategory}`);
    });
    
    Logger.log("============================");
  }

  /**
   * 測試：批次生成報修分類 ID
   */
  function 測試_批次生成報修ID() {
    const result = batchGenerateIds();
    
    if (result.success) {
      Logger.log("\n========== 執行結果 ==========");
      Logger.log(`✅ 批次生成成功`);
      Logger.log(`已生成：${result.generated} 個`);
      Logger.log(`已跳過：${result.skipped} 個`);
      
      if (result.errors && result.errors.length > 0) {
        Logger.log(`\n⚠️ 錯誤：`);
        result.errors.forEach(err => Logger.log(`   ${err}`));
      }
      Logger.log("============================");
    } else {
      Logger.log(`❌ 批次生成失敗：${result.message}`);
    }
  }

  /**
   * 測試：批次生成需求分類 ID
   */
  function 測試_批次生成需求ID() {
    const result = batchGenerateNeedsIds();
    
    if (result.success) {
      Logger.log("\n========== 執行結果 ==========");
      Logger.log(`✅ 批次生成成功`);
      Logger.log(`已生成：${result.generated} 個`);
      Logger.log(`已跳過：${result.skipped} 個`);
      
      if (result.errors && result.errors.length > 0) {
        Logger.log(`\n⚠️ 錯誤：`);
        result.errors.forEach(err => Logger.log(`   ${err}`));
      }
      Logger.log("============================");
    } else {
      Logger.log(`❌ 批次生成失敗：${result.message}`);
    }
  }

  /**
   * 測試：智能修正報修分類 ID
   */
  function 測試_智能修正報修ID() {
    const result = smartFixIds();
    
    if (result.success) {
      Logger.log(`\n✅ 智能修正成功，已修正 ${result.count} 個 ID`);
    } else {
      Logger.log(`❌ 智能修正失敗：${result.message}`);
    }
  }

  /**
   * 測試：智能修正需求分類 ID
   */
  function 測試_智能修正需求ID() {
    const result = smartFixNeedsIds();
    
    if (result.success) {
      Logger.log(`\n✅ 智能修正成功，已修正 ${result.count} 個 ID`);
    } else {
      Logger.log(`❌ 智能修正失敗：${result.message}`);
    }
  }

  /**
   * 測試：檢查報修分類資料完整性
   */
  function 測試_檢查報修資料完整性() {
    const result = validateRepairCategory();
    
    if (result.success) {
      Logger.log("\n✅ 檢查通過：所有資料都符合規範");
    } else if (result.issues) {
      Logger.log(`\n⚠️ 發現 ${result.issues.length} 個問題`);
    } else {
      Logger.log(`❌ 檢查失敗：${result.message}`);
    }
  }

  /**
   * 測試：檢查需求分類資料完整性
   */
  function 測試_檢查需求資料完整性() {
    const result = validateNeedsCategory();
    
    if (result.success) {
      Logger.log("\n✅ 檢查通過：所有資料都符合規範");
    } else if (result.issues) {
      Logger.log(`\n⚠️ 發現 ${result.issues.length} 個問題`);
    } else {
      Logger.log(`❌ 檢查失敗：${result.message}`);
    }
  }

  /**
   * 測試：檢查報修分類重複 ID
   */
  function 測試_檢查報修分類重複ID() {
    const result = checkDuplicateIds();
    
    if (result.success) {
      Logger.log("\n✅ 沒有發現重複的 ID");
    } else if (result.duplicates) {
      Logger.log(`\n⚠️ 發現 ${result.duplicates.length} 個重複 ID`);
    } else {
      Logger.log(`❌ 檢查失敗：${result.message}`);
    }
  }

  /**
   * 測試：檢查需求分類重複 ID
   */
  function 測試_檢查需求分類重複ID() {
    const result = checkDuplicateNeedsIds();
    
    if (result.success) {
      Logger.log("\n✅ 沒有發現重複的 ID");
    } else if (result.duplicates) {
      Logger.log(`\n⚠️ 發現 ${result.duplicates.length} 個重複 ID`);
    } else {
      Logger.log(`❌ 檢查失敗：${result.message}`);
    }
  }

  /**
   * 測試：刷新代碼快取
   */
  function 測試_刷新代碼快取() {
    const map = refreshCategoryCodeCache();
    Logger.log(`\n✅ 快取已刷新，共 ${Object.keys(map).length} 個主項目`);
  }

  /**
   * 完整測試流程：從頭到尾測試分類管理系統
   */
  function 完整測試分類管理系統() {
    Logger.log("==========================================");
    Logger.log("開始完整測試分類管理系統");
    Logger.log("==========================================\n");
    
    Logger.log("【步驟 1】測試讀取代碼對照表");
    測試_讀取代碼對照表();
    Logger.log("");
    
    Logger.log("【步驟 2】刷新代碼快取");
    測試_刷新代碼快取();
    Logger.log("");
    
    Logger.log("【步驟 3】批次生成報修分類 ID");
    測試_批次生成報修ID();
    Logger.log("");
    
    Logger.log("【步驟 4】批次生成需求分類 ID");
    測試_批次生成需求ID();
    Logger.log("");
    
    Logger.log("【步驟 5】檢查報修分類資料完整性");
    測試_檢查報修資料完整性();
    Logger.log("");
    
    Logger.log("【步驟 6】檢查需求分類資料完整性");
    測試_檢查需求資料完整性();
    Logger.log("");
    
    Logger.log("【步驟 7】檢查報修分類重複 ID");
    測試_檢查報修分類重複ID();
    Logger.log("");
    
    Logger.log("【步驟 8】檢查需求分類重複 ID");
    測試_檢查需求分類重複ID();
    Logger.log("");
    
    Logger.log("【步驟 9】讀取報修分類");
    測試_讀取報修分類();
    Logger.log("");
    
    Logger.log("【步驟 10】讀取需求分類");
    測試_讀取需求分類();
    Logger.log("");
    
    Logger.log("==========================================");
    Logger.log("完整測試完成");
    Logger.log("==========================================");
  }

  // ==================== 報修主項目統計 ====================

  /**
   * 測試：本月報修主項目統計
   */
  function 本月_報修統計_依項目別() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}/${String(month).padStart(2, '0')}/01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}/${String(month).padStart(2, '0')}/${lastDay}`;
    
    exportRepairMainCategoryStats(startDate, endDate);
  }

  /**
   * 測試：上月報修主項目統計
   */
  function 上月_報修統計_依項目別() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = lastMonth.getMonth() + 1;
    const startDate = `${year}/${String(month).padStart(2, '0')}/01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}/${String(month).padStart(2, '0')}/${lastDay}`;
    
    exportRepairMainCategoryStats(startDate, endDate);
  }

  /**
   * 測試：本季報修主項目統計
   */
  function 本季_報修統計_依項目別() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    
    const startDate = `${year}/${String(startMonth).padStart(2, '0')}/01`;
    const lastDay = new Date(year, endMonth, 0).getDate();
    const endDate = `${year}/${String(endMonth).padStart(2, '0')}/${lastDay}`;
    
    exportRepairMainCategoryStats(startDate, endDate);
  }

  // ==================== 需求主項目統計 ====================

  /**
   * 測試：本月需求主項目統計
   */
  function 本月_需求統計_依項目別() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}/${String(month).padStart(2, '0')}/01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}/${String(month).padStart(2, '0')}/${lastDay}`;
    
    exportNeedsMainCategoryStats(startDate, endDate);
  }

  /**
   * 測試：上月需求主項目統計
   */
  function 上月_需求統計_依項目別() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = lastMonth.getMonth() + 1;
    const startDate = `${year}/${String(month).padStart(2, '0')}/01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}/${String(month).padStart(2, '0')}/${lastDay}`;
    
    exportNeedsMainCategoryStats(startDate, endDate);
  }

  /**
   * 測試：本季需求主項目統計
   */
  function 本季_需求統計_依項目別() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    
    const startDate = `${year}/${String(startMonth).padStart(2, '0')}/01`;
    const lastDay = new Date(year, endMonth, 0).getDate();
    const endDate = `${year}/${String(endMonth).padStart(2, '0')}/${lastDay}`;
    
    exportNeedsMainCategoryStats(startDate, endDate);
  }

  // ==================== 報修 vs 需求對比 ====================

  /**
   * 測試：本月報修vs需求對比
   */
  function 本月報修vs需求對比() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}/${String(month).padStart(2, '0')}/01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}/${String(month).padStart(2, '0')}/${lastDay}`;
    
    exportComparisonStats(startDate, endDate);
  }

  /**
   * 測試：上月報修vs需求對比
   */
  function 上月報修vs需求對比() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = lastMonth.getMonth() + 1;
    const startDate = `${year}/${String(month).padStart(2, '0')}/01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}/${String(month).padStart(2, '0')}/${lastDay}`;
    
    exportComparisonStats(startDate, endDate);
  }

  /**
   * 測試：本季報修vs需求對比
   */
  function 本季報修vs需求對比() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    
    const startDate = `${year}/${String(startMonth).padStart(2, '0')}/01`;
    const lastDay = new Date(year, endMonth, 0).getDate();
    const endDate = `${year}/${String(endMonth).padStart(2, '0')}/${lastDay}`;
    
    exportComparisonStats(startDate, endDate);
  }

  // ==================== 設定檔測試 ====================

  /**
   * 測試：設定讀取功能
   */
  function testReadConfig() {
    const sources = readConfig();
    
    if (sources.length === 0) {
      Logger.log("⚠️ 目前沒有啟用的來源");
      return;
    }
    
    Logger.log(`✅ 找到 ${sources.length} 個啟用的資料來源：\n`);
    
    sources.forEach((src, idx) => {
      Logger.log(`────── 來源 ${idx + 1} ──────`);
      Logger.log(`名稱：${src.name}`);
      Logger.log(`檔案 ID：${src.id}`);
      Logger.log(`工作表：${src.sheet}`);
      Logger.log(`輸出欄位：${src.outputColumns ? JSON.stringify(src.outputColumns) : "全部"}`);
      Logger.log(`類型：${src.type || "一般"}\n`);
    });
  }

  /**
   * 測試：郵件設定讀取
   */
  function testMailSettings() {
    const settings = readMailSettings();
    
    Logger.log("========== 郵件設定 ==========");
    Logger.log(`寄件者名稱：${settings.senderName}`);
    Logger.log(`收件者 (TO)：${settings.to}`);
    Logger.log(`副本 (CC)：${settings.cc || "(無)"}`);
    Logger.log(`密件副本 (BCC)：${settings.bcc || "(無)"}`);
    Logger.log("============================");
  }

  /**
   * 測試：initializeProject 資料夾初始化
   */
  function testInitializeProject() {
    const result = initializeProject("YOUR_CONFIG_SS_ID", {
      rootFolderId: "YOUR_ROOT_FOLDER_ID"
    });
    Logger.log(JSON.stringify(result));
  }

  /**
   * 測試：檢查環境設定
   */
  function 檢查環境設定() {
    const CONFIG = getConfig();
    const ssId = CONFIG.get(PROPERTY_KEYS.SPREADSHEET_ID);
    
    Logger.log("========== 環境設定檢查 ==========\n");
    
    Logger.log("【MAIN_CONFIG_SPREADSHEET_ID】");
    try {
      const ss = SpreadsheetApp.openById(ssId);
      Logger.log(`✅ 可存取：${ss.getName()}`);
    } catch (e) {
      Logger.log(`❌ 無法存取：${e.message}`);
    }
    Logger.log("");
    
    Logger.log("【必要工作表】");
    const requiredSheets = [
      CONFIG.get(PROPERTY_KEYS.SHEET_CONFIG), 
      CONFIG.get(PROPERTY_KEYS.SHEET_EMAIL_SETTINGS), 
      CONFIG.get(PROPERTY_KEYS.SHEET_CATEGORY_CODE_MAP), 
      "RepairCategory", 
      "NeedsCategory"
    ];
    
    try {
      const ss = SpreadsheetApp.openById(ssId);
      requiredSheets.forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          Logger.log(`✅ ${sheetName}：存在（${sheet.getLastRow()} 列）`);
        } else {
          Logger.log(`❌ ${sheetName}：不存在`);
        }
      });
    } catch (e) {
      Logger.log(`❌ 檢查失敗：${e.message}`);
    }
    Logger.log("");
    
    Logger.log("【代碼快取狀態 (CATEGORY_CODE_MAP)】");
    const cached = PropertiesService.getScriptProperties().getProperty("CATEGORY_CODE_MAP");
    if (cached) {
      const map = JSON.parse(cached);
      Logger.log(`✅ 快取存在（${Object.keys(map).length} 個主項目）`);
    } else {
      Logger.log(`⚠️ 快取不存在，建議執行「測試_刷新代碼快取()」`);
    }
    Logger.log("");
    
    Logger.log("=================================");
  }

  /**
   * 測試：效能測試
   */
  function testPerformance() {
    const start = new Date();
    
    // 測試需求統計（通常資料較多）
    exportMonthNeedsStats(2025, 9);
    
    const end = new Date();
    const duration = (end - start) / 1000;
    
    Logger.log("==================");
    Logger.log(`總執行時間：${duration} 秒`);
    Logger.log("==================");
  }

  /**
   * 測試：檢查資料大小
   */
  function checkDataSize() {
    const sources = readConfig();
    
    Logger.log("========== 資料來源大小 ==========");
    
    sources.forEach(src => {
      try {
        const ss = SpreadsheetApp.openById(src.id);
        const sheet = ss.getSheetByName(src.sheet);
        
        Logger.log(`${src.name}:`);
        Logger.log(`  總列數：${sheet.getLastRow()}`);
        Logger.log(`  總欄數：${sheet.getLastColumn()}`);
      } catch (e) {
        Logger.log(`${src.name}: ❌ 讀取失敗 - ${e.message}`);
      }
    });
    
    Logger.log("=================================");
  }

  /**
   * 統計各分類的函式數量
   */
  function 統計函式數量() {
    const allFunctions = Object.keys(this)
      .filter(key => typeof this[key] === 'function')
      .filter(key => !isInternalFunction(key));
    
    const categoryCount = {};
    
    allFunctions.forEach(funcName => {
      const category = categorizeFunction(funcName) || '未分類';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    Logger.log("========== 函式數量統計 ==========\n");
    
    Object.keys(categoryCount)
      .sort((a, b) => categoryCount[b] - categoryCount[a])
      .forEach(category => {
        const count = categoryCount[category];
        const bar = '█'.repeat(Math.min(count, 20));
        Logger.log(`${category.padEnd(25)} ${bar} ${count}`);
      });
    
    Logger.log("\n=================================");
    Logger.log(`總計：${allFunctions.length} 個函式`);
    Logger.log("=================================");
  }

  /**
   * 搜尋包含關鍵字的函式
   */
  function 搜尋函式(keyword) {
    if (!keyword) {
      Logger.log("請提供搜尋關鍵字");
      Logger.log("範例：搜尋函式('報修')");
      return;
    }
    
    const allFunctions = Object.keys(this)
      .filter(key => typeof this[key] === 'function')
      .filter(key => !isInternalFunction(key))
      .filter(key => key.includes(keyword))
      .sort();
    
    Logger.log(`========== 搜尋結果：「${keyword}」 ==========\n`);
    
    if (allFunctions.length === 0) {
      Logger.log("❌ 沒有找到符合的函式");
      Logger.log("\n💡 提示：");
      Logger.log("  • 試試其他關鍵字");
      Logger.log("  • 執行「顯示所有測試函式()」查看完整列表");
    } else {
      Logger.log(`✅ 找到 ${allFunctions.length} 個函式：\n`);
      allFunctions.forEach(func => {
        const category = categorizeFunction(func);
        Logger.log(`  • ${func}()`);
        Logger.log(`    分類：${category || '未分類'}`);
      });
    }
    
    Logger.log("\n===================================");
  }
