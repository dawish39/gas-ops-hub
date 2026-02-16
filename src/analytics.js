/***********************
 *  資料分析模組
 ***********************/

// ==================== 統計查詢函式 ====================

/**
 * 通用月份統計匯出
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @param {string} type - "repair" 或 "needs"
 */
function exportMonthStatsGeneric(year, month, type) {
  const startDate = `${year}/${String(month).padStart(2, '0')}/01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}/${String(month).padStart(2, '0')}/${lastDay}`;
  
  if (type === "repair") {
    exportDepartmentStats(startDate, endDate);
  } else if (type === "needs") {
    exportNeedsStats(startDate, endDate);
  }
}

function exportMonthStats(year, month) {
  exportMonthStatsGeneric(year, month, "repair");
}

function exportMonthNeedsStats(year, month) {
  exportMonthStatsGeneric(year, month, "needs");
}

function exportDepartmentStats(startDate, endDate) {
  exportStatsGeneric(startDate, endDate, "repair", "部門報修統計");
}

function exportNeedsStats(startDate, endDate) {
  exportStatsGeneric(startDate, endDate, "needs", "部門需求統計");
}

// 簡化的快捷函式
function exportCurrentMonth() {
  const now = new Date();
  exportMonthStatsGeneric(now.getFullYear(), now.getMonth() + 1, "repair");
}

function exportLastMonth() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  exportMonthStatsGeneric(lastMonth.getFullYear(), lastMonth.getMonth() + 1, "repair");
}

function exportCurrentMonthNeeds() {
  const now = new Date();
  exportMonthStatsGeneric(now.getFullYear(), now.getMonth() + 1, "needs");
}

function exportLastMonthNeeds() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  exportMonthStatsGeneric(lastMonth.getFullYear(), lastMonth.getMonth() + 1, "needs");
}

function exportCurrentQuarterRepair() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  
  const startDate = `${year}/${String(startMonth).padStart(2, '0')}/01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const endDate = `${year}/${String(endMonth).padStart(2, '0')}/${lastDay}`;
  
  exportDepartmentStats(startDate, endDate);
}

function exportCurrentQuarterNeeds() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  
  const startDate = `${year}/${String(startMonth).padStart(2, '0')}/01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const endDate = `${year}/${String(endMonth).padStart(2, '0')}/${lastDay}`;
  
  exportNeedsStats(startDate, endDate);
}

function exportStatsGeneric(startDate, endDate, sourceType, reportTitle) {
  try {
    const sources = readConfig();
    const targetSrc = sources.find(s => {
      const type = String(s.type || "").toLowerCase();
      return type === sourceType;
    });
    
    if (!targetSrc) {
      Logger.log(`❌ 找不到 type="${sourceType}" 的來源`);
      return;
    }
    
    const logDao = getLogEntryDAO(targetSrc);
    const sheet = logDao.getSheet();
    
    // 效能優化：只讀取有資料的範圍
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow < 2) {
      Logger.log("❌ 工作表無資料");
      return;
    }
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
      .filter(row => !isEmptyRow(row));
    
    const deptIdx = findColumnIndex(headers, ["部門"]);
    const dateIdx = findColumnIndex(headers, ["新增日期"]);
    const statusIdx = findColumnIndex(headers, ["狀態"]);
    
    if (deptIdx === -1 || dateIdx === -1) {
      Logger.log("❌ 找不到必要欄位（部門或新增日期）");
      return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const filtered = rows.filter(row => {
      const dateVal = row[dateIdx];
      if (!dateVal) return false;
      const date = new Date(dateVal);
      return date >= start && date <= end;
    });
    
    Logger.log(`✅ 篩選日期範圍：${startDate} ~ ${endDate}，找到 ${filtered.length} 筆資料`);
    
    const stats = {};
    filtered.forEach(row => {
      const dept = String(row[deptIdx] || "未分類").trim();
      
      if (!stats[dept]) {
        stats[dept] = { 
          total: 0, 
          completed: 0, 
          inProgress: 0,
          notStarted: 0
        };
      }
      
      stats[dept].total++;
      
      if (statusIdx !== -1) {
        const status = String(row[statusIdx] || "").trim();
        
        if (status.includes("完成") && !status.includes("待確認")) {
          stats[dept].completed++;
        } else if (status.includes("處理中") || status.includes("待確認")) {
          stats[dept].inProgress++;
        } else {
          stats[dept].notStarted++;
        }
      }
    });
    
    outputStatsToSheet(stats, startDate, endDate, reportTitle, sourceType);
    
  } catch (e) {
    Logger.log("❌ 統計失敗：" + e.message);
  }
}

