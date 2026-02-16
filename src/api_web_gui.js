/**
 * api_web_gui.gs
 * v7.5 Final Release
 * Feature: Pagination + Server Cache + Dual Field Write + Exact Column Match
 */

function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('IT 工作日報系統')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function apiGetSources() {
  return readConfig();
}

// ==========================================
// 🟢 設定檔讀取介面 (Config Sheet版)
// ==========================================
function apiGetFormOptions() {
  const CONFIG = getConfig();
  const configSsId = CONFIG.get(PROPERTY_KEYS.SPREADSHEET_ID);
  
  let ss;
  try {
    if (!configSsId) {
       // 如果沒設定 ID，嘗試抓當前綁定的表 (Fallback)
       ss = SpreadsheetApp.getActiveSpreadsheet();
    } else {
       // 抓取指定的外部設定檔
       ss = SpreadsheetApp.openById(configSsId);
    }
  } catch (e) {
    Logger.log("設定檔讀取失敗: " + e.message);
    return { depts: [], repairItems: [], needsItems: [] };
  }
  
  // 1. 讀取部門 (Department) - 取 B欄 (組)
  // 假設部門表名為 "Department"
  const getDepts = () => {
    const sh = ss.getSheetByName("Department");
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().flat().filter(String);
  };

  // 2. 讀取項目 (通用邏輯)
  // 假設分類表名為 "RepairCategory" 和 "NeedsCategory"
  const getActiveItems = (sheetName) => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return [];
    
    // 讀取 B欄~D欄 (B=子項目, D=啟用)
    const data = sh.getRange(2, 2, sh.getLastRow() - 1, 3).getValues(); 
    
    return data.filter(row => {
      const item = row[0];       // B欄
      const enabled = row[2];    // D欄
      return item && String(enabled).toUpperCase() === 'Y';
    }).map(row => row[0]);
  };

  return { 
    depts: getDepts(), 
    repairItems: getActiveItems(CONFIG.get(PROPERTY_KEYS.SHEET_REPAIR_CATEGORY) || "RepairCategory"),
    needsItems: getActiveItems(CONFIG.get(PROPERTY_KEYS.SHEET_NEEDS_CATEGORY) || "NeedsCategory")
  };
}

function getAdminMenuConfig() {
  return [
    {
      category: "🛠️ 系統維護",
      icon: "bi-gear-wide-connected",
      items: [
        { label: "重送今日日報", func: "重新寄送本日logbook", icon: "bi-envelope-paper", type: "job", style: "warning" },
        { label: "刷新代碼快取", func: "測試_刷新代碼快取", icon: "bi-arrow-clockwise", type: "job", style: "secondary" },
        { label: "檢查分類完整性", func: "測試_檢查報修資料完整性", icon: "bi-list-check", type: "job", style: "info" },
        { label: "檢查 UUID 狀態", func: "測試_檢查UUID狀態", icon: "bi-fingerprint", type: "job", style: "primary" },
        { label: "補填遺失 UUID", func: "測試_補填UUID", icon: "bi-database-add", type: "job", style: "danger" }
      ]
    }
  ];
}

function apiGetAdminMenu() {
  return getAdminMenuConfig();
}

function apiRunAdminJob(payload, jobType) {
  if (jobType === 'chart') {
    return generateAnalysisReport(payload.type, payload.period);
  }
  const funcName = payload;
  try {
    if (typeof this[funcName] === 'function') {
       const result = this[funcName]();
       if (result && (typeof result === 'string' || typeof result === 'object')) return result;
       return `✅ 指令執行完成`;
    } else {
       throw new Error(`找不到函式`);
    }
  } catch (e) {
    throw new Error("執行失敗: " + e.message);
  }
}

function apiGetSheetData(sheetId, sheetName) {
  // Use LogEntryDAO for all read operations
  const logDao = getLogEntryDAO({ id: sheetId, sheet: sheetName });
  const sheet = logDao.getSheet(); // Throws error if not found

  const gid = sheet.getSheetId();
  const ssUrl = sheet.getParent().getUrl();
  const lastRow = sheet.getLastRow();
  const nextRow = lastRow + 1;
  const newRowLink = `${ssUrl}#gid=${gid}&range=A${nextRow}`;

  if (lastRow < 2) return { data: [], meta: { newRowLink: newRowLink } };

  const LIMIT = 2000; 
  const startRow = Math.max(2, lastRow - LIMIT + 1);
  const numRows = lastRow - startRow + 1;

  // Smart Width
  const range = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn());
  const values = range.getValues();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const hMap = {};
  headers.forEach((h, i) => hMap[String(h).trim()] = i);

  // DEBUG: Log headers to check for category/dept columns
  const findCol = (candidates) => {
      for (const candidate of candidates) {
          const idx = headers.findIndex(h => String(h).trim().includes(candidate));
          if (idx !== -1) return idx;
      }
      return -1;
  };

  const idx = {
    uuid:     findCol(["UUID", "System_ID"]),
    date:     findCol(["新增日", "新增日期", "日期"]),
    status:   findCol(["狀態", "處理狀態"]),
    category: findCol(["報修項目", "需求類型", "子項目", "分類"]),
    item:     findCol(["項目", "內容", "說明", "主旨"]),
    progress: findCol(["處理進度", "處理進度簡述"]),
    dept:     findCol(["報修單位(組)", "需求單位(組)", "單位(組)", "報修單位", "需求單位"]),
    updated:  findCol(["最後更新時間", "更新時間"])
  };

  // 🔍 DEBUG: 印出實際 headers 和 findCol 結果（確認後可移除）
  Logger.log("[apiGetSheetData] Sheet: " + sheetName);
  Logger.log("[apiGetSheetData] Headers: " + JSON.stringify(headers));
  Logger.log("[apiGetSheetData] idx 結果: " + JSON.stringify(idx));

  const logs = values.map((row, index) => {
    const item = idx.item > -1 ? row[idx.item] : "";
    if (!item) return null;
    const currentRow = startRow + index;
    const deepLink = `${ssUrl}#gid=${gid}&range=${currentRow}:${currentRow}`;
    
    return {
      id: currentRow,
      uuid: idx.uuid > -1 ? row[idx.uuid] : "",
      status: idx.status > -1 ? String(row[idx.status]) : "",
      date: idx.date > -1 ? formatDate(row[idx.date]) : "",
      item: item,
      progress: idx.progress > -1 ? row[idx.progress] : "",
      updated: idx.updated > -1 ? formatDate(row[idx.updated]) : "",
      category: idx.category > -1 ? row[idx.category] : "",
      dept:     idx.dept > -1 ? row[idx.dept] : "",
      link: deepLink
    };
  }).filter(log => log !== null);

  return { data: logs.reverse(), meta: { newRowLink: newRowLink } };
} 

