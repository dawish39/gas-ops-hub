/**
 * @fileoverview Source Provisioning Module.
 * 從零建立新的資料來源 Spreadsheet，並自動完成表頭、公式、資料驗證、Config 登記。
 *
 * 使用方式（在 GAS 編輯器執行）：
 *   provisionSource("repair", "2026年維修記錄")
 *   provisionSource("daily", "2026年日常工作")
 *   provisionSource("needs", "2026年需求追蹤")
 *
 *   migrateSchema("repair", "試算表_ID")   // 補齊現有 Sheet 缺少的欄位
 */

// ==========================================
// 📐 SOURCE_SCHEMAS — 所有來源類型的完整定義
// 新增欄位：修改此處 staticHeaders，再執行 migrateSchema()
// ==========================================

// eslint-disable-next-line no-unused-vars
const SOURCE_SCHEMAS = {

  repair: {
    logSheetName:    'repair log',
    helperSheetName: '參數對照檔',
    type:            'repair',

    // A1：含表頭的 ARRAYFORMULA；依賴 F 欄（最後更新時間）
    arrayFormula: '={"更新"; ARRAYFORMULA(IF(F2:F="", "", IF(IFERROR(INT(F2:F)) = TODAY(), "★", "")))}',

    // B1 起的靜態表頭（更新 由 ARRAYFORMULA 負責，不列於此）
    staticHeaders: ['狀態', '新增日期', '項目', '處理進度簡述', '最後更新時間',
                    '報修單位(組)', '部門(自動)', '報修項目', '報修分類(自動)', 'UUID'],

    // 自動欄位的 XLOOKUP 公式，寫入 row 2（key = 欄位字母）
    xlookupFormulas: {
      H: "=XLOOKUP(G2,'參數對照檔'!$D$2:$D,'參數對照檔'!$C$2:$C,\"n/a\",1)",
      J: "=XLOOKUP(I2,'參數對照檔'!$G$2:$G,'參數對照檔'!$H$2:$H,\"n/a\",1)"
    },

    // 資料驗證：key = 欄位字母，range = 參數對照檔 內的來源範圍
    validations: {
      B: { range: 'A2:A7', label: '狀態' },
      G: { range: 'D2:D',  label: '報修單位(組)' },
      I: { range: 'G2:G',  label: '報修項目' }
    },

    // 參數對照檔 的公式與靜態表頭設定
    helperFormulas: [
      { cell: 'A1', type: 'formula', value: id => `=IMPORTRANGE("${id}", "StatusDef!A:B")` },
      { cell: 'C1', type: 'formula', value: id => `=IMPORTRANGE("${id}", "Department!A:B")` },
      { cell: 'G1', type: 'value',   value: '子項目' },
      { cell: 'H1', type: 'value',   value: '主項目' },
      { cell: 'G2', type: 'formula', value: id => `=FILTER(IMPORTRANGE("${id}", "RepairCategory!B:B"), IMPORTRANGE("${id}", "RepairCategory!D:D")="Y")` },
      { cell: 'H2', type: 'formula', value: id => `=FILTER(IMPORTRANGE("${id}", "RepairCategory!C:C"), IMPORTRANGE("${id}", "RepairCategory!D:D")="Y")` }
    ]
  },

  daily: {
    logSheetName:    'daily project',
    helperSheetName: '參數對照檔',
    type:            'daily',

    arrayFormula: '={"更新"; ARRAYFORMULA(IF(F2:F="", "", IF(IFERROR(INT(F2:F)) = TODAY(), "★", "")))}',

    staticHeaders: ['狀態', '新增日期', '項目', '處理進度簡述', '最後更新時間', 'UUID'],

    xlookupFormulas: {},

    // daily 只需要狀態驗證
    validations: {
      B: { range: 'A2:A7', label: '狀態' }
    },

    helperFormulas: [
      { cell: 'A1', type: 'formula', value: id => `=IMPORTRANGE("${id}", "StatusDef!A:B")` }
    ]
  },

  needs: {
    logSheetName:    'needs needs',
    helperSheetName: '參數對照檔',
    type:            'needs',

    arrayFormula: '={"更新"; ARRAYFORMULA(IF(F2:F="", "", IF(IFERROR(INT(F2:F)) = TODAY(), "★", "")))}',

    staticHeaders: ['狀態', '新增日期', '項目', '處理進度簡述', '最後更新時間',
                    '需求單位(組)', '部門(自動)', '需求類型', '需求分類(自動)', 'UUID'],

    xlookupFormulas: {
      H: "=XLOOKUP(G2,'參數對照檔'!$D$2:$D,'參數對照檔'!$C$2:$C,\"n/a\",1)",
      J: "=XLOOKUP(I2,'參數對照檔'!$G$2:$G,'參數對照檔'!$H$2:$H,\"n/a\",1)"
    },

    validations: {
      B: { range: 'A2:A7', label: '狀態' },
      G: { range: 'D2:D',  label: '需求單位(組)' },
      I: { range: 'G2:G',  label: '需求類型' }
    },

    helperFormulas: [
      { cell: 'A1', type: 'formula', value: id => `=IMPORTRANGE("${id}", "StatusDef!A:B")` },
      { cell: 'C1', type: 'formula', value: id => `=IMPORTRANGE("${id}", "Department!A:B")` },
      { cell: 'G1', type: 'value',   value: '子項目' },
      { cell: 'H1', type: 'value',   value: '主項目' },
      { cell: 'G2', type: 'formula', value: id => `=FILTER(IMPORTRANGE("${id}", "NeedsCategory!B:B"), IMPORTRANGE("${id}", "NeedsCategory!D:D")="Y")` },
      { cell: 'H2', type: 'formula', value: id => `=FILTER(IMPORTRANGE("${id}", "NeedsCategory!C:C"), IMPORTRANGE("${id}", "NeedsCategory!D:D")="Y")` }
    ]
  }
};