function outputStatsToSheet(stats, startDate, endDate, reportTitle, sourceType) {
  const CONFIG = getConfig();
  const ANALYSIS_SHEET_ID = CONFIG.get(PROPERTY_KEYS.ANALYSIS_SHEET_ID);

  if (!ANALYSIS_SHEET_ID || ANALYSIS_SHEET_ID.includes("PLACEHOLDER")) {
    createNewStatsSheet(stats, startDate, endDate, reportTitle, sourceType);
  } else {
    writeToAnalysisSheet(stats, startDate, endDate, reportTitle, sourceType);
  }
}

function createNewStatsSheet(stats, startDate, endDate, reportTitle, sourceType) {
  const CONFIG = getConfig();
  const REPAIR_FOLDER_ID = CONFIG.get(PROPERTY_KEYS.REPORTS_FOLDER_ID); // 使用 REPORTS_FOLDER_ID 作為報修的預設資料夾
  const NEEDS_FOLDER_ID = CONFIG.get(PROPERTY_KEYS.NEEDS_FOLDER_ID);
  
  const typePrefix = sourceType === "needs" ? "需求" : "報修";
  const fileName = `${typePrefix}統計_${startDate.replace(/\//g, '')}_${endDate.replace(/\//g, '')}`;
  const ss = SpreadsheetApp.create(fileName);
  const sheet = ss.getActiveSheet();
  sheet.setName(`部門${typePrefix}統計`);
  
  writeStatsContent(sheet, stats, startDate, endDate, reportTitle, sourceType);
  
  const folderId = sourceType === "needs" ? NEEDS_FOLDER_ID : REPAIR_FOLDER_ID;
  
  if (folderId) {
    try {
      const file = DriveApp.getFileById(ss.getId());
      const folder = DriveApp.getFolderById(folderId);
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
      Logger.log("✅ 統計表已建立並移至指定資料夾：" + ss.getUrl());
    } catch (e) {
      Logger.log("⚠️ 移動檔案失敗，但統計表已建立：" + ss.getUrl());
      Logger.log("   錯誤原因：" + e.message);
    }
  } else {
    Logger.log("✅ 統計表已建立：" + ss.getUrl());
    Logger.log("⚠️ 未設定資料夾 ID，檔案保留在根目錄");
  }
}

function writeToAnalysisSheet(stats, startDate, endDate, reportTitle, sourceType) {
  const CONFIG = getConfig();
  const ANALYSIS_SHEET_ID = CONFIG.get(PROPERTY_KEYS.ANALYSIS_SHEET_ID);

  const ss = SpreadsheetApp.openById(ANALYSIS_SHEET_ID);
  const typePrefix = sourceType === "needs" ? "需求" : "報修";
  const sheetName = `${typePrefix}_${startDate.substring(0, 7)}`;
  
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }
  
  writeStatsContent(sheet, stats, startDate, endDate, reportTitle, sourceType);
  Logger.log("✅ 統計已寫入：" + ss.getUrl() + " / " + sheetName);
}

