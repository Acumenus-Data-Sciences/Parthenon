# SQL Dialect Selector and OHDSI SQL Translator

**Date:** 2026-03-15

## Summary

Added a system-wide SQL dialect setting with super-admin configuration and an OHDSI SQL translator that converts T-SQL templates to all 11 HADES-compliant database dialects at render time. This fixed 91 of 107 broken Query Library queries (85% error reduction).

## Problem

The OHDSI QueryLibrary templates are written in SQL Server (T-SQL) syntax — the canonical format across OHDSI tooling. Parthenon runs PostgreSQL, so functions like `YEAR()`, `GETDATE()`, `DATEDIFF(day,...)`, `STDEV()`, `ISNULL()`, and `TOP N` all failed with syntax errors.

## OhdsiSqlTranslator

Created `backend/app/Services/SqlRenderer/OhdsiSqlTranslator.php` — a PHP implementation of the same conversions that OHDSI's SqlRender (R/Java) performs.

### T-SQL Functions Translated

| T-SQL | PostgreSQL | Oracle | BigQuery | Snowflake |
|-------|-----------|--------|----------|-----------|
| `YEAR(date)` | `EXTRACT(YEAR FROM date)` | same | same | same |
| `MONTH(date)` | `EXTRACT(MONTH FROM date)` | same | same | same |
| `DAY(date)` | `EXTRACT(DAY FROM date)` | same | same | same |
| `GETDATE()` | `CURRENT_DATE` | `TRUNC(SYSDATE)` | `CURRENT_DATE()` | `CURRENT_DATE()` |
| `DATEADD(day,n,d)` | `d + n * INTERVAL '1 day'` | `d + n` | `DATE_ADD(d, INTERVAL n DAY)` | `DATEADD(day,n,d)` |
| `DATEDIFF(day,s,e)` | `e::date - s::date` | `CAST(e AS DATE) - CAST(s AS DATE)` | `DATE_DIFF(e,s,DAY)` | `DATEDIFF(day,s,e)` |
| `DATEFROMPARTS(y,m,d)` | `MAKE_DATE(y,m,d)` | `TO_DATE(...)` | `DATE(y,m,d)` | `DATE_FROM_PARTS(y,m,d)` |
| `STDEV()` | `STDDEV()` | `STDDEV()` | `STDDEV()` | `STDDEV()` |
| `COUNT_BIG()` | `COUNT()` | `COUNT()` | `COUNT()` | `COUNT()` |
| `ISNULL(a,b)` | `COALESCE(a,b)` | `COALESCE(a,b)` | `COALESCE(a,b)` | `COALESCE(a,b)` |
| `CHARINDEX(s,str)` | `POSITION(s IN str)` | same | same | same |
| `TOP N` | `LIMIT N` | `FETCH FIRST N ROWS` | `LIMIT N` | `LIMIT N` |
| `LEN()` | `LENGTH()` | same | same | same |
| `CONVERT(type,expr)` | `CAST(expr AS type)` | same | same | same |
| `AND WHERE` | `AND` (typo fix) | same | same | same |

T-SQL interval abbreviations (dd, mm, yy, wk, etc.) are normalized to full names.

### Supported Target Dialects (11 HADES-compliant)

PostgreSQL, SQL Server (passthrough), Oracle, Amazon Redshift, Google BigQuery, Snowflake, Azure Synapse (passthrough), Spark/Databricks, Apache Hive, Apache Impala, IBM Netezza

## Dialect Selector UI

### System Default (Super-Admin)
- `app_settings` table with singleton row storing `default_sql_dialect`
- `GET /api/v1/app-settings` — returns default + available dialects (all authenticated users)
- `PATCH /api/v1/app-settings` — update default (super-admin only)

### Frontend
- Dropdown in Query Assistant page header showing all 11 dialects
- Super-admins see a gold "Default" badge — changes persist as system-wide default
- Regular users can override per-session without affecting the default
- Dialect flows through entire rendering chain: Page → Tab → ResultsPanel → SqlBlock → SqlRunnerModal → render API

## Test Results

| Metric | Before Translator | After Translator |
|--------|-------------------|------------------|
| Working queries | 66 (33%) | 134 (67%) |
| No results (valid SQL) | 26 (13%) | 50 (25%) |
| Errors | 107 (53%) | 15 (7%) |
| Skipped | 2 (1%) | 2 (1%) |

Remaining 15 errors: 6 timeouts (expensive queries), 9 template-specific edge cases.

## Files Created/Modified

**Backend:**
- `backend/app/Services/SqlRenderer/OhdsiSqlTranslator.php` — New (487 lines)
- `backend/app/Services/SqlRenderer/SqlRendererService.php` — Integrated translator
- `backend/app/Models/App/AppSetting.php` — New singleton settings model
- `backend/app/Http/Controllers/Api/V1/Admin/AppSettingsController.php` — New controller
- `backend/database/migrations/2026_03_15_100000_create_app_settings_table.php` — New migration
- `backend/routes/api.php` — Added app-settings routes

**Frontend:**
- `frontend/src/features/text-to-sql/pages/QueryAssistantPage.tsx` — Dialect selector
- `frontend/src/features/text-to-sql/components/QueryLibraryTab.tsx` — Accepts dialect prop
- `frontend/src/features/text-to-sql/components/ResultsPanel.tsx` — Passes dialect through
- `frontend/src/features/text-to-sql/components/SqlBlock.tsx` — Passes dialect to modal
- `frontend/src/features/text-to-sql/components/SqlRunnerModal.tsx` — Uses dialect for rendering
- `frontend/src/features/text-to-sql/api.ts` — AppSettings API functions
