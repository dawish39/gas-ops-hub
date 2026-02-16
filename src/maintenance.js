// ==========================================
// 🛠️ UUID 維護工具 (New)
// ==========================================

/**
 * [Read-Only] 檢查所有資料來源是否缺少 UUID
 * (不影響原有的分類檢查邏輯)
 */
function 測試_檢查UUID狀態() {
  const sources = readConfig();
  let report = [];
  let totalMissing = 0;

  sources.forEach(src => {
    try {
      const logDao = getLogEntryDAO(src);
      const sheet = logDao.getSheet();
      
      // if (!sheet) return; // Handled by logDao.getSheet() throwing error

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        report.push(`[${src.name}] 無資料`);
        return;
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const uuidIdx = headers.indexOf("UUID"); // 搜尋欄位名稱

      if (uuidIdx === -1) {
        report.push(`[${src.name}] ❌ 尚未建立 UUID 欄位 (將於補填時自動建立)\n`);
        totalMissing += (lastRow - 1);
      } else {
        // 讀取該欄位所有資料
        // 注意：這裡只讀取 UUID 這一欄，效能較好
        const uuids = sheet.getRange(2, uuidIdx + 1, lastRow - 1, 1).getValues();
        const missingCount = uuids.filter(r => r[0] === "").length;
        if (missingCount > 0) {
          report.push(`[${src.name}] ⚠️ 缺少 ${missingCount} 筆 UUID\n`);
          totalMissing += missingCount;
        } else {
          report.push(`[${src.name}] ✅ UUID 完整\n`);
        }
      }
    } catch (e) {
      report.push(`[${src.name}] 讀取錯誤: ${e.message}`);
    }
  });

  return report.join("\n") + (totalMissing > 0 ? `\n\n建議執行「補填遺失 UUID」指令。` : `\n\n所有資料皆已有唯一識別碼。`);
}

/**
 * [Write] 批次生成並回填 UUID (Schema Migration)
 * 策略：鎖定 -> 檢查/建立欄位 -> 填補空值 -> 解鎖
 */
function 測試_補填UUID() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return "系統忙碌中 (Locked)，請稍後再試";
  }

  let log = [];
  let processCount = 0;
  const BATCH_LIMIT = 500; 

  try {
    const sources = readConfig();

    for (const src of sources) {
      if (processCount >= BATCH_LIMIT) break;

      const logDao = getLogEntryDAO(src);
      const sheet = logDao.getSheet();
      // if (!sheet) continue; // Handled by logDao.getSheet() throwing error

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) continue;

      // 1. 檢查並擴充欄位
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      let uuidIdx = headers.indexOf("UUID");

      if (uuidIdx === -1) {
        // 建立新欄位在最後
        const newCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, newCol).setValue("UUID");
        sheet.getRange(1, newCol).setBackground("#E8EAF6"); // 標記顏色
        uuidIdx = newCol - 1;
        log.push(`[${src.name}] 建立新欄位 UUID`);
        SpreadsheetApp.flush();
      }

      // 2. 讀取與回填
      const dataRange = sheet.getRange(2, uuidIdx + 1, lastRow - 1, 1);
      const values = dataRange.getValues();
      let hasChange = false;

      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === "") {
          values[i][0] = Utilities.getUuid();
          hasChange = true;
          processCount++;
        }
        if (processCount >= BATCH_LIMIT) break;
      }

      if (hasChange) {
        dataRange.setValues(values);
        log.push(`[${src.name}] 已生成 ${processCount} 筆 UUID`);
      }
    }

  } catch (e) {
    return `執行失敗: ${e.message}`;
  } finally {
    lock.releaseLock();
  }

  if (processCount === 0) return "✅ 所有資料皆已有 UUID。";
  if (processCount >= BATCH_LIMIT) return `⚠️ 已處理 ${processCount} 筆 (達到單次上限)。請再次點擊按鈕以繼續處理。`;
  
  return `✅ 執行完成\n${log.join("\n")}`;
}