function writeStatsContent(sheet, stats, startDate, endDate, reportTitle, sourceType) {
  sheet.appendRow([reportTitle + ` (${startDate} ~ ${endDate})`]);
  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  
  sheet.appendRow(["部門", "總計", "已完成", "處理中", "已取消/尚未開始", "完成率"]);
  
  const headerRange = sheet.getRange(2, 1, 1, 6);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#F3F4F6");
  headerRange.setHorizontalAlignment("center");
  
  const depts = Object.keys(stats).sort();
  let totalSum = 0;
  let completedSum = 0;
  let inProgressSum = 0;
  let notStartedSum = 0;
  
  depts.forEach(dept => {
    const s = stats[dept];
    const validTotal = s.completed + s.inProgress;
    const completionRate = validTotal > 0
      ? `${Math.round((s.completed / validTotal) * 100)}%`
      : "0%";
    
    sheet.appendRow([
      dept,
      s.total || 0,
      s.completed || 0,
      s.inProgress || 0,
      s.notStarted || 0,
      completionRate
    ]);
    
    totalSum += s.total;
    completedSum += s.completed;
    inProgressSum += s.inProgress;
    notStartedSum += s.notStarted;
  });
  
  sheet.appendRow([""]);
  const validTotalSum = completedSum + inProgressSum;
  const overallRate = validTotalSum > 0
    ? `${Math.round((completedSum / validTotalSum) * 100)}%`
    : "0%";
  
  const lastRow = sheet.getLastRow();
  sheet.appendRow([
    "總計",
    totalSum,
    completedSum,
    inProgressSum,
    notStartedSum,
    overallRate
  ]);
  
  const summaryRange = sheet.getRange(lastRow + 1, 1, 1, 6);
  summaryRange.setFontWeight("bold");
  const summaryColor = sourceType === 'needs' ? '#FFF3E0' : '#E8F5E9';
  summaryRange.setBackground(summaryColor);
  
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 60);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 150);
  sheet.setColumnWidth(6, 80);
  
  const formulaRow = 2;
  sheet.getRange(formulaRow, 8).setValue("計算公式說明：");
  sheet.getRange(formulaRow, 8).setFontWeight("bold");
  sheet.getRange(formulaRow + 1, 8).setValue("完成率 = 已完成 / (已完成 + 處理中)");
  sheet.getRange(formulaRow + 2, 8).setValue("不計入：已取消/尚未開始");
  
  createPieCharts(sheet, depts.length, reportTitle, startDate, sourceType);
}

