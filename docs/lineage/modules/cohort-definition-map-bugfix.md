# Bugfix: `s.map is not a function` on Cohort Definition Detail Page

**Date:** 2026-03-09
**Scope:** Frontend — Cohort Definitions module
**Severity:** High (page crash on two tabs)

## Symptom

Navigating to `/cohort-definitions/:id` and clicking either the **SQL & Generation** or **Diagnostics** tab threw:

```
Unexpected Application Error!
s.map is not a function
TypeError: s.map is not a function
    at Ce (CohortDefinitionDetailPage-CUtNbbTj.js:1:148594)
```

Both tabs were completely unusable.

## Root Cause

Three API functions in `frontend/src/features/cohort-definitions/api/cohortApi.ts` returned the raw Axios response data without unwrapping the standard Laravel `{ data: [...] }` envelope:

| Function | Line | Issue |
|----------|------|-------|
| `getCohortGenerations()` | 77–84 | Returned `{ data: CohortGeneration[] }` object instead of `CohortGeneration[]` |
| `getCohortGeneration()` | 86–94 | Same envelope leak |
| `previewCohortSql()` | 100–109 | Same envelope leak |

Every *other* function in the file correctly used `data.data ?? data` to unwrap, but these three were missed.

The `GenerationHistoryTable` component guarded with `!generations || generations.length === 0` — but when `generations` is an object `{ data: [...] }`, neither check catches it (the object is truthy and `.length` is `undefined`, not `0`). The subsequent `generations.map()` call then threw because plain objects don't have a `.map()` method.

## Fix

Applied the standard unwrap pattern to all three functions:

```typescript
// getCohortGenerations — extra defensive with Array.isArray
const items = data.data ?? data;
return Array.isArray(items) ? items : [];

// getCohortGeneration & previewCohortSql
return data.data ?? data;
```

## Files Changed

- `frontend/src/features/cohort-definitions/api/cohortApi.ts` — 3 functions fixed

## Lesson

When adding new API functions to an existing file, always follow the file's established response-unwrapping convention. The Laravel envelope `{ data: T }` is universal across the backend — every frontend API function must account for it.
