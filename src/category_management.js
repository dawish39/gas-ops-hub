/***********************
 *  分類管理模組 (Service Layer)
 ***********************/

// ==================== 代碼對照表管理 ====================

/**
 * 從 CategoryCodeMap 讀取主項目代碼對照表 (Service)
 */
function getCategoryCodeMap() {
  try {
    const categoryDao = getCategoryDao(PROPERTY_KEYS.SHEET_CATEGORY_CODE_MAP);
    return categoryDao.getCategoryCodeMap();
  } catch (e) {
    Logger.log("❌ 讀取 CategoryCodeMap 失敗：" + e.message);
    // 應拋出錯誤，但為相容性保留舊的錯誤處理
    return {}; 
  }
}

/**
 * 取得主項目對應的代碼（帶快取）
 */
function getCategoryCode(mainCategory) {
  // 保持快取邏輯在 Service 層
  const cached = PropertiesService.getScriptProperties().getProperty("CATEGORY_CODE_MAP");
  
  if (cached) {
    const map = JSON.parse(cached);
    return map[mainCategory] || "99";
  }
  
  const map = getCategoryCodeMap();
  PropertiesService.getScriptProperties().setProperty(
    "CATEGORY_CODE_MAP", 
    JSON.stringify(map)
  );
  
  return map[mainCategory] || "99";
}

/**
 * 刷新代碼對照表快取
 */
function refreshCategoryCodeCache() {
  const map = getCategoryCodeMap();
  PropertiesService.getScriptProperties().setProperty(
    "CATEGORY_CODE_MAP", 
    JSON.stringify(map)
  );
  
  Logger.log("✅ 代碼對照表快取已更新");
  Logger.log(`共 ${Object.keys(map).length} 個主項目`);
  Logger.log(JSON.stringify(map, null, 2));
  
  return map;
}

// ==================== 分類讀取 ====================

/**
 * 讀取報修分類定義
 */
function readRepairCategory() {
  return readCategoryDefGeneric(PROPERTY_KEYS.SHEET_REPAIR_CATEGORY);
}

/**
 * 讀取需求分類定義
 */
function readNeedsCategory() {
  return readCategoryDefGeneric(PROPERTY_KEYS.SHEET_NEEDS_CATEGORY);
}

/**
 * 通用分類讀取函式 (Service)
 * @param {string} sheetNameKey - PROPERTY_KEYS 中定義的分類工作表 key
 */
function readCategoryDefGeneric(sheetNameKey) {
  try {
    const categoryDao = getCategoryDao(sheetNameKey);
    const data = categoryDao.readDefinition();
    
    // Assumes Col 0=ID, Col 1=SubCategory, Col 2=MainCategory, Col 3=Enabled
    return data
      .filter(row => row[3] === "Y")
      .map(row => ({
        id: row[0],
        subCategory: row[1],
        mainCategory: row[2],
        enabled: row[3],
        effectiveDate: row[4] || "",
        note: row[5] || ""
      }));
      
  } catch (e) {
    Logger.log(`❌ 讀取分類定義失敗 (${sheetNameKey})：${e.message}`);
    return [];
  }
}

// ==================== 批次工具（Service Layer）====================

/**
 * 批次生成 ID（通用版本）
 * @param {string} sheetNameKey - 工作表名稱 Key
 * @return {Object} { success, generated, skipped, errors }
 */