function createPieCharts(sheet, deptCount, reportTitle, startDate, sourceType) {
  try {
    const mainColor = String(sourceType || '').toLowerCase() === 'needs' ? '#FFA500' : '#4CAF50';
    const dataStartRow = 3;
    
    const titleMatch = reportTitle.match(/部門(.+)統計/);
    const type = titleMatch ? titleMatch[1] : "";
    const yearMonth = startDate.substring(0, 7).replace("/", ".");
    
    // 效能優化：批次讀取部門資料
    const deptRange = sheet.getRange(dataStartRow, 1, deptCount, 2).getValues();
    const deptData = deptRange.map(row => ({
      dept: row[0],
      count: row[1]
    }));
    deptData.sort((a, b) => b.count - a.count);
    
    const sortedDataRow = dataStartRow;
    const sortedDataCol = 15;
    deptData.forEach((item, idx) => {
      sheet.getRange(sortedDataRow + idx, sortedDataCol).setValue(item.dept);
      sheet.getRange(sortedDataRow + idx, sortedDataCol + 1).setValue(item.count);
    });
    
    const chart1 = sheet.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(sheet.getRange(sortedDataRow, sortedDataCol, deptCount, 2))
      .setPosition(dataStartRow, 10, 0, 0)
      .setOption('title', `${yearMonth} 各部門${type}案件數量`)
      .setOption('width', 550)
      .setOption('height', 400)
      .setOption('legend', {position: 'none'})
      .setOption('hAxis', {title: '案件數量', minValue: 0})
      .setOption('vAxis', {title: ''})
      .setOption('bar', {groupWidth: '70%'})
      .setOption('colors', [mainColor])
      .build();
    sheet.insertChart(chart1);
    
    sheet.getRange(sortedDataRow, sortedDataCol, deptCount, 2).setFontColor('#FFFFFF');
    
    const totalRow = sheet.getLastRow();
    const completedVal = sheet.getRange(totalRow, 3).getValue();
    const inProgressVal = sheet.getRange(totalRow, 4).getValue();
    const notStartedVal = sheet.getRange(totalRow, 5).getValue();
    
    const tempDataRow = totalRow + 3;
    sheet.getRange(tempDataRow, 1).setValue("狀態");
    sheet.getRange(tempDataRow, 2).setValue("數量");
    sheet.getRange(tempDataRow + 1, 1).setValue("已完成");
    sheet.getRange(tempDataRow + 1, 2).setValue(completedVal);
    sheet.getRange(tempDataRow + 2, 1).setValue("處理中");
    sheet.getRange(tempDataRow + 2, 2).setValue(inProgressVal);
    sheet.getRange(tempDataRow + 3, 1).setValue("已取消/尚未開始");
    sheet.getRange(tempDataRow + 3, 2).setValue(notStartedVal);
    
    const chart2 = sheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange(tempDataRow + 1, 1, 3, 2))
      .setPosition(dataStartRow + 18, 10, 0, 0)
      .setOption('title', `${yearMonth} 整體${type}狀態`)
      .setOption('width', 450)
      .setOption('height', 300)
      .setOption('pieSliceText', 'value')
      .setOption('legend', {position: 'right'})
      .setOption('colors', [mainColor, '#2196F3', '#9E9E9E'])
      .build();
    sheet.insertChart(chart2);
    
    sheet.getRange(tempDataRow, 1, 4, 2).setFontColor('#FFFFFF');
    
  } catch (e) {
    Logger.log("❌ 圖表建立失敗：" + e.message);
  }
}

function findColumnIndex(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || "").trim();
    for (const name of possibleNames) {
      if (header === name || header.includes(name)) {
        return i;
      }
    }
  }
  return -1;
}

// ==================== 報修分類統計（新增）====================

/**
 * 匯出報修主項目統計
 */
function exportRepairMainCategoryStats(startDate, endDate) {
  exportCategoryStatsGeneric(startDate, endDate, "repair", "main", "報修統計-依項目別");
}

/**
 * 匯出報修子項目統計
 */
function exportRepairSubCategoryStats(startDate, endDate) {
  exportCategoryStatsGeneric(startDate, endDate, "repair", "sub", "報修統計-細項");
}

// ==================== 需求分類統計（新增）====================

/**
 * 匯出需求主項目統計
 */
function exportNeedsMainCategoryStats(startDate, endDate) {
  exportCategoryStatsGeneric(startDate, endDate, "needs", "main", "需求統計-依項目別");
}

/**
 * 匯出需求子項目統計
 */
function exportNeedsSubCategoryStats(startDate, endDate) {
  exportCategoryStatsGeneric(startDate, endDate, "needs", "sub", "需求統計-細項");
}

// ==================== 通用分類統計 ====================

/**
 * 通用分類統計函式
 * @param {string} startDate - 開始日期
 * @param {string} endDate - 結束日期
 * @param {string} sourceType - "repair" 或 "needs"
 * @param {string} categoryLevel - "main" 或 "sub"
 * @param {string} reportTitle - 報表標題
 */