// ==========================================
// 🚀 provisionSource — 從零建立新的來源 Spreadsheet
// ==========================================

/**
 * 建立一個完整配置的新資料來源 Spreadsheet。
 * 執行完畢後，需手動開啟新 Spreadsheet 並允許 IMPORTRANGE 授權。
 *
 * @param {string} type   來源類型："repair" | "daily" | "needs"
 * @param {string} [name] 自訂 Spreadsheet 名稱（選填）
 * @returns {string} 執行結果與新 Spreadsheet 連結
 */
// eslint-disable-next-line no-unused-vars
function provisionSource(type, name) {
  const schema = SOURCE_SCHEMAS[type];
  if (!schema) {
    return `❌ 未知的來源類型: "${type}"。可用類型：repair, daily, needs`;
  }

  const configSsId = getConfig().get(PROPERTY_KEYS.SPREADSHEET_ID);
  if (!configSsId) {
    return '❌ 尚未設定 MAIN_CONFIG_SPREADSHEET_ID，請先執行 setInitialProperties()';
  }

  const sourceName = name || `IT Log - ${type}`;
  const log = [];

  try {
    // ── Step 1：建立新 Spreadsheet ──────────────────────────
    const newSs  = SpreadsheetApp.create(sourceName);
    const newSsId  = newSs.getId();
    const newSsUrl = newSs.getUrl();
    log.push(`✅ 建立 Spreadsheet: "${sourceName}"`);
    log.push(`   ID: ${newSsId}`);

    // ── Step 2：設定主要工作表 ──────────────────────────────
    const logSheet = newSs.getSheets()[0];
    logSheet.setName(schema.logSheetName);

    // A1：ARRAYFORMULA（含 "更新" 表頭）
    logSheet.getRange('A1').setFormula(schema.arrayFormula);

    // B1 起：靜態表頭
    if (schema.staticHeaders.length > 0) {
      logSheet.getRange(1, 2, 1, schema.staticHeaders.length)
              .setValues([schema.staticHeaders]);
    }
    log.push(`✅ 工作表「${schema.logSheetName}」表頭設定完成`);

    // ── Step 3：建立參數對照檔並寫入 IMPORTRANGE ────────────
    const helperSheet = newSs.insertSheet(schema.helperSheetName);
    for (const item of schema.helperFormulas) {
      const cell = helperSheet.getRange(item.cell);
      if (item.type === 'formula') {
        cell.setFormula(item.value(configSsId));
      } else {
        cell.setValue(item.value);
      }
    }
    log.push(`✅ 工作表「${schema.helperSheetName}」公式設定完成`);

    // ── Step 4：寫入 XLOOKUP 自動欄位公式 ───────────────────
    const xlookupEntries = Object.entries(schema.xlookupFormulas);
    if (xlookupEntries.length > 0) {
      for (const [col, formula] of xlookupEntries) {
        logSheet.getRange(`${col}2`).setFormula(formula);
      }
      log.push(`✅ XLOOKUP 自動欄位公式設定完成`);
    }

    // ── Step 5：設定資料驗證下拉選單 ────────────────────────
    // flush 確保 helperSheet 的 range 物件已建立
    SpreadsheetApp.flush();

    const validationEntries = Object.entries(schema.validations);
    if (validationEntries.length > 0) {
      for (const [col, cfg] of validationEntries) {
        const sourceRange = helperSheet.getRange(cfg.range);
        const rule = SpreadsheetApp.newDataValidation()
          .requireValueInRange(sourceRange, true)  // true = 顯示下拉選單
          .setAllowInvalid(true)                   // 允許手動輸入覆蓋
          .build();
        logSheet.getRange(`${col}2:${col}1000`).setDataValidation(rule);
      }
      log.push(`✅ 資料驗證（下拉選單）設定完成`);
    }

    // ── Step 6：在 Config Sheet 登記新來源 ──────────────────
    const configSs = SpreadsheetApp.openById(configSsId);
    const configSheetName = getConfig().get(PROPERTY_KEYS.SHEET_CONFIG);
    const configSheet = configSs.getSheetByName(configSheetName);
    if (!configSheet) throw new Error(`找不到 Config 工作表: "${configSheetName}"`);

    // 欄位順序：Name | SS_ID | SheetName | Enabled | OutputCols | Type
    configSheet.appendRow([sourceName, newSsId, schema.logSheetName, 'Y', '', type]);
    log.push(`✅ 已在 Config Sheet 登記新來源`);

    return [
      '=== provisionSource 執行完成 ===',
      log.join('\n'),
      '',
      '⚠️  必要的手動步驟：',
      '   請開啟下方連結，找到「參數對照檔」工作表，',
      '   點擊 IMPORTRANGE 提示並允許存取。',
      '   授權完成後，下拉選單與自動欄位才會正常顯示。',
      '',
      newSsUrl
    ].join('\n');

  } catch (e) {
    return [
      `❌ 執行失敗（${e.message}）`,
      '── 已完成的步驟 ──',
      log.join('\n') || '（無）'
    ].join('\n');
  }
}

