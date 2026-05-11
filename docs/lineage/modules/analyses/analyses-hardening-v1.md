---
doc_type: lineage
status: historical
date: 2026-03-07
owner: acumenus
module: analyses
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
# Analyses Hardening v1 — API Envelope Fixes & Defensive Numeric Formatting

**Date:** 2026-03-07
**Commit:** (this session)

## What Was Done

### 1. API Response Envelope Fixes (7 files, 14 functions)

All analysis API modules had a bug where `listExecutions` and `getExecution` functions returned the raw Laravel paginated response `{current_page, data: [...], ...}` instead of the unwrapped array/object. This caused:
- "No results available" on pages with completed executions (e.g., Estimation #1 with 6 completed runs)
- `useEffect` checking `executions.length > 0` received `undefined` (object has no `.length`)
- `activeExecId` never got set, so results never loaded

**Fix:** Changed `return data` to `return data.data ?? data` in all API files:
- `estimationApi.ts`, `predictionApi.ts`, `sccsApi.ts`
- `characterizationApi.ts`, `incidenceRateApi.ts`
- `evidenceSynthesisApi.ts`, `pathwayApi.ts`

### 2. Defensive `.toFixed()` Hardening (6 components)

R runtime can return `"NA"` (string), `null`, or `NaN` for numeric fields. Calling `.toFixed()` on these crashes the page with `TypeError: "NA".toFixed is not a function`.

**Fix:** Added `fmt()` and `num()` helper functions to all R-backed results components:
- `EstimationResults.tsx` — 15 unsafe calls replaced
- `PredictionResults.tsx` — 12 unsafe calls replaced
- `SccsResults.tsx` — 6 unsafe calls replaced
- `EvidenceSynthesisResults.tsx` — 8 unsafe calls replaced
- `IncidenceRateResults.tsx` — 12 unsafe calls replaced
- `SccsTimeline.tsx` — 4 unsafe calls replaced

```typescript
function fmt(v: unknown, decimals = 3): string {
  if (v == null || v === "NA" || v === "NaN" || v === "") return "N/A";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(decimals) : "N/A";
}
function num(v: unknown): number {
  if (v == null || v === "NA" || v === "NaN") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
```

### 3. UX/UI Alignment (4 detail pages)

Rewrote SCCS, Evidence Synthesis, Characterization, and Incidence Rate detail pages to match the canonical EstimationDetailPage pattern:
- Full-width layout (removed `max-w-4xl`)
- Teal `#2DD4BF` Execute button and tab underlines
- Database icon + ChevronDown on source selector
- ExecutionStatusBadge component
- `window.confirm` on delete
- Text labels on all buttons

## Key Lesson

Laravel wraps all API responses in `{data: T}`. Paginated responses have an additional `data` array inside. Frontend API functions must always unwrap with `data.data ?? data` to handle both paginated and non-paginated responses.

## Remaining Work

See `docs/lineage/modules/analyses/analyses-v2-enhancement-plan.md` for the full v2 plan including:
- Extracting `fmt()`/`num()` to shared `@/lib/formatters.ts`
- Hardening sub-component charts (ForestPlot, LovePlot, etc.)
- Pathways R backend implementation
- Running remaining 11 seeded analyses
