/***********************
 *  使用範本產生日報（修正空白列過濾）
 ***********************/

// ==================== 版面設定 ====================
const CONTENT_WIDTH_PT = 523;
const REPAIR_COL_PCT   = [0.06, 0.10, 0.12, 0.32, 0.30, 0.10];

// ==================== 表格美化函式 ====================

function resizeTableByPct(table, pctArr) {
  const cols = table.getRow(0).getNumCells();
  if (cols !== pctArr.length) return;
  for (let c = 0; c < cols; c++) {
    const w = Math.round(CONTENT_WIDTH_PT * pctArr[c]);
    try { table.setColumnWidth(c, w); } catch(e) {}
  }
}

function styleHeaderRow(table) {
  const header = table.getRow(0);
  header.editAsText().setBold(true);
  for (let c = 0; c < header.getNumCells(); c++) {
    const cell = header.getCell(c);
    try { cell.setBackgroundColor("#F3F4F6"); } catch (e) {}
    const childCount = cell.getNumChildren();
    for (let i = 0; i < childCount; i++) {
      const child = cell.getChild(i);
      if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
        child.asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      }
    }
  }
}

function getColPct(headers) {
  const cols = headers.length;
  const pct  = Array(cols).fill(1 / cols);
  const hAt = (names) => {
    for (let i = 0; i < cols; i++) {
      const h = String(headers[i] || "").trim();
      for (const n of names) if (h.indexOf(n) !== -1) return i;
    }
    return -1;
  };

  const m = new Map();
  const idx = {
    更新: hAt(["更新"]),
    狀態: hAt(["狀態"]),
    新增日期: hAt(["新增日期"]),
    項目: hAt(["項目"]),
    進度: hAt(["處理進度簡述", "處理進度", "備註"]),
    最後更新: hAt(["最後更新時間", "最後更新"])
  };
  if (idx.更新      > -1) m.set(idx.更新,      0.06);
  if (idx.狀態      > -1) m.set(idx.狀態,      0.10);
  if (idx.新增日期  > -1) m.set(idx.新增日期,  0.12);
  if (idx.項目      > -1) m.set(idx.項目,      0.30);
  if (idx.進度      > -1) m.set(idx.進度,      0.32);
  if (idx.最後更新  > -1) m.set(idx.最後更新,  0.10);

  for (const [i, v] of m.entries()) pct[i] = v;
  const sum = pct.reduce((a,b)=>a+b,0);
  return pct.map(v => v / sum);
}

// ==================== 資料處理工具 ====================

function isEmptyRow(row) {
  return row.every(cell => cell === "" || cell === null || cell === undefined);
}

function colIndexByName(headers, name) {
  const hs = headers.map(h => String(h || "").trim());
  return hs.indexOf(String(name || "").trim());
}

function isDone(status) {
  const s = String(status || "");
  return s.includes("完成") || s.includes("取消");
}

// ==================== 主流程 ====================