function exportCategoryStatsGeneric(startDate, endDate, sourceType, categoryLevel, reportTitle) {
  try {
    const sources = readConfig();
    const targetSrc = sources.find(s => {
      const type = String(s.type || "").toLowerCase();
      return type === sourceType;
    });
    
    if (!targetSrc) {
      Logger.log(`❌ 找不到 type="${sourceType}" 的來源`);
      return;
    }
    
    const logDao = getLogEntryDAO(targetSrc);
    const sheet = logDao.getSheet();
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow < 2) {
      Logger.log("❌ 工作表無資料");
      return;
    }
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
      .filter(row => !isEmptyRow(row));
    
    // 找欄位索引
    const mainCategoryIdx = findColumnIndex(headers, ["需求分類(自動)", "報修分類(自動)"]);
    const subCategoryIdx = findColumnIndex(headers, ["需求類型", "報修項目"]);
    const dateIdx = findColumnIndex(headers, ["新增日期"]);
    const statusIdx = findColumnIndex(headers, ["狀態"]);
    
    if (dateIdx === -1) {
      Logger.log("❌ 找不到「新增日期」欄位");
      return;
    }
    
    // 篩選日期範圍
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const filtered = rows.filter(row => {
      const dateVal = row[dateIdx];
      if (!dateVal) return false;
      const date = new Date(dateVal);
      return date >= start && date <= end;
    });
    
    Logger.log(`✅ 篩選日期範圍：${startDate} ~ ${endDate}，找到 ${filtered.length} 筆資料`);
    
    // 統計分類
    const stats = {};
    
    filtered.forEach(row => {
      let categoryKey;
      
      if (categoryLevel === "main") {
        categoryKey = mainCategoryIdx !== -1 
          ? String(row[mainCategoryIdx] || "未分類").trim()
          : "未分類";
      } else {
        categoryKey = subCategoryIdx !== -1 
          ? String(row[subCategoryIdx] || "未分類").trim()
          : "未分類";
      }
      
      if (!stats[categoryKey]) {
        stats[categoryKey] = { 
          total: 0, 
          completed: 0, 
          inProgress: 0,
          notStarted: 0
        };
      }
      
      stats[categoryKey].total++;
      
      if (statusIdx !== -1) {
        const status = String(row[statusIdx] || "").trim();
        
        if (status.includes("完成") && !status.includes("待確認")) {
          stats[categoryKey].completed++;
        } else if (status.includes("處理中") || status.includes("待確認")) {
          stats[categoryKey].inProgress++;
        } else {
          stats[categoryKey].notStarted++;
        }
      }
    });
    
    // 輸出統計結果
    outputCategoryStatsToSheet(stats, startDate, endDate, reportTitle, sourceType);
    
  } catch (e) {
    Logger.log("❌ 分類統計失敗：" + e.message);
    Logger.log(e.stack);
  }
}

/**
 * 輸出分類統計到試算表
 */