// ==========================================
// 🟢 [MOD] 儀表板快取機制 (CacheService)
// ==========================================
// 註：這兩個 apiGetGlobalSummary 函式看起來是重複的，但 v6.7 版本更為完整。
// 這裡保留 v7.5 版的架構註釋，並讓 v6.7 版本的實作邏輯為主。

function generateGlobalSummary() {
    const sources = readConfig();
    const today = new Date();
    const todayStr = Utilities.formatDate(today, "Asia/Taipei", "yyyy/MM/dd");
    
    let kpi = { todayNew: 0, todayDone: 0, pendingTotal: 0 };
    let stream = [];
    let pending = [];

    sources.forEach(src => {
        try {
            const logDao = getLogEntryDAO(src);
            const sheet = logDao.getSheet();
            if(!sheet || sheet.getLastRow() < 2) return;
            
            // 讀取全部資料以計算 KPI (若效能仍差，可考慮限制讀取行數)
            const data = sheet.getRange(2, 1, sheet.getLastRow()-1, sheet.getLastColumn()).getValues();
            const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            const hMap = {};
            headers.forEach((h, i) => hMap[String(h).trim()] = i);

             data.forEach(row => {
                let date = "";
                if (hMap["新增日期"] > -1) date = formatDate(row[hMap["新增日期"]]);
                else if (hMap["新增日"] > -1) date = formatDate(row[hMap["新增日"]]);
                else if (hMap["日期"] > -1) date = formatDate(row[hMap["日期"]]);

                const status = hMap["狀態"] > -1 ? String(row[hMap["狀態"]]) : "";
                
                // 優先取項目(內容)，若無則取分類(報修項目)
                let item = "";
                if (hMap["項目"] > -1) item = row[hMap["項目"]];
                if (!item && hMap["報修項目"] > -1) item = row[hMap["報修項目"]];
                
                const uuid = hMap["UUID"] > -1 ? row[hMap["UUID"]] : (hMap["System_ID"] > -1 ? row[hMap["System_ID"]] : "");

                if (date === todayStr) kpi.todayNew++;
                if (date === todayStr && (status.includes("完成") || status.includes("✔"))) kpi.todayDone++;
                if (!status.includes("完成") && !status.includes("✔") && !status.includes("取消") && !status.includes("✖")) {
                    kpi.pendingTotal++;
                    pending.push({ source: src.name, item, status, date, progress: "", uuid });
                }
                if (date === todayStr) {
                    stream.push({ source: src.name, item, status, date, progress: "", isCompleted: status.includes("完成"), uuid });
                }
            });

        } catch (e) {
            Logger.log(`Error reading ${src.name}: ${e.message}`);
        }
    });

    stream.sort((a, b) => b.date.localeCompare(a.date));
    pending.sort((a, b) => b.date.localeCompare(a.date));

    return { kpi, stream: stream.slice(0, 20), pending: pending.slice(0, 20) };
}

// 🟢 快取清除器
function clearDashboardCache() {
  CacheService.getScriptCache().remove("DASHBOARD_DATA");
}

// ==========================================
// 🆕 寫入控制器 v7.5 (雙欄位 + 精確鎖定 + 快取失效)
// ==========================================