function batchGenerateIdsForSheet(sheetNameKey) {
  const sheetName = getConfig().get(sheetNameKey);
  const categoryDao = getCategoryDao(sheetNameKey);

  try {
    Logger.log(`========== 開始批次生成 ${sheetName} ID ==========`);
    
    const data = categoryDao.getRawIdGenerationData(); // 讀取 Col 1-3
    
    if (data.length === 0) {
      Logger.log("⚠️ 工作表沒有資料");
      return { success: false, message: "工作表沒有資料" };
    }
    
    refreshCategoryCodeCache();
    
    let generated = 0;
    let skipped = 0;
    const errors = [];
    
    const categoryGroups = {};
    
    data.forEach((row, idx) => {
      const rowNum = idx + 2; // 實際行號
      const id = String(row[0]).trim();
      const subItem = String(row[1]).trim();
      const mainCategory = String(row[2]).trim();
      
      if (!subItem || !mainCategory) return;
      
      if (!categoryGroups[mainCategory]) {
        categoryGroups[mainCategory] = [];
      }
      
      categoryGroups[mainCategory].push({
        rowNum: rowNum,
        id: id,
        subItem: subItem
      });
    });
    
    Object.keys(categoryGroups).forEach(mainCategory => {
      const categoryCode = getCategoryCode(mainCategory);
      
      if (categoryCode === "99" && mainCategory !== "其他") {
        errors.push(`主項目「${mainCategory}」找不到代碼定義`);
        Logger.log(`⚠️ ${errors[errors.length - 1]}`);
        return;
      }
      
      const items = categoryGroups[mainCategory];
      
      items.forEach((item, seq) => {
        const expectedId = categoryCode + String(seq + 1).padStart(2, '0');
        
        const needsUpdate = 
          !item.id ||
          item.id === "" ||
          !item.id.startsWith(categoryCode) ||
          item.id === "9999";
        
        if (needsUpdate) {
          categoryDao.updateId(item.rowNum, expectedId); // 寫入操作
          Logger.log(`✅ 生成 ID: ${expectedId} (${mainCategory} - ${item.subItem})`);
          generated++;
        } else {
          skipped++;
        }
      });
    });
    
    Logger.log("\n========== 批次生成結果 ==========");
    Logger.log(`✅ 已生成：${generated} 個`);
    Logger.log(`⏭️  已跳過：${skipped} 個`);
    
    if (errors.length > 0) {
      Logger.log(`\n⚠️ 錯誤：`);
      errors.forEach(err => Logger.log(`   ${err}`));
    }
    
    Logger.log("===================================");
    
    return {
      success: true,
      generated: generated,
      skipped: skipped,
      errors: errors
    };
    
  } catch (e) {
    Logger.log(`❌ 批次生成失敗：${e.message}`);
    Logger.log(e.stack);
    return { success: false, message: e.message };
  }
}

/**
 * 批次生成報修分類 ID
 */
function batchGenerateIds() {
  return batchGenerateIdsForSheet(PROPERTY_KEYS.SHEET_REPAIR_CATEGORY);
}

/**
 * 批次生成需求分類 ID
 */
function batchGenerateNeedsIds() {
  return batchGenerateIdsForSheet(PROPERTY_KEYS.SHEET_NEEDS_CATEGORY);
}

/**
 * 智能修正 ID（通用版本）
 * @param {string} sheetNameKey - 工作表名稱 Key
 */
function smartFixIdsForSheet(sheetNameKey) {
  const sheetName = getConfig().get(sheetNameKey);
  const categoryDao = getCategoryDao(sheetNameKey);
  
  try {
    Logger.log(`========== 開始智能修正 ${sheetName} ID ==========`);
    
    const data = categoryDao.getRawIdGenerationData(); // 讀取 Col 1-3
    
    if (data.length === 0) {
      Logger.log("⚠️ 工作表沒有資料");
      return { success: false, message: "工作表沒有資料" };
    }
    
    refreshCategoryCodeCache();
    
    const categoryGroups = {};
    
    data.forEach((row, idx) => {
      const rowNum = idx + 2;
      const subItem = String(row[1]).trim();
      const mainCategory = String(row[2]).trim();
      
      if (!subItem || !mainCategory) return;
      
      if (!categoryGroups[mainCategory]) {
        categoryGroups[mainCategory] = [];
      }
      
      categoryGroups[mainCategory].push(rowNum);
    });
    
    let count = 0;
    
    Object.keys(categoryGroups).forEach(mainCategory => {
      const categoryCode = getCategoryCode(mainCategory);
      const rows = categoryGroups[mainCategory];
      
      rows.forEach((rowNum, idx) => {
        const newId = categoryCode + String(idx + 1).padStart(2, '0');
        categoryDao.updateId(rowNum, newId); // 寫入操作
        Logger.log(`✅ 修正 ID: ${newId} (第 ${rowNum} 列)`);
        count++;
      });
    });
    
    Logger.log(`\n✅ 已修正 ${count} 個 ID`);
    Logger.log("===================================");
    
    return { success: true, count: count };
    
  } catch (e) {
    Logger.log(`❌ 智能修正失敗：${e.message}`);
    return { success: false, message: e.message };
  }
}

/**
 * 智能修正報修分類 ID
 */
function smartFixIds() {
  return smartFixIdsForSheet(PROPERTY_KEYS.SHEET_REPAIR_CATEGORY);
}

/**
 * 智能修正需求分類 ID
 */
function smartFixNeedsIds() {
  return smartFixIdsForSheet(PROPERTY_KEYS.SHEET_NEEDS_CATEGORY);
}

/**
 * 檢查資料完整性（通用版本）
 * @param {string} sheetNameKey - 工作表名稱 Key
 */
