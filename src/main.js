/***********************
 *  主設定檔與工具函式
 ***********************/
 
/**
 * 引入配置管理器和 DAO
 */
// 假設 config.js 和 dao.js 已經被包含 (GAS 自動處理)

// ==================== 設定檔讀取 ====================

/**
 * 讀取設定檔，返回啟用的資料來源清單
 */
function readConfig() {
  const configDao = getMainConfigDAO();
  return configDao.readSourceList();
}

/**
 * 解析輸出欄位設定
 * @param {string} colStr - 欄位設定字串
 * @return {Array|null} 數字陣列、文字陣列或 null（全部欄位）
 * 
 * 支援格式：
 * - "0,1,2,3" → [0, 1, 2, 3] (數字索引)
 * - "更新,狀態,項目" → ["更新", "狀態", "項目"] (欄位名稱)
 * - 空白 → null (全部欄位)
 */
function parseOutputColumns(colStr) {
  if (!colStr || String(colStr).trim() === "") {
    return null;
  }
  
  const parts = String(colStr).trim()
    .split(",")
    .map(s => s.trim())
    .filter(s => s);
  
  if (parts.length === 0) return null;
  
  // 判斷格式：數字索引 or 欄位名稱
  return /^\d+$/.test(parts[0]) 
    ? parts.map(p => parseInt(p, 10))  // 數字格式
    : parts;                            // 文字格式
}

/**
 * 依設定篩選欄位
 * @param {Array} headers - 原始表頭
 * @param {Array} rows - 原始資料列
 * @param {Array|null} outputColumns - 輸出欄位設定
 * @return {Object} { headers, rows } - 篩選後的表頭與資料
 */
function filterColumnsByConfig(headers, rows, outputColumns) {
  if (!outputColumns || outputColumns.length === 0) {
    return { headers, rows };
  }
  
  let colIndices = [];
  
  if (typeof outputColumns[0] === "number") {
    // 數字索引：直接使用
    colIndices = outputColumns;
  } else {
    // 欄位名稱：轉換為索引
    const headerMap = headers.map(h => String(h || "").trim());
    outputColumns.forEach(colName => {
      const idx = headerMap.indexOf(String(colName).trim());
      if (idx !== -1) colIndices.push(idx);
    });
  }
  
  // 篩選表頭與資料
  const filteredHeaders = colIndices.map(i => headers[i]);
  const filteredRows = rows.map(row => colIndices.map(i => row[i]));
  
  return { 
    headers: filteredHeaders, 
    rows: filteredRows 
  };
}

// ==================== 郵件設定讀取 ====================

/**
 * 讀取郵件設定
 * @return {Object} { to, cc, bcc, senderName } - 收件人資訊與寄件者名稱
 * 
 * 設定格式（第一列為標題，第二列為資料）：
 * A: recipient (主收件人)
 * B: cc (副本，可多個用逗號分隔)
 * C: senderName (寄件者名稱)
 */
function readMailSettings() {
  const configDao = getMainConfigDAO();
  const settings = configDao.readMailSettings();

  if (!settings) {
    Logger.log("⚠️ 找不到 Email Settings 工作表，使用預設收件人");
    return getDefaultMailSettings();
  }

  return {
    to: settings.to || "itadmin@grandbanyanhotel.com",
    cc: settings.cc,
    bcc: null,  // 如需 BCC，可在 D 欄新增
    senderName: settings.senderName || "資訊部日報系統"
  };

  // Note: 錯誤處理已移至 DAO 內部
}

/**
 * 解析郵件地址（支援多個，用逗號分隔）
 */
function parseEmails(str) {
  if (!str) return null;
  const emails = str.split(",").map(e => e.trim()).filter(e => e);
  return emails.length > 0 ? emails.join(",") : null;
}

/**
 * 取得預設郵件設定
 */
function getDefaultMailSettings() {
  return {
    to: "itadmin@grandbanyanhotel.com",
    cc: null,
    bcc: null,
    senderName: "資訊部日報系統"
  };
}

// ==================== 日期工具函式 ====================

/**
 * 格式化日期值
 * @param {*} val - 日期值
 * @param {string} mode - 顯示模式："title" | "table" | "default"
 * @return {string} 格式化後的日期字串
 */
function formatDateValue(val, mode = "default") {
  if (!(val instanceof Date)) {
    return String(val || "");
  }

  switch (mode) {
    case "title":
      return Utilities.formatDate(val, "Asia/Taipei", "yyyy/MM/dd");
      
    case "table":
      const dateStr = Utilities.formatDate(val, "Asia/Taipei", "MM/dd");
      const weekDay = ["日","一","二","三","四","五","六"][val.getDay()];
      return `${dateStr} (${weekDay})`;
      
    default:
      return Utilities.formatDate(val, "Asia/Taipei", "yyyy/MM/dd");
  }
}

/**
 * 取得今日日期字串（含星期）
 * @return {string} 例如："2025/09/29 星期一"
 */
function formatTodayWithWeek() {
  const d = new Date();
  const weekDay = ["日","一","二","三","四","五","六"][d.getDay()];
  const dateStr = Utilities.formatDate(d, "Asia/Taipei", "yyyy/MM/dd");
  return `${dateStr} 星期${weekDay}`;
}

/**
 * 取得今日日期字串（簡化版）
 * @param {string} fmt - 日期格式，預設 "yyyy/MM/dd"
 * @return {string} 格式化的日期
 */
function formatToday(fmt = "yyyy/MM/dd") {
  return Utilities.formatDate(new Date(), "Asia/Taipei", fmt);
}

// ==================== 測試函式 ====================

/**
 * 測試設定讀取功能
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
 * 測試郵件設定讀取
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
