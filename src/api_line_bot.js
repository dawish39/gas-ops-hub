/**
 * api_line_bot.gs
 * v6.3 Ingress Node (Lite Edition)
 * (Feature: 純文字儀表板連結 + 並發控制 + 資安防護)
 */

// ==========================================
// ⚙️ [系統設定區]
// ==========================================

// 1. 允許使用此 Bot 的 Line User ID (從指令碼屬性讀取)
function getAllowedUsers_() {
  const properties = PropertiesService.getScriptProperties();
  const allowedUsersStr = properties.getProperty("LINE_ALLOWED_USERS");
  if (!allowedUsersStr) {
    // 如果未設定屬性，可以返回一個空陣列或包含預設管理員的陣列
    return [];
  }
  // 分割字串並清除每個 ID 周圍的空白
  return allowedUsersStr.split(",").map(id => id.trim());
}

// ==========================================
// 🌐 Webhook 入口
// ==========================================

function doGet(e) {
  return ContentService.createTextOutput("✅ Line Bot Gateway v6.3 (Lite) is Active.");
}

function doPost(e) {
  const output = ContentService.createTextOutput(JSON.stringify({status: "success"}))
    .setMimeType(ContentService.MimeType.JSON);

  try {
    if (!e || !e.postData) return output;
    const jsonBody = JSON.parse(e.postData.contents);
    const events = jsonBody.events;
    if (!events || events.length === 0) return output;

    for (const event of events) {
      if (event.replyToken === "00000000000000000000000000000000" || event.type === "unfollow") continue;

      if (event.type === "message" && event.message.type === "text") {
        processUserMessage(event.message.text, event.replyToken, event.source.userId);
      }
    }
  } catch (err) {
    Logger.log("❌ Webhook Error: " + err.message);
  }
  return output;
}

// ==========================================
// 🧠 核心邏輯控制器
// ==========================================

function processUserMessage(msg, replyToken, userId) {
  try {
    // 🛡️ [資安] 白名單檢查
    const ALLOWED_USERS = getAllowedUsers_();
    if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(userId)) {
      replyToLine(replyToken, "⛔ 抱歉，您沒有權限使用此系統。\nID: " + userId);
      return; 
    }

    let cleanMsg = msg.trim();

    // -----------------------------------------------------------
    // 🚀 [Route 1] 儀表板入口 (Dashboard Link)
    // -----------------------------------------------------------
    if (cleanMsg.match(/^(儀表板|看板|dash|dashboard|d|D)$/i)) {
      const CONFIG = getConfig();
      const WEB_APP_URL = CONFIG.get("WEB_APP_URL"); // 假設未來會加入 config.js
      
      if (!WEB_APP_URL || WEB_APP_URL.includes("PLACEHOLDER")) {
         replyToLine(replyToken, "⚠️ 尚未設定 Web App URL，請聯繫管理員。");
         return;
      }

      // 直接回傳純文字連結，確保最高相容性
      const replyMsg = `📊 IT 日報儀表板\n${WEB_APP_URL}`;
      replyToLine(replyToken, replyMsg);
      return; 
    }

    // -----------------------------------------------------------
    // ℹ️ [Route 2] Help 介面 (已更新)
    // -----------------------------------------------------------
    if (cleanMsg.match(/^(help|說明|指令|menu|\?|？)$/i)) {
      const helpText = 
        `🤖 資訊小幫手 v6.3\n` +
        `━━━━━━━━━━\n` +
        `📊 儀表板\n   輸入「儀表板」或「dash」取得連結\n` +
        `━━━━━━━━━━\n` +
        `1️⃣ 一般報修\n   直接輸入狀況描述\n` +
        `2️⃣ 資訊日報\n   先輸入「日報」\n` +
        `3️⃣ 部門需求\n   先輸入「需求」\n`;
      replyToLine(replyToken, helpText);
      return; 
    }

    // -----------------------------------------------------------
    // 📝 [Route 3] 資料寫入路由
    // -----------------------------------------------------------
    let targetMode = "repair"; 
    let displayPrefix = "";

    if (cleanMsg.match(/^(日報|info|daily)/i)) {
      targetMode = "daily";
      cleanMsg = cleanMsg.replace(/^(日報|info|daily)\s*/i, ""); 
      displayPrefix = "[日報]";
    } else if (cleanMsg.match(/^(需求|need|needs)/i)) {
      targetMode = "needs";
      cleanMsg = cleanMsg.replace(/^(需求|need|needs)\s*/i, "");
      displayPrefix = "[需求]";
    } else {
      targetMode = "repair";
      displayPrefix = "[報修]";
    }

    if (cleanMsg === "") {
      replyToLine(replyToken, "⚠️ 請輸入內容，或輸入「?」查看說明。");
      return;
    }

    // AI 解析 (假設外部有實作 callGeminiParser，若無可略過)
    const aiResult = callGeminiParser(cleanMsg);
    
    // 寫入資料庫
    const writeResult = writeToWorkLogSheet(aiResult, true, targetMode);
    
    const replyMsg = `✅ ${displayPrefix} 紀錄成功\n\n` +
                     `📄 項目：${writeResult.item}\n` +
                     `🔧 進度：${writeResult.progress}\n` +
                     `🚩 狀態：${writeResult.status}`;
    replyToLine(replyToken, replyMsg);

  } catch (e) {
    Logger.log("處理失敗: " + e.message);
    replyToLine(replyToken, `⚠️ 系統錯誤：${e.message}`);
  }
}

