# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**gas-ops-hub** is an IT operations logbook system (IT 日報管理系統) built on **Google Apps Script (GAS)**. All source code lives in `src/` and runs as a serverless GAS project — there is no local execution environment. Code is pushed to GAS via `clasp`.

## Commands

```bash
npm install                  # Install clasp CLI
npx clasp login              # Authenticate with Google account
npx clasp push               # Deploy src/ to Google Apps Script (main workflow)
npx clasp pull               # Pull remote GAS code back to src/
```

There are no local test or lint commands — the GAS runtime is the execution environment.

## Architecture

The system follows a layered architecture:

```
index.html (Vue.js 3 frontend)
    ↓ google.script.run (GAS bridge)
api_web_gui.js / api_line_bot.js  (Controller layer)
    ↓
analytics.js / report_v2.js / mail.js / triggers.js  (Service layer)
    ↓
dao.js  (Data Access layer — BaseDAO, ConfigDAO, LogEntryDAO)
    ↓
Google Sheets / Drive / Docs  (Persistence)
```

**Key files:**
- `src/dao.js` — All spreadsheet I/O goes through DAO classes. `getLogEntryDAO(source)` is the factory. Uses `LockService` for concurrent write safety.
- `src/config.js` — `ConfigManager` class / `CONFIG` singleton; reads from Script Properties (not hardcoded values).
- `src/api_web_gui.js` — ~10 backend endpoints callable via `google.script.run`; results cached with `CacheService` (15-min TTL).
- `src/api_line_bot.js` — LINE Bot webhook handler; `doPost()` entry point.
- `src/index.html` — Entire Vue.js 3 SPA (74 KB); uses CDN Bootstrap 5, Chart.js 4.
- `src/analytics.js` — Statistical aggregation for dashboard charts and exports.
- `src/triggers.js` — Time-driven GAS triggers (`dailyJob`, `warmUpCacheJob`).

## GAS-Specific Constraints

- **No `require`/`import`** — GAS uses a flat global scope. All files in `src/` share one global namespace at runtime.
- **No hardcoded secrets** — API keys, spreadsheet IDs, LINE tokens must be stored in GAS **Script Properties**, not in source code.
- **Batch reads/writes** — Never read or write to Spreadsheet inside a loop. Always: batch-read → compute in memory → batch-write.
- **Quotas to watch:** SpreadsheetApp 30k ops/min; UrlFetchApp 100k calls/day; trigger execution 6h/day total.
- `src/appsscript.json` sets `timeZone: "America/New_York"` — adjust to `"Asia/Taipei"` for Taiwan deployments.

## Configuration

All runtime configuration is stored in GAS **Script Properties**. Key properties:

| Property | Purpose |
|---|---|
| `MAIN_CONFIG_SPREADSHEET_ID` | Main config Google Sheet ID (required) |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API token |
| `LINE_ALLOWED_USERS` | Comma-separated whitelist of LINE user IDs |
| `REPORTS_FOLDER_ID` | Google Drive folder for generated reports |
| `REPORT_TEMPLATE_ID` | Google Doc template ID |
| `GEMINI_API_KEY` | Gemini AI key (optional feature) |

## Access Scope
- All source files are in `./src` — only read or modify files within this directory
- Do not touch `creds.json`, `.clasp.json`, `*.env` unless explicitly asked
- Do not run `clasp push` or `clasp deploy` without explicit confirmation

## Development Protocol (from .cursorrules)

Before writing code for non-trivial changes:
1. **Clarify architecture** — Identify data flow, affected layers (Controller/Service/DAO), and quota risks.
2. **Challenge the approach** — Raise any race conditions, GAS quota concerns, or design alternatives.
3. **Then implement** — Only after the approach is confirmed.