function apiCreateTask(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { success: false, message: "系統忙碌中 (Locked)，請稍後再試" };
  }

  try {
    const { sourceName, data } = payload; 
    // data: { category, item, status, progress, dept }

    const sources = readConfig();
    const targetSrc = sources.find(s => s.name === sourceName);
    if (!targetSrc) throw new Error(`找不到來源: ${sourceName}`);
    
    // 使用 DAO 取得 Sheet 實例
    const logDao = getLogEntryDAO(targetSrc);
    const sheet = logDao.getSheet();

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const findCol = (candidates) => {
        for (const candidate of candidates) {
            const idx = headers.findIndex(h => String(h).trim().includes(candidate));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const idx = {
      uuid:     findCol(["UUID", "System_ID"]),
      date:     findCol(["新增日", "新增日期", "日期"]),
      status:   findCol(["狀態", "處理狀態"]),
      category: findCol(["報修項目", "需求類型", "子項目", "分類"]),
      item:     findCol(["項目", "內容", "說明", "主旨"]),
      progress: findCol(["處理進度", "處理進度簡述"]),
      // 🟢 精確鎖定 "單位(組)"
      dept:     findCol(["報修單位(組)", "需求單位(組)", "單位(組)", "報修單位", "需求單位"]),
      updated:  findCol(["最後更新時間", "更新時間"])
    };

    const scanCol = idx.item !== -1 ? idx.item : (idx.category !== -1 ? idx.category : -1);
    
    if (scanCol === -1) throw new Error("資料表結構異常: 找不到[項目]或[分類]欄位");
    if (idx.date === -1) throw new Error("資料表結構異常: 找不到[日期]欄位");

    const lastRow = sheet.getLastRow();
    let targetRow = -1;

    // 1. 填補坑洞
    if (lastRow >= 2) {
      const colValues = sheet.getRange(2, scanCol + 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < colValues.length; i++) {
        if (colValues[i][0] === "") {
          targetRow = i + 2; 
          break;
        }
      }
    }

    // 2. 新增列
    if (targetRow === -1) {
      sheet.insertRowAfter(lastRow);
      targetRow = lastRow + 1;
      try {
        const sourceRange = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn());
        sourceRange.copyTo(sheet.getRange(targetRow, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      } catch (err) {}
    }

    const sanitize = (input) => {
      if (typeof input !== 'string') return input;
      if (input.match(/^[=+\-@]/)) return "'" + input; 
      return input;
    };

    const now = new Date();
    const dateStr = Utilities.formatDate(now, "Asia/Taipei", "yyyy/MM/dd");

    sheet.getRange(targetRow, idx.date + 1).setValue(dateStr);
    
    if (idx.item !== -1 && data.item) sheet.getRange(targetRow, idx.item + 1).setValue(sanitize(data.item));
    if (idx.category !== -1 && data.category) sheet.getRange(targetRow, idx.category + 1).setValue(sanitize(data.category));
    if (idx.dept !== -1 && data.dept) sheet.getRange(targetRow, idx.dept + 1).setValue(sanitize(data.dept));

    if (idx.status !== -1) sheet.getRange(targetRow, idx.status + 1).setValue(data.status || "○ 待處理");
    if (idx.progress !== -1) sheet.getRange(targetRow, idx.progress + 1).setValue(sanitize(data.progress || ""));
    
    if (idx.uuid !== -1) sheet.getRange(targetRow, idx.uuid + 1).setValue(Utilities.getUuid());
    if (idx.updated !== -1) sheet.getRange(targetRow, idx.updated + 1).setValue(now);

    SpreadsheetApp.flush();
    
    // 🚀 清除快取，讓前端能看到最新數據
    clearDashboardCache();

    return { success: true, message: "新增成功" };

  } catch (e) {
    Logger.log(`Create Error: ${e.message}`);
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

function apiUpdateTask(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { success: false, message: "系統忙碌" };

  try {
    const { uuid, sourceName, updates } = payload;
    const sources = readConfig();
    const targetSrc = sources.find(s => s.name === sourceName);
    if (!targetSrc) throw new Error("找不到來源");

    const logDao = getLogEntryDAO(targetSrc);
    const sheet = logDao.getSheet();
    // if (!sheet) throw new Error("找不到工作表"); // Handled by logDao.getSheet()

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let uuidCol = headers.indexOf("UUID");
    if (uuidCol === -1) uuidCol = headers.indexOf("System_ID");
    if (uuidCol === -1) throw new Error("無 UUID 欄位");

    const ids = sheet.getRange(2, uuidCol + 1, sheet.getLastRow() - 1, 1).getValues().flat();
    const rowIdx = ids.indexOf(uuid);
    if (rowIdx === -1) throw new Error("找不到該任務 UUID");
    
    const targetRow = rowIdx + 2;
    
    const hMap = {};
    headers.forEach((h, i) => hMap[String(h).trim()] = i);

    const findCol = (candidates) => {
       for (const candidate of candidates) {
           const idx = headers.findIndex(h => String(h).trim().includes(candidate));
           if (idx !== -1) return idx;
       }
       return -1;
    };

    if (updates.status) {
       const statusCol = findCol(["狀態"]);
       if (statusCol > -1) sheet.getRange(targetRow, statusCol + 1).setValue(updates.status);
    }
    if (updates.progress !== undefined) {
       const progressCol = findCol(["處理進度簡述", "處理進度"]);
       if (progressCol > -1) sheet.getRange(targetRow, progressCol + 1).setValue(updates.progress);
    }
    if (updates.category) {
       const categoryCol = findCol(["報修項目", "需求類型", "子項目", "分類"]);
       if (categoryCol > -1) sheet.getRange(targetRow, categoryCol + 1).setValue(updates.category);
    }
    if (updates.dept) {
       const deptCol = findCol(["報修單位(組)", "需求單位(組)", "單位(組)"]);
       if (deptCol > -1) sheet.getRange(targetRow, deptCol + 1).setValue(updates.dept);
    }
    
    const updatedCol = findCol(["最後更新時間"]);
    if (updatedCol > -1) sheet.getRange(targetRow, updatedCol + 1).setValue(new Date());

    SpreadsheetApp.flush();
    
    // 🚀 清除快取
    clearDashboardCache();

    return { success: true, message: "更新成功" };

  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
// ==========================================
// 📊 分析引擎 v6.1 (Priority Matching)
// ==========================================

function generateAnalysisReport(analysisType, periodMode) {
  const cacheSS = getOrInitCacheSS();
  const sheet = cacheSS.getSheets()[0];
  
  const existingCharts = sheet.getCharts();
  existingCharts.forEach(c => sheet.removeChart(c));
  sheet.clear();
  sheet.setColumnWidth(1, 160); 
  sheet.setColumnWidth(8, 160); 

  let summaryData = { total: 0, title: "", period: "" };
  
  try {
    const range = calculateDateRange(periodMode);
    
    const typeLabel = analysisType === 'repair' ? '報修' : '需求';
    let titleDatePart = "";
    if (periodMode.includes('quarter')) {
       const m = range.start.getMonth(); 
       const q = Math.floor(m / 3) + 1;
       const y = range.start.getFullYear();
       titleDatePart = `${y} Q${q}`;
    } else {
       titleDatePart = Utilities.formatDate(range.start, "Asia/Taipei", "yyyy.MM");
    }

    summaryData.title = `${titleDatePart} ${typeLabel}統計`;
    summaryData.period = `${Utilities.formatDate(range.start, "Asia/Taipei", "yyyy/MM/dd")} ~ ${Utilities.formatDate(range.end, "Asia/Taipei", "yyyy/MM/dd")}`;

    // 左側: 部門 (A欄)
    const deptData = fetchStatsDataNative(range.sStr, range.eStr, analysisType, "dept");
    renderNativeReport(sheet, deptData, range.sStr, range.eStr, `部門${typeLabel}統計`, 1, "dept", analysisType);

    // 右側: 項目 (H欄)
    const catData = fetchStatsDataNative(range.sStr, range.eStr, analysisType, "category");
    renderNativeReport(sheet, catData, range.sStr, range.eStr, `${typeLabel}項目統計`, 8, "category", analysisType);

    let total = 0;
    Object.values(deptData).forEach(s => total += s.total);
    summaryData.total = total;

    SpreadsheetApp.flush(); 

    const charts = sheet.getCharts().map(chart => {
      const blob = chart.getBlob();
      return `data:image/png;base64,${Utilities.base64Encode(blob.getBytes())}`;
    });

    return { success: true, charts: charts, summary: summaryData, message: "分析完成" };

  } catch (e) {
    return { success: false, message: "分析失敗: " + e.message + "\n" + e.stack };
  }
}

// ==========================================
// 💎 [NEW] 動態圖表專用 JSON API
// ==========================================
function apiGetAnalysisData(payload) {
  const { type, period } = payload;
  if (!type || !period) {
    throw new Error("分析類型與區間為必填");
  }

  try {
    const range = calculateDateRange(period);
    const typeLabel = type === 'repair' ? '報修' : '需求';
    
    // 1. 組裝報告標題與摘要資訊
    let titleDatePart = "";
    if (period.includes('quarter')) {
       const m = range.start.getMonth();
       const q = Math.floor(m / 3) + 1;
       const y = range.start.getFullYear();
       titleDatePart = `${y} Q${q}`;
    } else {
       titleDatePart = Utilities.formatDate(range.start, "Asia/Taipei", "yyyy.MM");
    }
    const summaryData = {
      title: `${titleDatePart} ${typeLabel}統計`,
      period: `${Utilities.formatDate(range.start, "Asia/Taipei", "yyyy/MM/dd")} ~ ${Utilities.formatDate(range.end, "Asia/Taipei", "yyyy/MM/dd")}`,
      total: 0
    };

    // 2. 獲取部門與分類的原始統計數據
    const deptDataRaw = fetchStatsDataNative(range.sStr, range.eStr, type, "dept");
    const catDataRaw = fetchStatsDataNative(range.sStr, range.eStr, type, "category");

    // 3. 計算總數
    summaryData.total = Object.values(deptDataRaw).reduce((acc, stats) => acc + stats.total, 0);
    
    // 4. 將原始數據格式化為 Chart.js 的格式
    const formatForChartJs = (rawData, sortBy) => {
      let sortedKeys = Object.keys(rawData);
      if (sortBy === 'value') {
        sortedKeys.sort((a, b) => rawData[b].total - rawData[a].total);
      } else { // sort by key/name
        sortedKeys.sort();
      }

      // 只取前 15 筆資料以避免圖表過於擁擠
      const topKeys = sortedKeys.slice(0, 15);

      return {
        labels: topKeys,
        datasets: [{
          label: '總計',
          data: topKeys.map(key => rawData[key].total),
          backgroundColor: type === 'needs' ? 'rgba(255, 152, 0, 0.7)' : 'rgba(76, 175, 80, 0.7)',
          borderColor: type === 'needs' ? 'rgba(255, 152, 0, 1)' : 'rgba(76, 175, 80, 1)',
          borderWidth: 1
        }]
      };
    };

    const pieDataRaw = {
        '已完成': 0,
        '處理中': 0,
        '未開始': 0
    };
    Object.values(deptDataRaw).forEach(stats => {
        pieDataRaw['已完成'] += stats.completed;
        pieDataRaw['處理中'] += stats.inProgress;
        pieDataRaw['未開始'] += stats.notStarted;
    });

    const primaryColor = type === 'needs' ? '#FF9800' : '#4CAF50';
    const pieChartData = {
        labels: Object.keys(pieDataRaw),
        datasets: [{
            data: Object.values(pieDataRaw),
            backgroundColor: [primaryColor, '#2196F3', '#9E9E9E'],
        }]
    };


    // 5. 回傳最終 payload
    return {
      success: true,
      summary: summaryData,
      deptChartData: formatForChartJs(deptDataRaw, 'key'),
      catChartData: formatForChartJs(catDataRaw, 'value'),
      pieChartData: pieChartData
    };

  } catch (e) {
    Logger.log(`apiGetAnalysisData Error: ${e.stack}`);
    return { success: false, message: "資料分析失敗: " + e.message };
  }
}


function calculateDateRange(mode) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); 
  
  let start, end;
  
  if (mode === 'current_month') {
    start = new Date(year, month, 1);
    end = new Date(year, month + 1, 0);
  } 
  else if (mode === 'last_month') {
    start = new Date(year, month - 1, 1); 
    end = new Date(year, month, 0);
  } 
  else if (mode === 'current_quarter') {
    const q = Math.floor(month / 3);
    start = new Date(year, q * 3, 1);
    end = new Date(year, (q + 1) * 3, 0);
  } 
  else if (mode === 'last_quarter') {
    const currentQ = Math.floor(month / 3); 
    let targetQ = currentQ - 1; 
    
    if (targetQ < 0) {
      targetQ = 3; 
      year = year - 1;
    }
    
    start = new Date(year, targetQ * 3, 1);
    end = new Date(year, (targetQ + 1) * 3, 0);
  }
  
  const fmt = d => Utilities.formatDate(d, "Asia/Taipei", "yyyy/MM/dd");
  return { start: start, end: end, sStr: fmt(start), eStr: fmt(end) };
}

// ==========================================
// [v6.1 Fix] 關鍵修正：優先權欄位搜尋
// ==========================================
function fetchStatsDataNative(startDate, endDate, sourceType, mode) {
    const sources = readConfig();
    const targetSrc = sources.find(s => String(s.type || "").toLowerCase() === sourceType);
    if (!targetSrc) throw new Error(`找不到 type="${sourceType}" 的來源`);
    
    const logDao = getLogEntryDAO(targetSrc);
    const sheet = logDao.getSheet();

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return {}; 

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    
    // [v6.1 Fix] 升級版搜尋器：依照 candidates 的順序去 Headers 找，而不是依照 Headers 的順序
    // 這樣才能確保我們優先找到 "部門(自動)" 即使它排在後面
    const findCol = (candidates) => {
        for (const candidate of candidates) {
            // 使用 includes 進行模糊比對，但因為我們依照 candidate 順序找，所以優先權會被保留
            const idx = headers.findIndex(h => String(h).trim().includes(candidate));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const dateIdx = findCol(["新增日期"]);
    const statusIdx = findCol(["狀態"]);
    
    // [v6.1 Fix] 嚴格定義的優先權清單
    let catIdx = -1;
    if (mode === "dept") {
        // 優先找 "部門(自動)"，其次才是 "部門"
        catIdx = findCol(["部門(自動)", "部門", "單位"]);
    } else {
        // 優先找 "分類(自動)"，絕對不先找 "項目" 或 "類型" (除非真的沒別的了)
        catIdx = findCol(["需求分類(自動)", "報修分類(自動)", "主項目"]);
    }

    if (dateIdx === -1) throw new Error("找不到[新增日期]欄位");
    // 如果找不到自動分類，才退而求其次 (Fallback)
    if (catIdx === -1) catIdx = findCol(["需求類型", "報修項目", "項目"]); 

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);

    const stats = {};
    rows.forEach(row => {
       if (row.every(c => c === "")) return;
       const dStr = row[dateIdx];
       if (!dStr) return;
       const d = new Date(dStr);
       
       if (d >= start && d <= end) {
          const cat = row[catIdx] || "未分類";
          if (!stats[cat]) stats[cat] = { total: 0, completed: 0, inProgress: 0, notStarted: 0 };
          stats[cat].total++;
          const status = String(row[statusIdx]);
          if (status.includes("完成") && !status.includes("待確認")) stats[cat].completed++;
          else if (status.includes("處理中") || status.includes("待確認")) stats[cat].inProgress++;
          else stats[cat].notStarted++;
       }
    });
    return stats;
}

function renderNativeReport(sheet, stats, startDate, endDate, reportTitle, startCol, mode, analysisType) {
    const primaryColor = analysisType === 'needs' ? '#FF9800' : '#4CAF50'; // Needs: Orange, Repair: Green
    sheet.getRange(1, startCol).setValue(reportTitle);
    sheet.getRange(1, startCol).setFontSize(12).setFontWeight("bold");
    
    const headers = ["分類", "總計", "已完成", "處理中", "未開始", "完成率"];
    sheet.getRange(2, startCol, 1, 6).setValues([headers]);
    sheet.getRange(2, startCol, 1, 6).setFontWeight("bold").setBackground("#F3F4F6").setHorizontalAlignment("center");
    
    let categories = Object.keys(stats);
    if (mode === "dept") categories.sort(); 
    else categories.sort((a, b) => stats[b].total - stats[a].total);
    
    let rowIdx = 3;
    let t=0, c=0, p=0, n=0;
    categories.forEach(cat => {
        const s = stats[cat];
        const validTotal = s.completed + s.inProgress;
        const rate = validTotal > 0 ? Math.round((s.completed / validTotal) * 100) + "%" : "0%";
        sheet.getRange(rowIdx, startCol, 1, 6).setValues([[cat, s.total, s.completed, s.inProgress, s.notStarted, rate]]);
        t += s.total; c += s.completed; p += s.inProgress; n += s.notStarted;
        rowIdx++;
    });

    const validTotalSum = c + p;
    const overallRate = validTotalSum > 0 ? Math.round((c / validTotalSum) * 100) + "%" : "0%";
    sheet.getRange(rowIdx, startCol, 1, 6).setValues([["總計", t, c, p, n, overallRate]]);
    sheet.getRange(rowIdx, startCol, 1, 6).setFontWeight("bold").setBackground("#E8F5E9");

    const count = categories.length;

    if (count > 0) {
        const barRange = sheet.getRange(3, startCol, count, 2); 
        
        const chart1 = sheet.newChart()
            .setChartType(Charts.ChartType.BAR)
            .addRange(barRange)
            .setPosition(rowIdx + 2, startCol, 0, 0)
            .setOption('title', `${reportTitle}分布`)
            .setOption('legend', {position: 'none'})
            .setOption('colors', [primaryColor])
            .setOption('hAxis', { minValue: 0, format: '0' })
            .setOption('width', 800)
            .setOption('height', 500)
            .setOption('chartArea', {left: '25%', top: '10%', width: '70%', height: '80%'})
            .setOption('vAxis', {textStyle: {fontSize: 12}})
            .build();
        sheet.insertChart(chart1);
    }

    const pieHeaderRow = rowIdx + 25; 
    sheet.getRange(pieHeaderRow, startCol).setValue("狀態");
    sheet.getRange(pieHeaderRow, startCol+1).setValue("數量");
    sheet.getRange(pieHeaderRow+1, startCol, 3, 2).setValues([
        ["已完成", c], ["處理中", p], ["未開始", n]
    ]);
    sheet.getRange(pieHeaderRow, startCol, 4, 2).setFontColor("white");

    const chart2 = sheet.newChart()
        .setChartType(Charts.ChartType.PIE)
        .addRange(sheet.getRange(pieHeaderRow + 1, startCol, 3, 2))
        .setPosition(3, startCol + 2, 0, 0)
        .setOption('title', `整體狀態`)
        .setOption('pieSliceText', 'value')
        .setOption('colors', [primaryColor, '#2196F3', '#9E9E9E'])
        .setOption('width', 600)
        .setOption('height', 450)
        .setOption('chartArea', {left: '10%', top: '15%', width: '90%', height: '80%'})
        .build();
    sheet.insertChart(chart2);
}

function getOrInitCacheSS() {
  const props = PropertiesService.getScriptProperties();
  const CONFIG = getConfig();
  let cacheId = props.getProperty(PROPERTY_KEYS.GUI_CACHE_SS_ID);
  let ss;
  if (cacheId) {
    try { ss = SpreadsheetApp.openById(cacheId); return ss; } catch (e) {}
  }
  ss = SpreadsheetApp.create("System_Analysis_Cache (Do Not Delete)");
  props.setProperty(PROPERTY_KEYS.GUI_CACHE_SS_ID, ss.getId());
  return ss;
}

function formatDate(dateObj) {
  if (!dateObj || dateObj === "") return "";
  if (typeof dateObj === 'string') return dateObj;
  try { return Utilities.formatDate(dateObj, "Asia/Taipei", "yyyy/MM/dd"); } catch (e) { return String(dateObj); }
}

// ==========================================
// 🚀 Global HUD 遙測引擎 (v6.7 UUID Patch)
// ==========================================

function apiGetGlobalSummary() {
  const sources = readConfig();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, "Asia/Taipei", "yyyy/MM/dd");

  let payload = {
    kpi: { todayNew: 0, todayDone: 0, pendingTotal: 0 },
    stream: [],
    pending: []
  };

  const getScore = (s) => {
    if (s.includes("待確認") || s.includes("?")) return 4;
    if (s.includes("處理中") || s.includes("➤")) return 3;
    if (s.includes("待處理") || s.includes("○")) return 2;
    if (s.includes("暫停") || s.includes("‖")) return 1;
    return 0;
  };

  sources.forEach(src => {
    try {
      const logDao = getLogEntryDAO(src);
      const sheet = logDao.getSheet();
      if (!sheet || sheet.getLastRow() < 2) return;

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      // Read all data to ensure pendingTotal is accurate
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

      const findCol = (candidates) => {
        for (const candidate of candidates) {
           const idx = headers.findIndex(h => String(h).trim().includes(candidate));
           if (idx !== -1) return idx;
        }
        return -1;
      };

      const dateIdx = findCol(["新增日期"]);
      const statusIdx = findCol(["狀態"]);
      const itemIdx = findCol(["項目", "需求類型", "報修項目"]);
      const progressIdx = findCol(["處理進度", "處理進度簡述"]);
      const updatedIdx = findCol(["最後更新時間", "更新時間"]);
      const uuidIdx = findCol(["UUID", "System_ID"]);
      const categoryIdx = findCol(["報修項目", "需求類型", "子項目", "分類"]);
      const deptIdx = findCol(["報修單位(組)", "需求單位(組)", "單位(組)", "報修單位", "需求單位"]);

      if (dateIdx === -1 || statusIdx === -1) return;

      let tagColor = "secondary";
      if (src.name.includes("需求")) tagColor = "purple";
      else if (src.name.includes("資訊") || src.name.includes("報修")) tagColor = "blue";
      else if (src.name.includes("工作")) tagColor = "green";

      data.forEach((row, rIdx) => {
        const rawItem = itemIdx > -1 ? row[itemIdx] : "";
        if (!rawItem || String(rawItem).trim() === "") return;

        const rowDateStr = row[dateIdx] ? formatDate(row[dateIdx]) : "";
        const updatedDateStr = (updatedIdx > -1 && row[updatedIdx]) ? formatDate(row[updatedIdx]) : "";
        const uuid = uuidIdx > -1 ? String(row[uuidIdx]) : "";

        const status = String(row[statusIdx]).trim();
        const item = String(rawItem).trim();
        const progress = progressIdx > -1 ? row[progressIdx] : "";
        const category = categoryIdx > -1 ? row[categoryIdx] : "";
        const dept = deptIdx > -1 ? row[deptIdx] : "";
        const deepLink = `${sheet.getParent().getUrl()}#gid=${sheet.getSheetId()}&range=${2 + rIdx}:${2 + rIdx}`; // Use 2 + rIdx for absolute row

        const isCompletedOrCancelled = status.includes("完成") || status.includes("✔") || status.includes("取消") || status.includes("✖");
        const isNotDone = !isCompletedOrCancelled;
        const isCompletedOnly = status.includes("完成") || status.includes("✔");

        const isToday = (rowDateStr === todayStr);
        const isUpdatedToday = (updatedDateStr === todayStr);

        // --- KPI Calculation (FIXED LOGIC) ---
        // 1. New cases today
        if (isToday) {
          payload.kpi.todayNew++;
        }
        // 2. Completed cases today (based on update time)
        if (isCompletedOnly && isUpdatedToday) {
          payload.kpi.todayDone++;
        }
        // 3. Total pending (globally, not just from the last 500 rows)
        if (isNotDone) {
          payload.kpi.pendingTotal++;
        }

        // --- Stream (Today's Activity) ---
        // Show if: created today OR completed today
        if (isToday || (isCompletedOnly && isUpdatedToday)) {
           payload.stream.push({
             id: 2 + rIdx,
             uuid: uuid,
             source: src.name,
             tagColor: tagColor,
             date: rowDateStr,
             item: item,
             progress: progress,
             status: status,
             category: category,
             dept: dept,
             isCompleted: isCompletedOnly,
             link: deepLink
           });
        }

        // --- Pending (All outstanding tasks) ---
        if (isNotDone) {
           payload.pending.push({
             id: 2 + rIdx,
             uuid: uuid,
             source: src.name,
             tagColor: tagColor,
             date: rowDateStr,
             item: item,
             progress: progress,
             status: status,
             category: category,
             dept: dept,
             link: deepLink
           });
        }
      });

    } catch (e) {
      Logger.log(`Source Error ${src.name}: ${e.message}`);
    }
  });

  // Sort and Slice after all data is processed
  payload.stream.sort((a, b) => b.id - a.id);
  payload.pending.sort((a, b) => {
     const scoreA = getScore(a.status);
     const scoreB = getScore(b.status);
     if (scoreA !== scoreB) return scoreB - scoreA;
     return b.date.localeCompare(a.date);
  });
  
  // Apply limit after sorting
  payload.stream = payload.stream.slice(0, 50);
  payload.pending = payload.pending.slice(0, 50);

  return payload;
}

/**
 * @summary Fetches and aggregates log data for a trend chart.
 * @param {object} dateRange - Object with startDate and endDate in 'yyyy/MM/dd' format.
 * @returns {object} Data structured for Chart.js (labels, datasets).
 */
function apiGetTrendData(payload) {
 const { startDate, endDate, sourceName } = payload;
 if (!startDate || !endDate) {
   throw new Error("Date range is required.");
 }

 const start = new Date(startDate);
 const end = new Date(endDate);
 end.setHours(23, 59, 59, 999);

 // --- Step 1: Efficiently fetch all relevant data in one go ---
 const allLogs = getCombinedLogData(start, end, sourceName);

 // --- Step 2: Initialize the data structure for the chart ---
  const trendData = {};
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = Utilities.formatDate(d, "Asia/Taipei", "yyyy/MM/dd");
    trendData[dateStr] = { new: 0, done: 0, cancelled: 0, pending: 0 };
  }

  // --- Step 3: Aggregate data in memory ---
  allLogs.forEach(log => {
    // Increment 'new' count on creation date
    if (log.createDate && trendData[log.createDate]) {
      trendData[log.createDate].new++;
    }
    // Increment 'done' count on completion date
    if (log.isCompleted && log.completionDate && trendData[log.completionDate]) {
      trendData[log.completionDate].done++;
    }
    // Increment 'cancelled' count on cancellation date
    if (log.isCancelled && log.cancellationDate && trendData[log.cancellationDate]) {
      trendData[log.cancellationDate].cancelled++;
    }
  });

  // --- Step 4: Calculate the pending trend ---
  // To get an accurate pending count, we need the total pending count *before* the start date.
  const initialPending = getInitialPendingCount(start, sourceName);
  let pendingCount = initialPending;
  const sortedDates = Object.keys(trendData).sort((a, b) => new Date(a) - new Date(b));

  sortedDates.forEach(dateStr => {
    const dailyNew = trendData[dateStr].new;
    const dailyDone = trendData[dateStr].done;
    const dailyCancelled = trendData[dateStr].cancelled;
    pendingCount += dailyNew - dailyDone - dailyCancelled;
    trendData[dateStr].pending = Math.max(0, pendingCount); // Prevent negative pending counts
  });

  // --- Step 5: Format data for Chart.js ---
  return {
    labels: sortedDates,
    datasets: [
      {
        label: '新增',
        data: sortedDates.map(date => trendData[date].new),
        borderColor: '#0d6efd',
        tension: 0.1,
        fill: false,
      },
      {
        label: '完成',
        data: sortedDates.map(date => trendData[date].done),
        borderColor: '#198754',
        tension: 0.1,
        fill: false,
      },
      {
        label: '待處理 (趨勢)',
        data: sortedDates.map(date => trendData[date].pending),
        borderColor: '#dc3545',
        tension: 0.1,
        fill: false,
      },
      {
        label: '取消',
        data: sortedDates.map(date => trendData[date].cancelled),
        borderColor: '#6c757d',
        tension: 0.1,
        fill: false,
      }
    ]
  };
}

/**
 * @summary Fetches and combines log data from all sources within a date range.
 * This is the core optimization to reduce Sheet API calls.
 */
function getCombinedLogData(start, end, sourceName = '_ALL_') {
 let sources = readConfig();
 if (sourceName && sourceName !== '_ALL_') {
   sources = sources.filter(s => s.name === sourceName);
 }
 let combinedLogs = [];

 sources.forEach(src => {
    try {
      const logDao = getLogEntryDAO(src);
      const sheet = logDao.getSheet();
      if (!sheet || sheet.getLastRow() < 2) return;

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

      const findCol = (candidates) => {
        for (const candidate of candidates) {
           const idx = headers.findIndex(h => String(h).trim().includes(candidate));
           if (idx !== -1) return idx;
        }
        return -1;
      };

      const dateIdx = findCol(["新增日期", "新增日", "日期"]);
      const statusIdx = findCol(["狀態"]);
      const updatedIdx = findCol(["最後更新時間"]);

      if (dateIdx === -1 || statusIdx === -1) return;

      data.forEach(row => {
        const createDateVal = row[dateIdx];
        if (!createDateVal) return;
        
        const createDate = new Date(createDateVal);
        const updateDateVal = updatedIdx > -1 ? row[updatedIdx] : null;
        const updateDate = updateDateVal ? new Date(updateDateVal) : null;

        // Include the log if either its creation or update date is in range
        if ((createDate >= start && createDate <= end) || (updateDate && updateDate >= start && updateDate <= end)) {
          const status = String(row[statusIdx]).trim();
          const isCompleted = status.includes("完成") || status.includes("✔");
          const isCancelled = status.includes("取消") || status.includes("✖");

          const createDateStr = formatDate(createDate);
          let completionDateStr = null;
          let cancellationDateStr = null;

          if (isCompleted) {
            completionDateStr = updateDate ? formatDate(updateDate) : createDateStr;
          }
          if (isCancelled) {
            cancellationDateStr = updateDate ? formatDate(updateDate) : createDateStr;
          }

          combinedLogs.push({
            createDate: createDateStr,
            completionDate: completionDateStr,
            cancellationDate: cancellationDateStr,
            isCompleted: isCompleted,
            isCancelled: isCancelled,
          });
        }
      });
    } catch (e) {
      Logger.log(`Error in getCombinedLogData for ${src.name}: ${e.message}`);
    }
  });
  return combinedLogs;
}


/**
 * @summary Calculates the total number of pending tasks before a given start date.
 * This is crucial for establishing an accurate starting point for the trend chart.
 */
function getInitialPendingCount(startDate, sourceName = '_ALL_') {
   let sources = readConfig();
   if (sourceName && sourceName !== '_ALL_') {
     sources = sources.filter(s => s.name === sourceName);
   }
   let totalPending = 0;

    sources.forEach(src => {
        try {
            const logDao = getLogEntryDAO(src);
            const sheet = logDao.getSheet();
            if (!sheet || sheet.getLastRow() < 2) return;

            const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
            
            const findCol = (candidates) => headers.findIndex(h => candidates.some(c => String(h).trim().includes(c)));
            
            const dateIdx = findCol(["新增日期", "新增日", "日期"]);
            const statusIdx = findCol(["狀態"]);
            const updatedIdx = findCol(["最後更新時間"]); // Required for time machine logic

            if (dateIdx === -1 || statusIdx === -1) {
              Logger.log(`  - Skipping source ${src.name} due to missing date/status columns.`);
              return;
            }

            data.forEach(row => {
                const createDateVal = row[dateIdx];
                if (!createDateVal) return;

                const createDate = new Date(createDateVal);
                if (createDate >= startDate) return; // Skip entries created on or after the chart's start date

                const status = String(row[statusIdx]).trim();
                const isClosed = status.includes("完成") || status.includes("✔") || status.includes("取消") || status.includes("✖");
                
                if (!isClosed) {
                    // This was pending at some point. But was it closed *before* the startDate?
                    totalPending++;
                } else {
                    // It's closed. We need to check *when* it was closed.
                    const updateDateVal = updatedIdx > -1 ? row[updatedIdx] : null;
                    if (updateDateVal) {
                        const updateDate = new Date(updateDateVal);
                        // If the closing date is ON or AFTER the chart starts, it means
                        // it was still pending right before the chart began.
                        if (updateDate >= startDate) {
                            totalPending++;
                        }
                    }
                }
            });
        } catch (e) {
            Logger.log(`Error in getInitialPendingCount for ${src.name}: ${e.message}`);
        }
    });
    return totalPending;
}