// ==========================================
// 🔄 migrateSchema — 補齊現有 Sheet 缺少的欄位
// ==========================================

/**
 * 比對 SOURCE_SCHEMAS 與現有工作表的表頭，在末尾補上缺少的欄位。
 * 只做加法：不更名、不刪除現有欄位，對既有資料零風險。
 *
 * @param {string} type        來源類型："repair" | "daily" | "needs"
 * @param {string} ssId        目標 Spreadsheet ID
 * @param {string} [sheetName] 工作表名稱（選填，預設使用 schema 定義值）
 * @returns {string} 執行結果
 */
// eslint-disable-next-line no-unused-vars
function migrateSchema(type, ssId, sheetName) {
  const schema = SOURCE_SCHEMAS[type];
  if (!schema) return `❌ 未知的來源類型: "${type}"`;

  const targetName = sheetName || schema.logSheetName;
  const ss    = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(targetName);
  if (!sheet) return `❌ 找不到工作表: "${targetName}"`;

  const lastCol = sheet.getLastColumn();

  // A1 是 ARRAYFORMULA，從 B1 開始讀取靜態表頭
  const currentHeaders = lastCol > 1
    ? sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0]
            .map(h => String(h || '').trim())
    : [];

  const missing = schema.staticHeaders.filter(h => !currentHeaders.includes(h));

  if (missing.length === 0) {
    return `✅ [${type}] 表頭完整，無需遷移。`;
  }

  sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);

  return `✅ [${type}] 已補上 ${missing.length} 個欄位：${missing.join('、')}`;
}
