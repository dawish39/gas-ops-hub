// ──────────────── 主流程觸發器 ────────────────

// 建立觸發器
function setupTriggers() {
  // 先清掉舊的時間驅動觸發器
  const allTriggers = ScriptApp.getProjectTriggers();
  for (const t of allTriggers) {
    if (["generateReport", "sendReport", "dailyJob"].includes(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  }

  // 每天 16:50 執行合併流程
  ScriptApp.newTrigger("dailyJob")
    .timeBased()
    .atHour(16)      // 24 小時制
    .nearMinute(50)  // 大約 16:50 ±5 分鐘
    .everyDays(1)
    .create();
}

// 合併流程：先產生報表，再寄送
function dailyJob() {
  try {
    generateReport();        // 先建立報表 (會更新 ScriptProperties.LAST_REPORT_ID)
    Utilities.sleep(5000);   // 延遲 5 秒，確保檔案完成
    sendReport();            // 再呼叫寄送
  } catch (e) {
    Logger.log("dailyJob 執行錯誤：" + e.message);
  }
}

// 查看目前觸發器
function listTriggers() {
  const allTriggers = ScriptApp.getProjectTriggers();
  allTriggers.forEach(t => {
    Logger.log(`${t.getHandlerFunction()} @ ${t.getTriggerSource()} (${t.getUniqueId()})`);
  });
}

// 清除所有觸發器（除錯時用）
function clearTriggers() {
  const allTriggers = ScriptApp.getProjectTriggers();
  allTriggers.forEach(t => ScriptApp.deleteTrigger(t));
}


// ──────────────── Web GUI 性能優化觸發器 ────────────────

/**
 * [性能優化] 預熱快取任務 (Warm-up Cache Job)
 * 作用：清除舊快取並強制重新計算儀表板數據。
 */
function warmUpCacheJob() {
  try {
    // 1. 清除舊快取
    clearDashboardCache(); 
    Logger.log("✅ Dashboard 快取已清除。");
    
    // 2. 強制重新生成數據並寫入快取
    apiGetGlobalSummary();
    Logger.log("✅ Dashboard 數據已重新生成並寫入快取。");
    
  } catch (e) {
    Logger.log(`❌ 快取預熱失敗: ${e.message}`);
  }
}

/**
 * [性能優化] 設置儀表板預熱觸發器
 * 設置每 5 分鐘執行的時間驅動觸發器。
 * 執行前會清除舊的 warmUpCacheJob 觸發器。
 */
function setupPerformanceTriggers() {
  // 清除舊的預熱觸發器
  const allTriggers = ScriptApp.getProjectTriggers();
  for (const t of allTriggers) {
    if (t.getHandlerFunction() === "warmUpCacheJob") {
      ScriptApp.deleteTrigger(t);
      Logger.log(`🗑️ 已清除舊的 warmUpCacheJob 觸發器 (${t.getUniqueId()})`);
    }
  }

  // 設置新的每 5 分鐘觸發器
  ScriptApp.newTrigger("warmUpCacheJob")
    .timeBased()
    .everyMinutes(5)
    .create();
    
  Logger.log("✅ Web GUI 性能預熱觸發器已設置，每 5 分鐘執行一次 warmUpCacheJob。");
}