function generateReport() {
  const CONFIG = getConfig();
  const REPORTS_FOLDER_ID = CONFIG.get(PROPERTY_KEYS.REPORTS_FOLDER_ID);
  const TEMPLATE_ID = CONFIG.get(PROPERTY_KEYS.REPORT_TEMPLATE_ID);
  
  const today = formatToday("yyyy/MM/dd");
  const todayFull = formatTodayWithWeek();

  const folder = DriveApp.getFolderById(REPORTS_FOLDER_ID);
  const copy = DriveApp.getFileById(TEMPLATE_ID).makeCopy(`資訊部日報 - ${today}`, folder);
  const doc  = DocumentApp.openById(copy.getId());
  const body = doc.getBody();

  const replaceMarkers = [
    { key: "{{DATE}}",      val: today },
    { key: "{{DATE_FULL}}", val: todayFull }
  ];
  replaceMarkers.forEach(m => {
    let r;
    while ((r = body.findText(m.key))) {
      const t = r.getElement().asText();
      t.deleteText(r.getStartOffset(), r.getEndOffsetInclusive());
      t.insertText(r.getStartOffset(), m.val);
    }
  });

  const marker = body.findText("{{REPORT_CONTENT}}");
  if (marker) {
    const text = marker.getElement().asText();
    text.deleteText(marker.getStartOffset(), marker.getEndOffsetInclusive());
    let insertPoint = body.getChildIndex(text.getParent());

    const sources = readConfig();

    const isRepairSrc = (s) => {
      const t = String(s.type || "").trim().toLowerCase();
      if (t === "repair") return true;
      return String(s.name || "").includes("報修");
    };
    const repairSrc = sources.find(isRepairSrc);
    const others = sources.filter(s => s !== repairSrc);

    if (repairSrc) {
      try {
        const logDao = getLogEntryDAO(repairSrc);
        const sheet = logDao.getSheet();
        if (sheet) {
          const allHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          const lastRow = sheet.getLastRow();
          
          if (lastRow >= 2) {
            let allRows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

            // 先篩選欄位
            const { headers, rows } = filterColumnsByConfig(allHeaders, allRows, repairSrc.outputColumns);

            // 再過濾空白列（只檢查篩選後的欄位）
            const nonEmptyRows = rows.filter(r => !isEmptyRow(r));

            let dateColIndex   = colIndexByName(headers, "新增日期"); if (dateColIndex   === -1) dateColIndex   = 2;
            let statusColIndex = colIndexByName(headers, "狀態");     if (statusColIndex === -1) statusColIndex = 1;
            let lastColIndex   = headers.length - 1;

            const todayData = nonEmptyRows.filter(r => {
              const v = r[dateColIndex]; if (!v) return false;
              const d = new Date(v);
              return Utilities.formatDate(d, "Asia/Taipei", "yyyy/MM/dd") === today;
            });

            const pendingData = nonEmptyRows.filter(r => {
              const v = r[dateColIndex]; if (!v) return false;
              const d = new Date(v);
              const isToday = Utilities.formatDate(d, "Asia/Taipei", "yyyy/MM/dd") === today;
              const status  = r[statusColIndex];
              if (isToday) return false;
              if (isDone(status)) {
                const last = r[lastColIndex];
                if (!last) return false;
                const d2 = new Date(last);
                return Utilities.formatDate(d2, "Asia/Taipei", "yyyy/MM/dd") === today;
              }
              return true;
            });

            body.insertParagraph(insertPoint, "[報修處理紀錄]")
                .setHeading(DocumentApp.ParagraphHeading.HEADING2);
            insertPoint++;

            body.insertParagraph(insertPoint, "【今日案件】")
                .setHeading(DocumentApp.ParagraphHeading.HEADING3);
            insertPoint++;

            if (todayData.length > 0) {
              const t1 = body.insertTable(insertPoint, [headers, ...todayData.map(r => r.map(c => formatDateValue(c, "table")))] );
              styleHeaderRow(t1); resizeTableByPct(t1, REPAIR_COL_PCT);
              insertPoint++;
            } else {
              body.insertParagraph(insertPoint, "今日無案件"); insertPoint++;
            }

            body.insertParagraph(insertPoint, "【待辦事項】")
                .setHeading(DocumentApp.ParagraphHeading.HEADING3);
            insertPoint++;

            if (pendingData.length > 0) {
              const t2 = body.insertTable(insertPoint, [headers, ...pendingData.map(r => r.map(c => formatDateValue(c, "table")))] );
              styleHeaderRow(t2); resizeTableByPct(t2, REPAIR_COL_PCT);
              insertPoint++;
            } else {
              body.insertParagraph(insertPoint, "無待辦事項"); insertPoint++;
            }
          }
        }
      } catch (e) {
        body.insertParagraph(insertPoint, `❌ 無法讀取 ${repairSrc.name || "報修處理紀錄"}: ${e.message}`);
        insertPoint++;
      }
    }

    others.forEach(src => {
      try {
        const logDao = getLogEntryDAO(src);
        const sheet = logDao.getSheet();
        if (!sheet) return;

        const allHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const lastRow = sheet.getLastRow();
        
        if (lastRow < 2) return;

        let allRows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

        // 先篩選欄位
        const { headers, rows } = filterColumnsByConfig(allHeaders, allRows, src.outputColumns);

        // 再過濾空白列（只檢查篩選後的欄位）
        const nonEmptyRows = rows.filter(r => !isEmptyRow(r));

        let statusColIndex = colIndexByName(headers, "狀態");
        if (statusColIndex === -1) statusColIndex = 1;
        let lastColIndex = headers.length - 1;

        const filtered = nonEmptyRows.filter(r => {
          const status = String(r[statusColIndex] || "");
          if (isDone(status)) {
            const last = r[lastColIndex];
            if (!last) return false;
            const d = new Date(last);
            return Utilities.formatDate(d, "Asia/Taipei", "yyyy/MM/dd") === today;
          }
          return true;
        });

        body.insertParagraph(insertPoint, `[${src.name}]`)
            .setHeading(DocumentApp.ParagraphHeading.HEADING2);
        insertPoint++;

        if (filtered.length > 0) {
          const t = body.insertTable(insertPoint, [headers, ...filtered.map(r => r.map(c => formatDateValue(c, "table")))] );
          styleHeaderRow(t); resizeTableByPct(t, getColPct(headers));
          insertPoint++;
        } else {
          body.insertParagraph(insertPoint, "無資料"); insertPoint++;
        }
      } catch (e) {
        body.insertParagraph(insertPoint, `❌ 無法讀取 ${src.name}: ${e.message}`); insertPoint++;
      }
    });
  }

  doc.saveAndClose();

  PropertiesService.getScriptProperties().setProperty("LAST_REPORT_ID", copy.getId());
  Logger.log("✅ 日報已建立: " + copy.getUrl());
  return copy.getId();  
}
