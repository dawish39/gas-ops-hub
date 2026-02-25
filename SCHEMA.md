# Schema 定義文件

> **專案：** IT 日報自動化系統（Google Apps Script + Google Sheets）  
> **文件版本：** v1.0  
> **說明：** 本文件定義系統所有 Google Sheets 工作表的欄位結構、型別與業務規則，是擴充與開源的 source of truth。

---

## 目錄

1. [Config — 資料來源設定](#1-config--資料來源設定)
2. [StatusDef — 狀態定義](#2-statusdef--狀態定義)
3. [Email — 郵件設定](#3-email--郵件設定)
4. [Department — 部門對照表](#4-department--部門對照表)
5. [CategoryCodeMap — 分類代碼總表](#5-categorycodemap--分類代碼總表)
6. [RepairCategory — 報修子分類](#6-repaircategory--報修子分類)
7. [NeedsCategory — 需求子分類](#7-needscategory--需求子分類)
8. [資料來源表 — repair log（報修紀錄）](#8-資料來源表--repair-log報修紀錄)
9. [資料來源表 — needs log（需求紀錄）](#9-資料來源表--needs-log需求紀錄)
10. [共用型別定義](#10-共用型別定義)
11. [ID 編碼規則](#11-id-編碼規則)

---

## 1. Config — 資料來源設定

**所在檔案：** Config 試算表（`CONFIG_SHEET_ID`）  
**工作表名稱：** `Config`  
**用途：** 控制哪些資料來源要納入日報，以及輸出欄位設定。

| 欄 | 欄位名稱 | 型別 | 必填 | 說明 |
|----|---------|------|------|------|
| A | 來源名稱 | string | ✓ | 顯示在日報中的標題，例如 `IT Log - repair` |
| B | 檔案 ID | string | ✓ | 資料來源 Google Sheets 的檔案 ID |
| C | 工作表名稱 | string | ✓ | 要讀取的 Sheet 名稱，例如 `repair log` |
| D | 啟用 | enum | ✓ | `Y` = 啟用；其他值視為停用 |
| E | 輸出欄位 | string | ✗ | 指定輸出哪些欄位（見下方格式說明）；留空 = 全部輸出 |
| F | type | enum | ✗ | 資料類型，影響日報渲染邏輯（見 SourceType） |

**輸出欄位（E 欄）格式：**

```
0,1,2,3        → 數字索引（從 0 開始）
狀態,項目,進度  → 欄位名稱（對應 header row）
（空白）        → 輸出全部欄位
```

---

## 2. StatusDef — 狀態定義

**所在檔案：** Config 試算表  
**工作表名稱：** `StatusDef`  
**用途：** 定義所有合法的狀態值與其業務語意，供日報邏輯判斷「是否完成」使用。

| 欄 | 欄位名稱 | 型別 | 說明 |
|----|---------|------|------|
| A | 狀態 | string | 狀態符號與名稱，例如 `✔ 完成` |
| B | 定義 | string | 業務說明 |

**合法狀態列舉（StatusType）：**

| 值 | 語意 | 視為完成？ |
|----|------|----------|
| `○ 待處理` | 新進案件，尚未開始 | ✗ |
| `➤ 處理中` | 正在進行 | ✗ |
| `? 待確認` | 已完成，等回報或驗收 | △（依場景判斷）|
| `✔ 完成` | 結案 | ✓ |
| `‖ 暫停` | 卡在外部因素，暫時不動 | ✗ |
| `✖ 取消` | 需求或案件作廢 | ✓（不再顯示）|

> **程式邏輯說明：** `isDone()` 函式判斷狀態是否為「完成/取消」，用於決定待辦事項的顯示範圍。

---

## 3. Email — 郵件設定

**所在檔案：** Config 試算表  
**工作表名稱：** `Email`  
**用途：** 設定日報寄送的收件人資訊。

| 欄 | 欄位名稱 | 型別 | 必填 | 說明 |
|----|---------|------|------|------|
| A | recipient | string (email) | ✓ | 主收件人 Email |
| B | cc | string (email) | ✗ | 副本收件人，多個以逗號分隔 |
| C | senderName | string | ✗ | 寄件者顯示名稱，例如 `日報系統` |

> **注意：** 目前版本僅讀取第一筆資料列（第 2 列）。

---

## 4. Department — 部門對照表

**所在檔案：** Config 試算表  
**工作表名稱：** `Department`  
**用途：** 定義飯店組織架構，用於報修/需求的部門分類與驗證。

| 欄 | 欄位名稱 | 型別 | 必填 | 說明 |
|----|---------|------|------|------|
| A | 部 | string | ✓ | 部門名稱，例如 `客務部` |
| B | 組 | string | ✓ | 組別名稱，例如 `客務組`；部門本身無子組時填寫部門名稱 |

**現有部門清單：**

| 部 | 組 |
|---|---|
| 資訊部 | 資訊部 |
| 客務部 | 客務組 |
| 房務部 | 房務組 |
| 業務部 | 業務部 |
| 業務部 | 客服組 |
| 財務部 | 財務部 |

---

## 5. CategoryCodeMap — 分類代碼總表

**所在檔案：** Config 試算表  
**工作表名稱：** `CategoryCodeMap`  
**用途：** 定義報修與需求的主分類代碼，作為 RepairCategory / NeedsCategory 的父層對照。

| 欄 | 欄位名稱 | 型別 | 必填 | 說明 |
|----|---------|------|------|------|
| A | 代碼 | integer | ✓ | 主分類代碼（見 ID 編碼規則） |
| B | 主項目名稱 | string | ✓ | 主分類顯示名稱，例如 `電腦設備` |
| C | 啟用 | enum | ✓ | `Y` = 啟用；`N` = 停用 |
| D | 說明 | string | ✗ | 分類用途說明 |
| E | 類型 | enum | ✓ | `repair` / `needs`（見 SourceType） |

**現有主分類：**

| 代碼 | 名稱 | 類型 | 啟用 |
|-----|------|------|------|
| 1 | 電腦設備 | repair | Y |
| 2 | 網路設備 | repair | Y |
| 3 | 軟體系統 | repair | Y |
| 4 | 帳號權限 | repair | Y |
| 5 | 系統開發 | needs | Y |
| 6 | 報表需求 | needs | Y |
| 7 | 流程優化 | needs | Y |
| 8 | 其他 | needs | N |

---

## 6. RepairCategory — 報修子分類

**所在檔案：** Config 試算表  
**工作表名稱：** `RepairCategory`  
**用途：** 定義報修的子項目，對應至 CategoryCodeMap 的主分類。

| 欄 | 欄位名稱 | 型別 | 必填 | 說明 |
|----|---------|------|------|------|
| A | ID | integer (4碼) | ✓ | 子分類 ID（見 ID 編碼規則） |
| B | 子項目 | string | ✓ | 子分類名稱，例如 `無法開機` |
| C | 主項目名稱 | string | ✓ | 對應的主分類名稱（Foreign Key → CategoryCodeMap.主項目名稱） |
| D | 啟用 | enum | ✓ | `Y` / `N` |
| E | 登錄時間 | date (YYYY-MM-DD) | ✓ | 此分類建立日期 |
| F | 備註 | string | ✗ | 補充說明 |

---

## 7. NeedsCategory — 需求子分類

**所在檔案：** Config 試算表  
**工作表名稱：** `NeedsCategory`  
**用途：** 定義需求的子項目，結構同 RepairCategory。

| 欄 | 欄位名稱 | 型別 | 必填 | 說明 |
|----|---------|------|------|------|
| A | ID | integer (4碼) | ✓ | 子分類 ID（見 ID 編碼規則） |
| B | 子項目 | string | ✓ | 子分類名稱 |
| C | 主項目名稱 | string | ✓ | 對應主分類（Foreign Key → CategoryCodeMap.主項目名稱） |
| D | 啟用 | enum | ✓ | `Y` / `N` |
| E | 登錄時間 | date (YYYY-MM-DD) | ✓ | 此分類建立日期 |
| F | 備註 | string | ✗ | 補充說明 |

> **注意：** 目前 NeedsCategory 工作表有多餘的空白欄（G~L），應清除以保持整潔。

---

## 8. 資料來源表 — repair log（報修紀錄）

**所在位置：** 獨立 Google Sheets 檔案（ID 設定在 Config.B 欄）  
**工作表名稱：** 設定在 Config.C 欄（目前為 `repair log`）  
**用途：** 記錄每一筆報修案件的完整生命週期。

| 欄位名稱 | 型別 | 必填 | 說明 |
|---------|------|------|------|
| 新增日期 | date | ✓ | 案件建立日期，用於判斷「今日案件」 |
| 狀態 | StatusType | ✓ | 當前處理狀態（見 StatusDef） |
| 項目 | string | ✓ | 報修項目描述 |
| 處理進度簡述 | string | ✗ | 本次更新的進度說明 |
| 最後更新時間 | datetime | ✓ | 最後異動時間，用於判斷「今日完成/更新」 |
| 部門 | string | ✗ | 報修部門（Foreign Key → Department.組） |
| 主項目 | string | ✗ | 主分類（Foreign Key → CategoryCodeMap.主項目名稱） |
| 子項目 | string | ✗ | 子分類（Foreign Key → RepairCategory.子項目） |

**日報渲染邏輯（type = repair）：**

- **今日案件：** `新增日期` = 今天的所有案件
- **待辦事項：** 所有未完成的案件 + 今日完成/取消的案件（依 `最後更新時間` 判斷）

---

## 9. 資料來源表 — needs log（需求紀錄）

**所在位置：** 獨立 Google Sheets 檔案  
**用途：** 記錄每一筆 IT 需求的進度。

| 欄位名稱 | 型別 | 必填 | 說明 |
|---------|------|------|------|
| 新增日期 | date | ✓ | 需求建立日期 |
| 狀態 | StatusType | ✓ | 當前狀態（見 StatusDef） |
| 項目 | string | ✓ | 需求描述 |
| 處理進度簡述 | string | ✗ | 本次更新說明 |
| 最後更新時間 | datetime | ✓ | 最後異動時間 |
| 申請部門 | string | ✗ | 提出需求的部門 |
| 主項目 | string | ✗ | 需求主分類（Foreign Key → CategoryCodeMap.主項目名稱） |
| 子項目 | string | ✗ | 需求子分類（Foreign Key → NeedsCategory.子項目） |

**日報渲染邏輯（type = needs）：**

- 顯示所有未完成的項目
- 加上今日完成/取消的項目（依 `最後更新時間` 判斷）

---

## 10. 共用型別定義

```typescript
// 資料來源類型
type SourceType = "repair" | "needs";

// 啟用狀態
type EnableFlag = "Y" | "N";

// 案件狀態
type StatusType =
  | "○ 待處理"
  | "➤ 處理中"
  | "? 待確認"
  | "✔ 完成"
  | "‖ 暫停"
  | "✖ 取消";

// 判斷是否為「已結束」狀態（程式邏輯用）
const isDone = (status: StatusType): boolean =>
  status === "✔ 完成" || status === "✖ 取消";
```

---

## 11. ID 編碼規則

### CategoryCodeMap 主分類代碼

| 範圍 | 用途 |
|------|------|
| 1–4 | 報修主分類 |
| 5–8 | 需求主分類 |
| （保留擴充空間） | |

### RepairCategory / NeedsCategory 子分類 ID

格式為 `{主分類代碼}{兩位流水號}`，共 3–4 位數字：

| 範例 | 說明 |
|------|------|
| `101` | 主分類 1（電腦設備），第 1 個子項目 |
| `202` | 主分類 2（網路設備），第 2 個子項目 |
| `501` | 主分類 5（系統開發），第 1 個子項目 |

> **注意：** 目前儲存格格式為浮點數（如 `101.0`），程式讀取時需轉換為整數處理。建議在 Google Sheets 中將 A 欄格式設為「純文字」或「數字（無小數）」。

---

## 附錄：待補充欄位清單

下列欄位在程式碼中有被引用，但尚未在此文件中正式定義，未來擴充時應補上：

- `repair log` 的 UUID 欄位（若有使用 UUID 機制）
- Google Docs 範本的 Placeholder 定義（`{{DATE}}`、`{{DATE_FULL}}`、`{{REPORT_CONTENT}}`）
- `ScriptProperties` 中儲存的 Key 清單（`LAST_REPORT_ID`、`CONFIG_SHEET_ID` 等）

---

*最後更新：2026-02-25*