function outputCategoryStatsToSheet(stats, startDate, endDate, reportTitle, sourceType) {
  const CONFIG = getConfig();
  const REPAIR_FOLDER_ID = CONFIG.get(PROPERTY_KEYS.REPORTS_FOLDER_ID); // 使用 REPORTS_FOLDER_ID 作為報修的預設資料夾
  const NEEDS_FOLDER_ID = CONFIG.get(PROPERTY_KEYS.NEEDS_FOLDER_ID);

  const typePrefix = sourceType === "needs" ? "需求" : "報修";
  const fileName = `${reportTitle}_${startDate.replace(/\//g, '')}_${endDate.replace(/\//g, '')}`;
  
  const ss = SpreadsheetApp.create(fileName);
  const sheet = ss.getActiveSheet();
  sheet.setName(reportTitle);
  
  // 寫入標題
  sheet.appendRow([reportTitle + ` (${startDate} ~ ${endDate})`]);
  sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
  
  // 寫入表頭
  sheet.appendRow(["分類", "總計", "已完成", "處理中", "已取消/尚未開始", "完成率"]);
  
  const headerRange = sheet.getRange(2, 1, 1, 6);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#F3F4F6");
  headerRange.setHorizontalAlignment("center");
  
  // 排序並寫入資料（依總計數量由大到小）
  const categories = Object.keys(stats).sort((a, b) => stats[b].total - stats[a].total);
  
  let totalSum = 0;
  let completedSum = 0;
  let inProgressSum = 0;
  let notStartedSum = 0;
  
  categories.forEach(category => {
    const s = stats[category];
    const validTotal = s.completed + s.inProgress;
    const completionRate = validTotal > 0
      ? `${Math.round((s.completed / validTotal) * 100)}%`
      : "0%";
    
    sheet.appendRow([
      category,
      s.total || 0,
      s.completed || 0,
      s.inProgress || 0,
      s.notStarted || 0,
      completionRate
    ]);
    
    totalSum += s.total;
    completedSum += s.completed;
    inProgressSum += s.inProgress;
    notStartedSum += s.notStarted;
  });
  
  // 寫入總計
  sheet.appendRow([""]);
  const validTotalSum = completedSum + inProgressSum;
  const overallRate = validTotalSum > 0
    ? `${Math.round((completedSum / validTotalSum) * 100)}%`
    : "0%";
  
  const lastRow = sheet.getLastRow();
  sheet.appendRow([
    "總計",
    totalSum,
    completedSum,
    inProgressSum,
    notStartedSum,
    overallRate
  ]);
  
  const summaryRange = sheet.getRange(lastRow + 1, 1, 1, 6);
  summaryRange.setFontWeight("bold");
  const summaryColor = sourceType === 'needs' ? '#FFF3E0' : '#E8F5E9';
  summaryRange.setBackground(summaryColor);
  
  // 調整欄寬
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 60);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 150);
  sheet.setColumnWidth(6, 80);
  
  // 建立圓餅圖
  createCategoryChart(sheet, categories.length, reportTitle, startDate, sourceType);
  
  // 移動到指定資料夾
  const folderId = sourceType === "needs" ? NEEDS_FOLDER_ID : REPAIR_FOLDER_ID;
  
  if (folderId) {
    try {
      const file = DriveApp.getFileById(ss.getId());
      const folder = DriveApp.getFolderById(folderId);
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
      Logger.log("✅ 統計表已建立並移至指定資料夾：" + ss.getUrl());
    } catch (e) {
      Logger.log("⚠️ 移動檔案失敗，但統計表已建立：" + ss.getUrl());
      Logger.log("   錯誤原因：" + e.message);
    }
  } else {
    Logger.log("✅ 統計表已建立：" + ss.getUrl());
    Logger.log("⚠️ 未設定資料夾 ID，檔案保留在根目錄");
  }
}

/**
 * 建立分類圓餅圖
 */
function createCategoryChart(sheet, categoryCount, reportTitle, startDate, sourceType) {
  try {
    const mainColor = String(sourceType || '').toLowerCase() === 'needs' ? '#FFA500' : '#4CAF50';
    const dataStartRow = 3;
    const yearMonth = startDate.substring(0, 7).replace("/", ".");
    
    // 長條圖：分類數量
    const chart1 = sheet.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(sheet.getRange(dataStartRow, 1, categoryCount, 2))
      .setPosition(dataStartRow, 8, 0, 0)
      .setOption('title', `${yearMonth} ${reportTitle}分布`)
      .setOption('width', 500)
      .setOption('height', 400)
      .setOption('legend', {position: 'none'})
      .setOption('hAxis', {title: '案件數量', minValue: 0})
      .setOption('vAxis', {title: ''})
      .setOption('bar', {groupWidth: '70%'})
      .setOption('colors', [mainColor])
      .build();
    
    sheet.insertChart(chart1);
    
    // 圓餅圖：狀態分布
    const totalRow = sheet.getLastRow();
    const completedVal = sheet.getRange(totalRow, 3).getValue();
    const inProgressVal = sheet.getRange(totalRow, 4).getValue();
    const notStartedVal = sheet.getRange(totalRow, 5).getValue();
    
    const tempDataRow = totalRow + 3;
    sheet.getRange(tempDataRow, 1).setValue("狀態");
    sheet.getRange(tempDataRow, 2).setValue("數量");
    sheet.getRange(tempDataRow + 1, 1).setValue("已完成");
    sheet.getRange(tempDataRow + 1, 2).setValue(completedVal);
    sheet.getRange(tempDataRow + 2, 1).setValue("處理中");
    sheet.getRange(tempDataRow + 2, 2).setValue(inProgressVal);
    sheet.getRange(tempDataRow + 3, 1).setValue("已取消/尚未開始");
    sheet.getRange(tempDataRow + 3, 2).setValue(notStartedVal);
    
    const chart2 = sheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange(tempDataRow + 1, 1, 3, 2))
      .setPosition(dataStartRow + 18, 8, 0, 0)
      .setOption('title', `${yearMonth} 整體狀態分布`)
      .setOption('width', 450)
      .setOption('height', 300)
      .setOption('pieSliceText', 'value')
      .setOption('legend', {position: 'right'})
      .setOption('colors', [mainColor, '#2196F3', '#9E9E9E'])
      .build();
    
    sheet.insertChart(chart2);
    
    // 隱藏輔助資料
    sheet.getRange(tempDataRow, 1, 4, 2).setFontColor('#FFFFFF');
    
  } catch (e) {
    Logger.log("❌ 圖表建立失敗：" + e.message);
  }
}

