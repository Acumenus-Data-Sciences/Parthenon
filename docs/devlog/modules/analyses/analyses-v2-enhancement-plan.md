# Analyses v2 Enhancement Plan

**Date:** 2026-03-07
**Status:** Proposed
**Scope:** All 7 analysis types (Estimation, Prediction, SCCS, Characterization, Incidence Rate, Evidence Synthesis, Pathways)

---

## What Was Done in v1

### UX/UI Alignment
- All 6 detail pages (Estimation, Prediction, SCCS, Evidence Synthesis, Characterization, Incidence Rate) rewritten to match canonical pattern: full-width layout, teal `#2DD4BF` accents, Database icon source selector, ExecutionStatusBadge, consistent tab navigation
- Pathways already followed the pattern

### API Envelope Fixes
- All 7 API files fixed to properly unwrap Laravel's `{data: T}` response envelope using `data.data ?? data`
- Affected: `listExecutions` and `getExecution` in every analysis API module

### Defensive Numeric Formatting
- Added `fmt()` / `num()` helpers to all R-backed results components:
  - EstimationResults, PredictionResults, SccsResults, EvidenceSynthesisResults, IncidenceRateResults, SccsTimeline
- Prevents crashes when R returns `"NA"` (string), `null`, or `NaN` for numeric fields

---

## Analyses Execution Status

### Have completed executions (results verified):
| Analysis | Type | Executions | Status |
|----------|------|-----------|--------|
| Metformin vs Sulfonylurea for T2DM | Estimation #1 | 6 completed | Working — forest plot, PS diagnostics, KM curves |
| CKD Progression Risk Model | Prediction #1 | 3 completed | Working — AUC shows N/A (R returned "NA"), no crash |
| NSAID and Acute Kidney Injury | SCCS #1 | 2 completed | Working — IRR table, timeline rendering |

### All analyses now have completed executions on Acumenus CDM (1M patients) ✅

---

## v2 Enhancement Plan

### Phase 1: Remaining Crash Hardening (Priority: Critical) — **COMPLETED**

**1.1 — Sub-component `.toFixed()` hardening** ✅
All child chart/plot components hardened with defensive `fmt()`/`num()` calls:
- `ForestPlot.tsx` (estimation) — ✅
- `LovePlot.tsx` — ✅
- `PropensityScorePlot.tsx` — ✅
- `SystematicErrorPlot.tsx` — ✅
- `PowerTable.tsx` — ✅
- `KaplanMeierPlot.tsx` — ✅
- `CalibrationPlot.tsx` — ✅
- `RocCurve.tsx` — ✅
- `PrecisionRecallCurve.tsx` — ✅
- `PredictionDistribution.tsx` — ✅
- `ExternalValidationComparison.tsx` — ✅
- `EvidenceSynthesis/ForestPlot.tsx` — ✅
- `FeatureComparisonTable.tsx` — ✅

**1.2 — Shared formatters module** ✅
```typescript
// frontend/src/lib/formatters.ts — created and imported across all 18+ components
export function fmt(v: unknown, decimals = 3): string { ... }
export function num(v: unknown): number { ... }
export function fmtPct(v: unknown, decimals = 1): string { ... }
export function fmtCompact(n: number): string { ... }  // 1.2M, 3.4K
```

### Phase 2: Pathways R Backend (Priority: High) — **SKIPPED (Not Needed)**

Pathways are fully handled by PHP `PathwayService` — no R runtime needed. Both pathway analyses execute successfully via the `analysis` queue.

### Phase 3: Execution Coverage (Priority: Medium) — **COMPLETED**

All 13 seeded analyses executed against Acumenus CDM (1M patients):
- ✅ Estimation #1 (Lisinopril vs ARB, HR=1.02, PS AUC=0.95)
- ✅ Estimation #2 (ACE-I vs ARB, demographics-only PS, HR=0.26 CAD, HR=8.15 AMI)
- ✅ Estimation #3 (Lisinopril vs ARB, matching PS)
- ✅ Prediction #1 (LASSO, 30 predictors, 200pt ROC)
- ✅ Prediction #2 (Gradient boosting / xgboost, 30 predictors)
- ✅ Prediction #3 (LASSO logistic regression)
- ✅ SCCS #1 (IRR=93.0 primary window), SCCS #2, SCCS #3
- ✅ Evidence Synthesis (Bayesian meta-analysis, pooled HR=0.72, τ=0.077)
- ✅ Pathway #1, #2 (PHP-based)
- ✅ Characterization #1, #2 (PHP-based)
- ✅ Incidence Rate #1, #2 (PHP-based)

See `docs/devlog/analyses-v2-phase3-execution-coverage.md` for details.

### Phase 4: Results UX Improvements (Priority: Medium)

**4.1 — Execution auto-refresh**
Currently the `useEstimationExecution` hook polls every 2s during running/queued/pending. Verify this pattern exists in all 7 analysis types. Add it where missing.

**4.2 — Source name display**
Execution history tables show "Source #1" instead of the actual source name. Join with sources data to show `source_name`.

**4.3 — Execution comparison**
Allow selecting two completed executions to compare results side-by-side. Useful for parameter sensitivity analysis.

**4.4 — Export results**
Add "Export CSV" / "Export PDF" buttons to results panels. Use html2canvas for PDF, and structured JSON→CSV for tabular data.

**4.5 — Execution parameters display**
Show what design parameters were used for each execution (cohort IDs, outcome definitions, time-at-risk windows) in a collapsible panel on the results tab.

### Phase 5: Design Improvements (Priority: Low)

**5.1 — IncidenceRateResults CSS migration**
The ForestPlot sub-component inside IncidenceRateResults still uses legacy CSS variables (`var(--primary)`, `var(--text-secondary)`, `var(--border-subtle)`) instead of inline Tailwind. Should be migrated for consistency.

**5.2 — Characterization results**
CharacterizationResults currently renders a FeatureComparisonTable. Add:
- Covariate distribution histograms
- Time-series prevalence trends
- Summary statistics cards (N, mean age, % female)

**5.3 — SCCS enhancements**
- Add age/season adjustment options to design
- Add spline visualization for non-linear exposure effects
- Add pre-exposure trend test results

---

## Technical Debt

1. ~~**6 copies of `fmt()`/`num()`** — Extract to shared module~~ ✅ Done — `@/lib/formatters.ts`
2. **IncidenceRateResults uses CSS component classes** — The `ForestPlot` sub-component uses `panel`, `panel-title` CSS classes. Migrate to inline Tailwind
3. **No loading state for execution history** — When switching between executions, there's no visual feedback
4. **Execution polling interval** — 2s may be too aggressive for production. Consider adaptive polling (2s → 5s → 10s)
