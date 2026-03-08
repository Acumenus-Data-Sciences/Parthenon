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

### Need execution (0 runs):
| Analysis | Type | R Backend |
|----------|------|-----------|
| ACE-I vs ARB for Hypertension | Estimation #2 | Ready |
| Statin Effect on CAD Outcomes | Estimation #3 | Ready |
| Heart Failure Readmission Risk | Prediction #2 | Ready |
| CKD Progression Risk Model | Prediction #3 | Ready |
| Statin Exposure and Myopathy | SCCS #2 | Ready |
| NSAID Exposure and GI Bleeding | SCCS #3 | Ready |
| New-Onset CKD in T2DM Patients | Incidence Rate #1 | Ready (StudyBridge) |
| Heart Failure Hospitalization Rate | Incidence Rate #2 | Ready (StudyBridge) |
| Meta-Analysis: Statin Cardioprotection | Evidence Synthesis #1 | Ready |
| Antihypertensive Treatment Pathway | Pathways #1 | **NO R backend** |
| T2DM Medication Escalation | Pathways #2 | **NO R backend** |

---

## v2 Enhancement Plan

### Phase 1: Remaining Crash Hardening (Priority: Critical)

**1.1 — Sub-component `.toFixed()` hardening**
The parent results components are now safe, but several child chart/plot components still call `.toFixed()` directly on props that could be `"NA"`:
- `ForestPlot.tsx` (estimation) — `entry.hazard_ratio.toFixed(2)`, `entry.p_value.toFixed(3)`
- `LovePlot.tsx` — `entry.smd_before.toFixed(3)`, `entry.smd_after.toFixed(3)`
- `PropensityScorePlot.tsx` — `auc.toFixed(3)`
- `SystematicErrorPlot.tsx` — `nc.log_rr.toFixed(3)`, `nc.se_log_rr.toFixed(3)`
- `PowerTable.tsx` — `entry.mdrr.toFixed(2)`, `entry.power_at_1_5`, `entry.power_at_2_0`
- `KaplanMeierPlot.tsx` — `logRankPValue.toFixed(3)`
- `ExternalValidationComparison.tsx` — `db.auc.toFixed(3)`, `db.brier_score.toFixed(4)`
- `EvidenceSynthesis/ForestPlot.tsx` — `site.hr.toFixed(2)`, `pooled.hr.toFixed(2)`
- `FeatureComparisonTable.tsx` — `row.smd.toFixed(3)`

**Action:** Extract `fmt()`/`num()` into a shared `@/lib/formatters.ts` utility and import across all components. Eliminates duplication (currently 6 copies of the same helpers).

**1.2 — Shared formatters module**
```typescript
// frontend/src/lib/formatters.ts
export function fmt(v: unknown, decimals = 3): string { ... }
export function num(v: unknown): number { ... }
export function fmtPct(v: unknown, decimals = 1): string { ... }
export function fmtCompact(n: number): string { ... }  // 1.2M, 3.4K
```

### Phase 2: Pathways R Backend (Priority: High)

Currently the only analysis type with NO R runtime implementation.

**2.1 — R endpoint for treatment pathways**
- Add `POST /pathway/execute` to `r-runtime/plumber_api.R`
- Use HADES `TreatmentPatterns` package (already installed in R container)
- Input: target cohort ID, event cohort IDs, min cell count
- Output: Sankey flow data + pathway table with percentages

**2.2 — Laravel controller integration**
- Add `PathwayAnalysisController::execute()` to call R runtime
- Store results in `analysis_executions.result_json`

### Phase 3: Execution Coverage (Priority: Medium)

Run all remaining seeded analyses to populate results:
1. Execute Estimation #2, #3 against Acumenus CDM
2. Execute Prediction #2, #3
3. Execute SCCS #2, #3
4. Execute Incidence Rate #1, #2
5. Execute Evidence Synthesis #1
6. Execute Pathways #1, #2 (after Phase 2)

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

1. **6 copies of `fmt()`/`num()`** — Extract to shared module
2. **IncidenceRateResults uses CSS component classes** — The `ForestPlot` sub-component uses `panel`, `panel-title` CSS classes. Migrate to inline Tailwind
3. **No loading state for execution history** — When switching between executions, there's no visual feedback
4. **Execution polling interval** — 2s may be too aggressive for production. Consider adaptive polling (2s → 5s → 10s)
