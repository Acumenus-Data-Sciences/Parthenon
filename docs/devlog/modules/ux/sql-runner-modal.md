# SQL Runner Modal — Run SQL with Live Feedback

**Date:** 2026-03-14

## Summary

Added a "Run SQL" button to the SqlBlock toolbar that launches a modal with live execution feedback, a data preview table, and CSV download.

## Architecture

### Backend (3 new endpoints)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/text-to-sql/execute` | Execute read-only SQL on `cdm` connection |
| `GET /api/v1/text-to-sql/execute/{id}/status` | Poll pg_stat_activity for query status |
| `GET /api/v1/text-to-sql/execute/{id}/download` | Stream results as CSV |

### Security

- **Read-only enforcement:** Regex blocks DDL/DML keywords, requires SELECT/WITH prefix
- **Role gate:** Safe queries available to all users; unsafe/unknown require `super-admin`
- **Statement timeout:** 120s per query
- **Row cap:** 10,000 rows max to prevent memory exhaustion
- **Results cached in Redis** for 5 minutes (keyed by UUID execution ID)

### Frontend

- `SqlBlock.tsx` — Added teal "Run SQL" button next to Copy
- `SqlRunnerModal.tsx` — Full-screen modal with:
  - Live status from pg_stat_activity (state, wait events, elapsed time)
  - Data preview table (first 100 rows, sticky headers, zebra striping)
  - Download CSV button
  - Truncation warning badge when results capped at 10K rows
  - Non-dismissable while query is running

## Bugfixes (same session)

1. **Trailing semicolons** — User SQL often ends with `;`, which caused syntax errors when wrapped in `SELECT * FROM (...) AS _q LIMIT 10001`. Fixed by stripping trailing semicolons before wrapping.
2. **AI returning prose instead of SQL** — The AI service sometimes returns reasoning text in the `sql` field. Added early rejection: query must begin with `SELECT` or `WITH`, and backtick-quoted identifiers (MySQL syntax) are rejected with a helpful message.

## Contextual Error Guidance

When a query fails, the modal now shows a gold guidance panel with actionable suggestions tailored to the error type:

| Error Type | Guidance |
|---|---|
| AI returned prose | Rephrase question, use Query Library, be specific about tables |
| MySQL backticks | PostgreSQL uses double quotes, most OMOP columns don't need quoting |
| Syntax errors | Regenerate, check parentheses/commas, validate first |
| Statement timeout | Add WHERE conditions, LIMIT, date ranges, avoid SELECT * |
| Table not found | Schema-qualify with `omop.`, check Schema Browser |
| Column not found | Expand table in Schema Browser, check OMOP naming conventions |
| Permission denied | Explains safety classification, suggests Validate button |

## Files Changed

- `backend/app/Http/Controllers/Api/V1/TextToSqlController.php` — 3 new methods
- `backend/routes/api.php` — 3 new routes
- `frontend/src/features/text-to-sql/api.ts` — 3 new API functions + types
- `frontend/src/features/text-to-sql/components/SqlBlock.tsx` — Run button + modal trigger
- `frontend/src/features/text-to-sql/components/SqlRunnerModal.tsx` — New modal component
- `frontend/src/features/text-to-sql/components/ResultsPanel.tsx` — Pass safety prop