// ==========================================
// 💾 資料庫寫入 (DAO) - v6.6 Fix
// ==========================================

function writeToWorkLogSheet(data, isAuto, targetMode) {
  var lock = LockService.getScriptLock();
  try {
    // 等待鎖的時間稍微縮短，避免卡死太久
    lock.waitLock(10000); 

    const sources = readConfig(); 
    let targetSrc = null;

    // 來源匹配邏輯
    const matchSource = (s, keywords) => {
      const combined = `${s.type || ''} ${s.name || ''} ${s.sheet || ''}`.toLowerCase();
      return keywords.some(k => combined.includes(k));
    };

    if (targetMode === "daily") {
      targetSrc = sources.find(s => matchSource(s, ["project", "daily", "資訊", "工作"]));
    } else if (targetMode === "needs") {
      targetSrc = sources.find(s => matchSource(s, ["needs", "need", "需求"]));
    } else {
      targetSrc = sources.find(s => matchSource(s, ["repair", "log", "報修"]));
    }

    if (!targetSrc) targetSrc = sources[0];
    
    // 使用 LogEntryDAO 取得 sheet 實例
    const logDao = getLogEntryDAO(targetSrc);
    const sheet = logDao.getSheet();

    const now = new Date();
    const dateStr = Utilities.formatDate(now, "Asia/Taipei", "yyyy/MM/dd");
    const lastModValue = now; 
    
    let finalItem = data.item;
    if (isAuto && !finalItem.startsWith("[自]")) {
      finalItem = `[自] ${finalItem}`;
    }

    // 取得標題列與索引映射
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const hMap = headers.map(h => String(h).trim());
    
    const idx = {
      status:   hMap.indexOf("狀態"),
      date:     hMap.indexOf("新增日期"),
      item:     hMap.indexOf("項目"),
      progress: hMap.indexOf("處理進度簡述"), 
      lastMod:  hMap.indexOf("最後更新時間"),
      uuid:     hMap.indexOf("UUID") 
    };
    
    if (idx.progress === -1) idx.progress = hMap.indexOf("處理進度");
    if (idx.item === -1) throw new Error(`目標表 ${targetSrc.name} 缺少『項目』欄位`);

    const lastRow = sheet.getLastRow();
    let targetRow = -1;

    // 1. 優先尋找現有的空白列 (填補坑洞)
    if (lastRow >= 2) {
      // 只讀取「項目」欄位來判斷是否為空，效能較好
      const itemColValues = sheet.getRange(2, idx.item + 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < itemColValues.length; i++) {
        if (itemColValues[i][0] === "") {
          targetRow = i + 2; 
          break; 
        }
      }
    }

    // 2. 如果沒洞可補，則新增一列
    if (targetRow === -1) {
      sheet.insertRowAfter(lastRow);
      targetRow = lastRow + 1;
      
      // 🟢 [關鍵修正 1] 強制刷新：確保 Google Sheet 真的把那一行生出來了
      SpreadsheetApp.flush(); 

      try {
        // 複製上一列的格式 (Borders, Colors)
        const sourceRange = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn());
        sourceRange.copyTo(sheet.getRange(targetRow, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        
        // 🟢 [關鍵修正 2] 複製完格式後，清除「資料驗證 (Dropdown)」
        // 避免上一行的嚴格下拉選單擋住我們即將寫入的資料
        // sheet.getRange(targetRow, 1, 1, sheet.getLastColumn()).clearDataValidations();
      } catch (err) {
        Logger.log("複製格式失敗 (不影響寫入): " + err);
      }
    }
    
    const sanitize = (input) => {
      if (typeof input !== 'string') return input;
      if (input.match(/^[=+\-@]/)) return "'" + input;
      return input;
    };
    
    // 3. 執行寫入
    if (idx.status !== -1)   sheet.getRange(targetRow, idx.status + 1).setValue(sanitize(data.status));
    if (idx.date !== -1)     sheet.getRange(targetRow, idx.date + 1).setValue(dateStr);
    if (idx.item !== -1)     sheet.getRange(targetRow, idx.item + 1).setValue(sanitize(finalItem));
    if (idx.progress !== -1) sheet.getRange(targetRow, idx.progress + 1).setValue(sanitize(data.progress));
    if (idx.lastMod !== -1)  sheet.getRange(targetRow, idx.lastMod + 1).setValue(lastModValue);

    // 寫入 UUID
    if (idx.uuid !== -1) {
      sheet.getRange(targetRow, idx.uuid + 1).setValue(Utilities.getUuid());
    }
    
    // 🟢 [關鍵修正 3] 寫完後再次刷新，確保資料落地
    SpreadsheetApp.flush();

    return { ...data, item: finalItem };

  } catch (e) {
    Logger.log("❌ 寫入失敗: " + e.message);
    throw e; 
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 📡 Line 通訊模組 (純文字版)
// ==========================================

function replyToLine(replyToken, text) {
  const LINE_TOKEN_QT = getConfig().get("LINE_CHANNEL_ACCESS_TOKEN"); // 假設未來會加入 config.js

  if (!LINE_TOKEN_QT) return;
  const url = "https://api.line.me/v2/bot/message/reply";
  const payload = { 
    replyToken: replyToken, 
    messages: [{ type: "text", text: text }] 
  };
  
  try {
    UrlFetchApp.fetch(url, {
      method: "post",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + LINE_TOKEN_QT },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) { 
    Logger.log("Line Send Error: " + e.message); 
  }
}
