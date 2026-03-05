# Phase 9.4 — Achilles Heel Frontend (Heel Checks Tab)

**Date:** 2026-03-03
**Branch:** master

---

## What Was Built

### Context

The Achilles Heel backend was already fully implemented in a prior session:
- `achilles_heel_results` table (migration `2026_03_02_000000`)
- `AchillesHeelService` with `run()` + `getResults()` methods
- `AchillesHeelRuleRegistry` + 15 individual rule files (Rule1–Rule15)
- `AchillesController@heel()` (GET) and `AchillesController@runHeel()` (POST)
- Routes: `GET /api/v1/sources/{source}/achilles/heel` and `POST .../heel/run`

This session added the **frontend Heel Checks tab** to complete the feature end-to-end.

---

## Files Changed

### New
| File | Description |
|------|-------------|
| `frontend/src/features/data-explorer/pages/HeelTab.tsx` | Heel Checks tab UI |

### Modified
| File | Change |
|------|--------|
| `frontend/src/features/data-explorer/types/dataExplorer.ts` | Added `HeelSeverity`, `HeelResult`, `HeelResultsGrouped`, `HeelRunResult` types |
| `frontend/src/features/data-explorer/api/achillesApi.ts` | Added `fetchHeelResults()` + `runHeel()` API functions |
| `frontend/src/features/data-explorer/hooks/useAchillesData.ts` | Added `useHeelResults()` + `useRunHeel()` hooks |
| `frontend/src/features/data-explorer/pages/DataExplorerPage.tsx` | Added "Heel Checks" tab (5th tab) |

---

## UI Design

### HeelTab features:
- **"Run Heel Checks" button** — POSTs to `/heel/run`, auto-refreshes results via query invalidation
- **Loading skeleton** while fetching
- **Empty state** when no runs yet: shield icon + instructional copy
- **Summary banner** — color-coded by worst severity:
  - Red: "N issues found: N errors, N warnings, N notifications"
  - Green: "All Achilles Heel checks passed — no data quality issues detected."
- **Results grouped by severity** (errors → warnings → notifications), each with:
  - Section header with severity icon + count badge
  - Per-result row: rule name, severity badge, attribute_name/value, record_count
  - Color coding: errors=red, warnings=amber, notifications=blue

### Run completion feedback:
- Inline text: "14 rules completed, 1 failed" or "Failed to run heel checks"

---

## Verification

```
npx tsc --noEmit → 0 errors
Frontend tab visible at /data-explorer → "Heel Checks" tab (5th)
GET /api/v1/sources/6/achilles/heel → 200, {error:[], warning:[], notification:[]}
POST /api/v1/sources/6/achilles/heel/run → runs 15 rules, persists violations
```

---

## Backend Rule Inventory (already implemented)

15 rules covering:
- **Death domain**: Death before birth (Rule 1), Death after observation end (Rule 2)
- **Person domain**: Future birth year (Rule 3), Implausible age at death (Rule 4)
- **Observation period**: Zero-length observation (Rule 5), Overlapping periods (Rule 6), Observation after death (Rule 7)
- **Condition**: Condition start after end (Rule 8)
- **Drug**: Drug start after end (Rule 9), Drug quantity ≤ 0 (Rule 10)
- **Measurement**: Implausible measurement value (Rule 11)
- **Visit**: Visit start after end (Rule 12)
- **Missing data**: Missing concept IDs (Rule 13), Low patient count (Rule 14), Completeness check (Rule 15)

Severities: `error` (data corruption), `warning` (plausibility concern), `notification` (informational)