// ==================== 綜合分析（新增）====================

/**
 * 匯出報修 vs 需求對比統計
 */
function exportComparisonStats(startDate, endDate) {
  const CONFIG = getConfig();
  const COMPARISON_FOLDER_ID = CONFIG.get(PROPERTY_KEYS.COMPARISON_FOLDER_ID);
  
  try {
    Logger.log("開始匯出對比統計...");
    
    // 讀取報修資料
    const repairData = getStatsData(startDate, endDate, "repair");
    // 讀取需求資料
    const needsData = getStatsData(startDate, endDate, "needs");
    
    // 建立對比報表
    const fileName = `報修vs需求對比_${startDate.replace(/\//g, '')}_${endDate.replace(/\//g, '')}`;
    const ss = SpreadsheetApp.create(fileName);
    const sheet = ss.getActiveSheet();
    sheet.setName("對比分析");
    
    // 寫入標題
    sheet.appendRow([`報修 vs 需求對比分析 (${startDate} ~ ${endDate})`]);
    sheet.getRange(1, 1).setFontSize(14).setFontWeight("bold");
    
    // 寫入表頭
    sheet.appendRow(["項目", "報修", "需求", "合計"]);
    const headerRange = sheet.getRange(2, 1, 1, 4);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#F3F4F6");
    headerRange.setHorizontalAlignment("center");
    
    // 寫入資料
    sheet.appendRow([
      "總案件數",
      repairData.total,
      needsData.total,
      repairData.total + needsData.total
    ]);
    
    sheet.appendRow([
      "已完成",
      repairData.completed,
      needsData.completed,
      repairData.completed + needsData.completed
    ]);
    
    sheet.appendRow([
      "處理中",
      repairData.inProgress,
      needsData.inProgress,
      repairData.inProgress + needsData.inProgress
    ]);
    
    sheet.appendRow([
      "完成率",
      repairData.completionRate,
      needsData.completionRate,
      "-"
    ]);
    
    // 調整欄寬
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 100);
    sheet.setColumnWidth(3, 100);
    sheet.setColumnWidth(4, 100);
    
    // 建立對比圖表
    createComparisonChart(sheet, repairData, needsData, startDate);
    
    
    // 移動檔案到3_Analytics資料夾（對比報表優先放在報修資料夾）
    if (COMPARISON_FOLDER_ID && !COMPARISON_FOLDER_ID.includes("PLACEHOLDER")) {
      try {
        const file = DriveApp.getFileById(ss.getId());
        const folder = DriveApp.getFolderById(COMPARISON_FOLDER_ID);
        folder.addFile(file);
        DriveApp.getRootFolder().removeFile(file);
        Logger.log("✅ 對比統計已建立並移至3_Analytics資料夾：" + ss.getUrl());
      } catch (e) {
        Logger.log("⚠️ 移動檔案失敗，但統計表已建立：" + ss.getUrl());
        Logger.log("   錯誤原因：" + e.message);
      }
    } else {
      Logger.log("⚠️ 未設定 COMPARISON_FOLDER_ID，檔案保留在根目錄");
    }

    
  } catch (e) {
    Logger.log("❌ 對比統計失敗：" + e.message);
    Logger.log(e.stack);
  }
}

