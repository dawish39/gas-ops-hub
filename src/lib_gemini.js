/**
 * lib_gemini.gs
 * v3.0 AI 核心模組 - 負責將自然語言轉換為結構化 JSON
 * * @author Tech Lead (AI)
 */

const GEMINI_MODEL = "gemini-2.5-flash"; // 使用 Flash 模型，速度快且便宜
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * 呼叫 Gemini API 解析工作日報內容
 * @param {string} userMessage - 使用者輸入的原始文字 (Payload)
 * @return {Object} 解析後的 JSON 物件 { item, progress, status }
 */
function callGeminiParser(userMessage) {
  // 1. 讀取 API Key (Security Check)
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("❌ 缺少 API Key！請在 Script Properties 設定 GEMINI_API_KEY");
  }

  // 2. 定義系統提示詞 (System Protocol)
  // 這是告訴 Gemini 如何進行封包轉換的規則書
 // 2. 定義系統提示詞 (System Protocol) - v3.1 更新版
  const systemPrompt = `
  你是一個專業的 IT 工作日報秘書。你的任務是將使用者的輸入轉換為嚴格的 JSON 格式。
  
  # 欄位定義：
  1. item (項目): 簡短的標題 (例如：更換防火牆)。
  2. progress (處理進度): 詳細處理過程。
  3. status (狀態): 必須從以下清單中選擇最接近的一個：
     - "○ 待處理" (新進案件)
     - "➤ 處理中" (正在進行)
     - "? 待確認" (已完成但等驗收)
     - "✔ 完成" (結案)
     - "‖ 暫停" (卡在外部因素)
     - "✖ 取消" (作廢)
     * 若使用者未明確說明狀態，預設為 "➤ 處理中"。
     * 若使用者說 "好了"、"搞定"，請用 "✔ 完成"。

  # 輸出規則：
  - 只回傳 JSON，不要 markdown。
  - Input: "剛去幫財務部換滑鼠，已換新"
  - Output: { "item": "更換財務部滑鼠", "progress": "確認故障，更換新品測試正常", "status": "✔ 完成" }
  `;

  // 3. 組裝 Payload (封裝)
  const payload = {
    "contents": [{
      "parts": [
        { "text": systemPrompt + "\n\nInput: " + userMessage }
      ]
    }],
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": {
        "type": "object",
        "properties": {
          "item":     { "type": "string" },
          "progress": { "type": "string" },
          "status":   { "type": "string" }
        },
        "required": ["item", "progress", "status"]
      },
      "thinkingConfig": { "thinkingBudget": 0 }
    }
  };

  // 4. 發送請求 (Transmission)
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true // 讓我們自己處理錯誤回應
  };

  try {
    const response = UrlFetchApp.fetch(`${API_URL}?key=${apiKey}`, options);
    const responseCode = response.getResponseCode();
    const responseBody = JSON.parse(response.getContentText());

    // 檢查 HTTP 狀態碼
    if (responseCode !== 200) {
      throw new Error(`API Error (${responseCode}): ${JSON.stringify(responseBody)}`);
    }

    // 5. 解析回應 (Unpacking)
    const parts = responseBody.candidates[0].content.parts;
    const answerPart = parts.find(p => !p.thought && p.text);
    if (!answerPart) throw new Error("Gemini 未回傳有效內容");
    let rawText = answerPart.text;

    const parsedJson = JSON.parse(rawText);
    
    // 驗證欄位完整性 (Integrity Check)
    if (!parsedJson.item || !parsedJson.status) {
       throw new Error("Gemini 回傳格式缺少必要欄位");
    }

    Logger.log("✅ Gemini 解析成功: " + JSON.stringify(parsedJson));
    return parsedJson;

  } catch (e) {
    Logger.log("❌ Gemini 連線或解析失敗: " + e.message);
    // 回傳 null 或預設錯誤物件，讓上層 (Line Bot) 知道處理失敗
    throw e; 
  }
}

/**
 * [測試用] 手動測試 Gemini 模組
 * 請直接在編輯器執行此函式，查看執行紀錄
 */
/**
 * [測試用] 手動測試 Gemini 模組 (v3.1 配合新狀態欄位)
 */
function testGeminiConnection() {
  const testMsg = "幫我記一下，剛剛去查修 502 房的 Wi-Fi，發現是 AP 當機，重開後就好了。";
  Logger.log("測試輸入: " + testMsg);
  
  try {
    const result = callGeminiParser(testMsg);
    Logger.log("測試結果 (JSON):");
    Logger.log(result);
    
    // 更新驗證邏輯：現在狀態必須包含 "✔" 或是 "完成"
    if (result.status.includes("完成") || result.status === "✔ 完成") {
      Logger.log("🎯 測試通過！模組運作正常，狀態格式正確。");
    } else {
      Logger.log("⚠️ 測試結果格式雖正確，但狀態判斷可能不如預期 (預期為完成，實際為 " + result.status + ")");
    }
  } catch (e) {
    Logger.log("💥 測試失敗: " + e.message);
  }
}