function validateCategorySheet(sheetNameKey) {
  const sheetName = getConfig().get(sheetNameKey);
  const categoryDao = getCategoryDao(sheetNameKey);
  
  try {
    const data = categoryDao.getFullValidationData(); // 讀取 Col 1-6

    if (data.length === 0) {
      Logger.log(`⚠️ ${sheetName} 工作表無資料`);
      return { success: true, issues: [] };
    }
    
    const issues = [];
    const categoryCodeMap = getCategoryCodeMap();
    
    data.forEach((row, idx) => {
      const rowNum = idx + 2;
      const id = String(row[0]).trim();
      const subItem = String(row[1]).trim();
      const mainCategory = String(row[2]).trim();
      const enabled = String(row[3]).trim();
      
      if (!subItem || !mainCategory) {
        if (subItem || mainCategory) {
          issues.push(`第 ${rowNum} 列：子項目或主項目不完整`);
        }
        return;
      }
      
      if (!categoryCodeMap[mainCategory] && mainCategory !== "其他") {
        issues.push(`第 ${rowNum} 列：主項目「${mainCategory}」找不到代碼定義`);
      }
      
      if (id) {
        if (!/^\d{3,4}$/.test(id)) {
          issues.push(`第 ${rowNum} 列：ID 格式錯誤（${id}），應為 3-4 位數字`);
        }
      } else {
        issues.push(`第 ${rowNum} 列：ID 為空`);
      }
      
      if (enabled && enabled.toUpperCase() !== "Y" && enabled.toUpperCase() !== "N") {
        issues.push(`第 ${rowNum} 列：啟用狀態應為 Y 或 N`);
      }
    });
    
    const idMap = {};
    data.forEach((row, idx) => {
      const rowNum = idx + 2;
      const id = String(row[0]).trim();
      
      if (id) {
        if (idMap[id]) {
          issues.push(`ID ${id} 重複：第 ${idMap[id]} 列 和 第 ${rowNum} 列`);
        } else {
          idMap[id] = rowNum;
        }
      }
    });
    
    Logger.log(`========== ${sheetName} 資料完整性檢查 ==========`);
    
    if (issues.length === 0) {
      Logger.log("✅ 所有資料都符合規範");
    } else {
      Logger.log(`⚠️ 共發現 ${issues.length} 個問題：\n`);
      issues.forEach(issue => Logger.log(`   ${issue}`));
    }
    
    Logger.log("===================================");
    
    return {
      success: issues.length === 0,
      issues: issues
    };
    
  } catch (e) {
    Logger.log("❌ 檢查失敗：" + e.message);
    Logger.log(e.stack);
    return { success: false, message: e.message };
  }
}

/**
 * 檢查報修分類資料完整性
 */
function validateRepairCategory() {
  return validateCategorySheet(PROPERTY_KEYS.SHEET_REPAIR_CATEGORY);
}

/**
 * 檢查需求分類資料完整性
 */
function validateNeedsCategory() {
  return validateCategorySheet(PROPERTY_KEYS.SHEET_NEEDS_CATEGORY);
}

/**
 * 檢查重複 ID（通用版本）
 * @param {string} sheetNameKey - 工作表名稱 Key
 */
function checkDuplicateIdsInSheet(sheetNameKey) {
  const sheetName = getConfig().get(sheetNameKey);
  const categoryDao = getCategoryDao(sheetNameKey);

  try {
    const data = categoryDao.getRawIdGenerationData(); // 讀取 Col 1-3
    
    if (data.length === 0) {
      Logger.log(`⚠️ ${sheetName} 工作表無資料`);
      return { success: true, duplicates: [] };
    }

    const idMap = {};
    const duplicates = [];
    
    data.forEach((row, idx) => {
      const id = String(row[0]).trim();
      const rowNum = idx + 2;
      
      if (id) {
        if (idMap[id]) {
          duplicates.push(`ID ${id} 重複：第 ${idMap[id]} 列 和 第 ${rowNum} 列`);
        } else {
          idMap[id] = rowNum;
        }
      }
    });
    
    Logger.log(`========== ${sheetName} 重複 ID 檢查 ==========`);
    if (duplicates.length > 0) {
      Logger.log("⚠️ 發現重複 ID：");
      duplicates.forEach(dup => Logger.log(`   ${dup}`));
    } else {
      Logger.log("✅ 沒有發現重複的 ID");
    }
    Logger.log("=================================");
    
    return {
      success: duplicates.length === 0,
      duplicates: duplicates
    };
    
  } catch (e) {
    Logger.log("❌ 檢查失敗：" + e.message);
    return { success: false, message: e.message };
  }
}

/**
 * 檢查報修分類重複 ID
 */
function checkDuplicateIds() {
  return checkDuplicateIdsInSheet(PROPERTY_KEYS.SHEET_REPAIR_CATEGORY);
}

/**
 * 檢查需求分類重複 ID
 */
function checkDuplicateNeedsIds() {
  return checkDuplicateIdsInSheet(PROPERTY_KEYS.SHEET_NEEDS_CATEGORY);
}