/**
 * 取得統計資料
 */
function getStatsData(startDate, endDate, sourceType) {
  const sources = readConfig();
  const targetSrc = sources.find(s => String(s.type || "").toLowerCase() === sourceType);
  
  if (!targetSrc) {
    return { total: 0, completed: 0, inProgress: 0, notStarted: 0, completionRate: "0%" };
  }
  
  const logDao = getLogEntryDAO(targetSrc);
  const sheet = logDao.getSheet();
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < 2) {
    return { total: 0, completed: 0, inProgress: 0, notStarted: 0, completionRate: "0%" };
  }
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
    .filter(row => !isEmptyRow(row));
  
  const dateIdx = findColumnIndex(headers, ["新增日期"]);
  const statusIdx = findColumnIndex(headers, ["狀態"]);
  
  if (dateIdx === -1) {
    return { total: 0, completed: 0, inProgress: 0, notStarted: 0, completionRate: "0%" };
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  const filtered = rows.filter(row => {
    const dateVal = row[dateIdx];
    if (!dateVal) return false;
    const date = new Date(dateVal);
    return date >= start && date <= end;
  });
  
  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  
  filtered.forEach(row => {
    if (statusIdx !== -1) {
      const status = String(row[statusIdx] || "").trim();
      
      if (status.includes("完成") && !status.includes("待確認")) {
        completed++;
      } else if (status.includes("處理中") || status.includes("待確認")) {
        inProgress++;
      } else {
        notStarted++;
      }
    }
  });
  
  const validTotal = completed + inProgress;
  const completionRate = validTotal > 0 
    ? `${Math.round((completed / validTotal) * 100)}%` 
    : "0%";
  
  return {
    total: filtered.length,
    completed: completed,
    inProgress: inProgress,
    notStarted: notStarted,
    completionRate: completionRate
  };
}

/**
 * 建立對比圖表
 */
function createComparisonChart(sheet, repairData, needsData, startDate) {
  try {
    const yearMonth = startDate.substring(0, 7).replace("/", ".");
    
    // 準備圖表資料
    const chartDataRow = sheet.getLastRow() + 3;
    sheet.getRange(chartDataRow, 1).setValue("類型");
    sheet.getRange(chartDataRow, 2).setValue("案件數");
    sheet.getRange(chartDataRow + 1, 1).setValue("報修");
    sheet.getRange(chartDataRow + 1, 2).setValue(repairData.total);
    sheet.getRange(chartDataRow + 2, 1).setValue("需求");
    sheet.getRange(chartDataRow + 2, 2).setValue(needsData.total);
    
    // 圓餅圖：報修 vs 需求
    const chart = sheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange(chartDataRow + 1, 1, 2, 2))
      .setPosition(3, 5, 0, 0)
      .setOption('title', `${yearMonth} 報修 vs 需求比例`)
      .setOption('width', 450)
      .setOption('height', 300)
      .setOption('pieSliceText', 'value')
      .setOption('legend', {position: 'right'})
      .setOption('colors', ['#FF6B6B', '#4ECDC4'])
      .build();
    
    sheet.insertChart(chart);
    
    // 隱藏輔助資料
    sheet.getRange(chartDataRow, 1, 3, 2).setFontColor('#FFFFFF');
    
  } catch (e) {
    Logger.log("❌ 對比圖表建立失敗：" + e.message);
  }
}

// ==================== 工具函式 ====================

function isEmptyRow(row) {
  return row.every(cell => cell === "" || cell === null || cell === undefined);
}
