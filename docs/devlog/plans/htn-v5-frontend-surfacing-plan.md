# HTN v5 — Frontend Result-Surfacing Plan (detailed todo)

**Author:** Sanjay M. Udoshi, MD (plan drafted by Claude)
**Date:** 2026-07-04
**Scope:** Surface every result the Hypertension Outcomes Program **v5** produces (analyses A–R + triangulation) in the Parthenon React frontend — not just the standalone HTML report.
**Study:** `app.studies.id = 165`, slug `hypertension-study-v4`, `analysis_plan_version → v5.0`.
**Source docs:** `docs/research/CLAUDE_PROMPT_v5.md` (executable spec), `docs/research/CHANGELOG_v4_to_v5.md` (deep diff).
**Branch:** `feature/htn-v5-frontend-surfacing` from `main`.

---

## 0. What "surface V5 results" means

v5 emits results in **three physical places**. Each needs a frontend path:

| Producer | Physical location | Grain | Frontend path today | Gap |
|---|---|---|---|---|
| Per-analysis summaries (A–R, triangulation) | `app.study_analyses.summary_data` → projected to `app.study_results.summary_data` (JSONB) | 1 row / analysis × result_type | **Results tab** (`StudyResultsTab`) → expand → `StudyResultSummary` | Only 3 shapes render; M/N/P/Q/R/triangulation dump raw JSON |
| Long-form result tables | `results.htn_v4_{m,n,o,p,q,r}_*`, `results.htn_v4_triangulation` | 1 row / (morbidity×group×epoch), (member×timepoint), (site), (grid cell)… | **none** | No API to read a `results.*` study table; too big for `summary_data` |
| Report + provenance artifacts | `htn_v5_report.{html,pdf}`, `analysis_plan_v5.0.lock.json`, `v5-reuse-manifest.md` | files | **Artifacts tab** (`StudyArtifactsTab`) download only | No embedded/interactive report; no lock-hash surfacing |

**Design decision (recommended): three complementary layers, not one.**

1. **Layer 1 — extend the generic pipeline.** Teach the projector + `StudyResultSummary` the seven new v5 shapes so each analysis renders correctly inside the existing Results tab (chips, expand, mark-primary/publishable, Ask-Abby, synthesis all keep working for free). This is the backbone.
2. **Layer 2 — long-form table reader.** One generic, permissioned, paginated + CSV endpoint to read whitelisted `results.htn_v4_*` rows, so the big matrices (M/N/Q/R) render as real interactive tables/heatmaps and download as CSV (the prompt requires CSV for M and N).
3. **Layer 3 — assembled "v5 Report" surface.** A new sub-tab under the **Evidence** group that composes the headline **triangulation figure (O/P/R)**, ATO forest/love plots, M heatmap, N ridgelines, Q robustness panel, negative-control calibration, **Lu 2025 PASS/FAIL/N-A**, and the **V&V acceptance matrix** — mirroring the HTML report structure natively in React, palette-correct, with the lock hash in the header.

Reuse-first: the SVG chart components below already exist and are self-contained (no new chart library).

| v5 need | Reuse this existing component | Path |
|---|---|---|
| O / G / H / triangulation forest | `ForestPlot` (`estimates: EstimateEntry[]`, `predictionInterval`) | `frontend/src/features/estimation/components/ForestPlot.tsx` |
| O love plot (SMD before/after ATO) | `LovePlot` (`data: CovariateBalanceEntry[]`) | `frontend/src/features/estimation/components/LovePlot.tsx` |
| O propensity/overlap distribution | `PropensityScorePlot` | `frontend/src/features/estimation/components/PropensityScorePlot.tsx` |
| P cumulative-incidence curves | `KaplanMeierPlot` (`targetCurve/comparatorCurve: KaplanMeierPoint[]`) | `frontend/src/features/estimation/components/KaplanMeierPlot.tsx` |
| Negative-control calibration + EASE | `CalibrationPanel`, `SystematicErrorPlot` | `frontend/src/features/estimation/components/` |
| M prevalence heatmap | `HeatmapChart` | `frontend/src/features/data-explorer/components/charts/HeatmapChart.tsx` |
| N distribution / violin+box | `BoxPlotChart` | `frontend/src/features/data-explorer/components/charts/BoxPlotChart.tsx` |

New-build charts (no reuse candidate): **ridgeline (KDE)** for N, **paired-arrow trellis** (t1→t2→t_dx) for N. Both are small D3/SVG components; D3 7.9 is already a dependency.

---

## Phase 1 — Backend: v5 result-type taxonomy + projector normalizers

Goal: every v5 analysis lands in `app.study_results` with a compact, chart-ready `summary_data` and a new `result_type` the frontend can switch on.

- [ ] **1.1 Add v5 `result_type` constants.** Extend the result-type taxonomy (wherever `effect_estimate|incidence_rate|characterization|pathway|prediction_performance|sccs|custom` is enumerated — check `app/Models/App/StudyResult.php`, `StudyResultProjector`, and any `ResultType` enum/const) with: `overlap_weighted_effect` (O), `target_trial` (P), `comorbidity_matrix` (M), `bp_distribution` (N), `phenotype_robustness` (Q), `instrumental_variable` (R), `triangulation`.
- [ ] **1.2 Extend `StudyResultProjector::buildRows()`** (`backend/app/Services/Studies/StudyResultProjector.php`) to recognize the v5 analysis FQCNs / `analysis_type` slugs and emit one `study_results` row each with the compact `summary_data` contract in §Appendix A. **Keep long-form rows OUT of `summary_data`** — store only the headline scalars, the small arrays needed to draw a chart (≤ a few hundred points), and a `result_table` pointer (schema-qualified table name + the filter columns) for anything larger. Preserve `is_primary` on re-projection (existing behavior).
- [ ] **1.3 Publishability gating for O/P/R.** These are comparative effects → gate `is_publishable` on the estimability gates (weighted |SMD| < 0.1, equipoise ≥ 0.3, calibrated-null centered) exactly as v4 gated G4-vs-G1. When a gate fails, project the row with `summary_data.estimable=false` + `summary_data.gates=[…]` and `is_publishable=false` (withheld, not missing). M/N/Q descriptive → `is_publishable=true`.
- [ ] **1.4 Triangulation row.** Project `results.htn_v4_triangulation` into a single `result_type='triangulation'` row whose `summary_data` carries the O/P/R estimates side-by-side + each design's estimability status + the concordance verdict (`concordant|divergent` + most-credible design).
- [ ] **1.5 Reproject wiring.** Confirm `POST /studies/{study}/results/reproject` (`StudyResultController::reproject`) picks up the new rows; the `StudyHtnV4 --action=run` command (Phase 5) should call the projector on completion.
- [ ] **1.6 Tests (Pest).** `backend/tests/` — projector emits the 7 new types; O withheld-vs-cleared both project correctly; no PHI/`person_id` in `summary_data`. Run `vendor/bin/pint` + `phpstan analyse` (level 8, no new baseline entries).

## Phase 2 — Backend: long-form `results.htn_v4_*` table reader

Goal: a safe, generic way for the frontend to page through and export the big v5 tables (M matrix, N distribution, Q grid, R instrument).

- [ ] **2.1 New endpoint.** `GET /api/v1/studies/{study}/result-tables/{key}` returning paginated rows, plus `GET …/result-tables/{key}.csv` for download. Add to the `studies/{study}` route group in `backend/routes/api.php` (~L869–893) under `permission:studies.view`.
- [ ] **2.2 Whitelist, don't interpolate.** Map a small set of `key` slugs → fixed table names so no user string ever reaches SQL: `comorbidity-matrix→results.htn_v4_m_comorbidity_matrix`, `bp-distribution→…_n_bp_distribution`, `bp-summary→…_n_bp_summary`, `phenotype-grid→…_q_phenotype_grid`, `iv-instrument→…_r_instrument`, `triangulation→…_triangulation`. Reject anything not in the map (404).
- [ ] **2.3 Read path.** Query via the `results` connection (or a thin `ResultsModel` subclass); support server-side filter params (e.g. `morbidity`, `group`, `epoch`, `timepoint`, `phenotype_variant`) and `page`/`per_page`. **Never** select `person_id`/MRN columns — project only group-level aggregate columns (enforce a column allow-list per table; the R-instrument table is member-grain, so expose only aggregated/binned views, not raw member rows).
- [ ] **2.4 Controller.** New `StudyResultTableController` (thin) or a method on `StudyResultController`. Group-level aggregates only in any egress (HIGHSEC §7).
- [ ] **2.5 Tests (Pest).** Whitelist rejects unknown keys; pagination; CSV headers; asserts no PHI columns leak. Pint + PHPStan.

## Phase 3 — Backend: artifacts, lock hash, OpenAPI

- [ ] **3.1 Report + lock as artifacts.** Ensure the `StudyHtnV4 --action=report`/`lock` steps register `htn_v5_report.html`, `htn_v5_report.pdf`, and `analysis_plan_v5.0.lock.json` as `study_artifacts` rows (they already download via `StudyArtifactController::download`). Add `metadata.sha256` for the lock so the frontend can show it.
- [ ] **3.2 Lock-hash accessor.** Expose the v5 lock hash + verification status (matches rendered report?) on the study `show` payload or a tiny `GET …/lock` endpoint, for the report header badge.
- [ ] **3.3 Regenerate OpenAPI + types.** `./deploy.sh --openapi` → refresh `frontend/src/types/api.generated.ts` so the new result_types, `result-tables` shapes, and lock fields are typed. Do **not** hand-edit the generated file.

## Phase 4 — Frontend: per-analysis renderers (Layer 1)

Goal: expand `StudyResultSummary` so each v5 result type renders with the right chart instead of a JSON dump. All under `frontend/src/features/studies/components/`.

- [ ] **4.1 Router switch.** In `StudyResultSummary.tsx` add `case` arms for the 7 new types dispatching to new sub-components (below). Keep `GenericView` as the final fallback. Add the labels to `RESULT_TYPE_LABELS` in `StudyResultsTab.tsx` and the `studies.results.resultTypes.*` i18n namespace.
- [ ] **4.2 `OverlapWeightedEffectView` (O).** Headline timely-vs-delayed HR (MACE, CKD) + 5-yr risk difference + E-value; reuse `ForestPlot` for the effect + secondary 4-group gradient, `LovePlot` for SMD-before/after-ATO, `PropensityScorePlot` for overlap. **Estimability-gate banner**: if `estimable=false`, render a prominent "withheld — gate X failed" state (do not show a blinded estimate). Reuse `EffectEstimateView`'s calibrated-HR table + EASE note.
- [ ] **4.3 `TargetTrialView` (P).** Per-protocol HR (grace 90d; 30/180 sensitivity toggle) + 5-yr risk difference; reuse `KaplanMeierPlot` for cumulative-incidence by strategy; IPCW weight-distribution mini-histogram (flag if max stabilized weight > 10); **immortal-time check badge** (PASS/FAIL from `summary_data`).
- [ ] **4.4 `InstrumentalVariableView` (R).** First-stage **F** (with ≥10 interpretability flag), LATE (MACE, CKD) via `ForestPlot`, tertile-balance falsification mini-table, negative-control-on-instrument null check. Prominent "triangulation only — never sole basis" caveat.
- [ ] **4.5 `ComorbidityMatrixView` (M).** Reuse `HeatmapChart` for the prevalence heatmap (17 morbidities × 6 populations); compact top-line table (Wilson CIs, adjusted OR vs C); "View full matrix" → opens the Phase-6 long-form table drawer; CSV download button.
- [ ] **4.6 `BpDistributionView` (N).** Summary stats table (mean/SD/median/IQR/skew/kurtosis per group×timepoint); **ridgeline** (new KDE component) per group per timepoint; violin+box via `BoxPlotChart` comparing t_dx across groups; **paired-arrow trellis** (t1→t2→t_dx, new small SVG); below-trigger (RTM/white-coat) fraction callout; CSV download.
- [ ] **4.7 `PhenotypeRobustnessView` (Q).** The 90%-headline sensitivity: never-diagnosed fraction across the index-rule × threshold × max-gap grid (heatmap or small-multiples); **visit-linked vs measurement-only split** (the 37.9% encounter-coverage finding — NEW-17); E-values for O/P headline effects; QBA bias-adjusted interval.
- [ ] **4.8 `TriangulationView` (headline).** Side-by-side O (ATO) / P (target-trial) / R (IV) via a single grouped `ForestPlot` (or three aligned rows), each with its estimability status; concordance verdict banner + most-credible-design flag. This is the study's headline causal figure.
- [ ] **4.9 New chart primitives.** `RidgelinePlot.tsx` and `PairedArrowTrellis.tsx` under `frontend/src/features/studies/components/charts/` (D3 7.9, self-contained SVG, palette-correct). Unit tests (Vitest) for scale/empty-data.
- [ ] **4.10 Types + Zod.** Add v5 `summary_data` shapes to `frontend/src/features/studies/types/study.ts` and Zod schemas (`schemas/`). No `any` — narrow `unknown`. Recharts tooltip `formatter as never` where used.

## Phase 5 — Frontend: long-form table drawer + hooks (Layer 2)

- [ ] **5.1 API + hooks.** Add `getStudyResultTable(slug, key, params)` + `downloadStudyResultTableCsv` to `frontend/src/features/studies/api/studyApi.ts`; TanStack Query hook `useStudyResultTable` in `hooks/useStudies.ts`.
- [ ] **5.2 Reusable table drawer.** `StudyResultTableDrawer.tsx` — paginated, filterable (server-side params), CSV download; TanStack Table if the studies feature already uses it, else a simple table. Opened from M/N/Q/R "view full …" buttons.
- [ ] **5.3 Guardrail.** Drawer never requests member-grain columns; only the whitelisted aggregate views from Phase 2.

## Phase 6 — Frontend: assembled "v5 Report" surface (Layer 3)

Goal: a native, palette-correct report view that mirrors `htn_v5_report.html` §7 requirements.

- [ ] **6.1 New tab.** Add a `report` tab to the **Evidence** `TAB_GROUPS` block in `StudyDetailPage.tsx` (`TabKey`, `TAB_GROUPS`, `ALL_TABS`, render line ~505, i18n `studies.detail.tabs.report`). Gate its visibility to studies that have v5 results (e.g. slug `hypertension-study-v4` with `analysis_plan_version=v5.0`, or presence of a `triangulation` result) so it doesn't appear on unrelated studies.
- [ ] **6.2 `StudyV5ReportTab.tsx`.** Compose, top-to-bottom: header with **`analysis_plan_v5.0` lock hash** + verification badge; **triangulation figure** (from 4.8) as the headline; ATO forest + love (O); M heatmap; N ridgelines/violin/trellis; Q phenotype-robustness panel + E-values; per-family negative-control calibration plots + EASE; **Lu 2025 PASS/FAIL/N-A** panel (Analysis F); **V&V acceptance matrix** panel.
- [ ] **6.3 `VvAcceptanceMatrix.tsx`.** Render the 9 V&V rows from the prompt §8 (estimand robustness, positivity handling, lock integrity, negative-control coverage, reproducibility, governance, external validity, sensitivity transparency) with PASS/PRESENT/MISSING status pulled from result diagnostics.
- [ ] **6.4 Palette + Arial.** Acumenus tokens (crimson `#9B1B30`, dark `#0E0E11`, gold `#C9A227`, teal `#2DD4BF`) — use existing CSS vars; match the dark clinical theme.
- [ ] **6.5 Fallback link.** If the standalone `htn_v5_report.html` artifact exists, surface an "Open full HTML report" / "Download PDF" affordance (via `StudyArtifactController::download`) alongside the native view.

## Phase 7 — Frontend: wiring, i18n, tests, build

- [ ] **7.1 i18n.** Add all new keys to the `app` translation namespace (`studies.results.resultTypes.*`, `studies.v5report.*`, chart labels). No hardcoded strings.
- [ ] **7.2 Vitest.** Unit tests for each new view (withheld-O state, immortal-time badge, triangulation concordance, ridgeline empty-data, table drawer pagination). Target ≥80% on new components.
- [ ] **7.3 Build gates.** `npx tsc --noEmit` **and** `npx vite build` (vite is stricter — catches UNRESOLVED_IMPORT). ESLint clean. `Pick<T,…>` for component props where only a subset is needed.
- [ ] **7.4 Manual QA.** Load study 165 → Results tab renders all A–R rows with correct charts (no JSON dumps); Report tab renders triangulation + V&V matrix; long-form drawers page + export CSV; withheld O shows the gate banner, not a number.

## Phase 8 — Build the v5 study data (prerequisite / parallel track)

The renderers are inert without data. This is the executor work from `CLAUDE_PROMPT_v5.md` §2–§5 — sequence it so at least a smoke dataset exists to develop against.

- [ ] **8.1 `StudyHtnV4` command.** Create `backend/app/Console/Commands/StudyHtnV4.php` with `--action={reuse-audit,concept-sets,cohorts,analyses,lock,run,report}` + `--version=v5` (does not exist yet — net-new per changelog §4.1).
- [ ] **8.2 Run analyses M–R + triangulation** against the `omop` source; write `results.htn_v4_*` tables; persist `analysis_plan_v5.0.lock.json` **before** run; project into `study_results`.
- [ ] **8.3 Reconcile** the v4 baseline facts (T=109,763; never-diagnosed 90%; latency_b 1,106d; CKD HR 2.60) — any deviation >0.1% investigated.
- [ ] *(If executing the full study is out of scope for the frontend task, seed a representative fixture into `results.htn_v4_*` + `study_results` so Phases 4–6 can be built and demoed. Mark fixtures clearly as non-production.)*

## Phase 9 — Deploy + devlog

- [ ] **9.1** `make lint` + `make test` green; PHPStan level 8 clean; `vite build` succeeds.
- [ ] **9.2** `./deploy.sh --openapi` then `./deploy.sh --frontend` (prod serves `frontend/dist/`).
- [ ] **9.3** Devlog under `docs/devlog/modules/` (studies) — what shipped, screenshots of the Report tab.
- [ ] **9.4** Conventional-commit on `feature/htn-v5-frontend-surfacing`; PR to `main` with test plan.

---

## Appendix A — compact `summary_data` contracts (Phase 1.2)

Chart-ready only; long-form stays in `results.htn_v4_*` and is fetched via Phase 2.

```jsonc
// overlap_weighted_effect (O)
{ "estimable": true, "gates": {"max_smd": 0.06, "equipoise": 0.41, "null_centered": true},
  "estimates": [{"outcome_name":"MACE","hazard_ratio":..,"ci_95_lower":..,"ci_95_upper":..,"e_value":..}, {"outcome_name":"CKD",...}],
  "risk_difference_5y": {...}, "gradient": [{group:1..4, hr:..}],
  "balance": [{covariate, smd_before, smd_after}], "calibration": {ease:.., informative_negative_controls:..} }

// target_trial (P)
{ "grace_days": 90, "estimates":[{outcome_name, hazard_ratio, ci_95_lower, ci_95_upper, risk_diff_5y}],
  "km": {"strategyA":[{time,surv,nAtRisk,nEvents}], "strategyB":[...]},
  "ipcw": {"max_stabilized_weight":.., "flag": false}, "immortal_time_check":"PASS" }

// instrumental_variable (R)
{ "first_stage_f": 14.2, "interpretable": true,
  "late":[{outcome_name,estimate,ci_95_lower,ci_95_upper}],
  "tertile_balance":[{covariate, t1, t2, t3, balanced}], "nc_on_instrument_null": true, "n_sites": 521, "coverage_pct": 37.9 }

// comorbidity_matrix (M)  — heatmap cells + pointer to full table
{ "heatmap":[{morbidity, population, prevalence, wilson_lo, wilson_hi}], "result_table":"comorbidity-matrix" }

// bp_distribution (N)  — summary cells + pointer
{ "summary":[{group, timepoint, measure:"SBP"|"DBP", n, mean, sd, median, q1, q3, skew, kurt}],
  "kde":[{group,timepoint,measure,points:[[x,density]]}], "below_trigger_fraction":.., "result_table":"bp-distribution" }

// phenotype_robustness (Q)
{ "grid":[{index_rule, threshold, max_gap, never_dx_fraction, n, median_latency}],
  "visit_split":{"visit_linked":{never_dx,mace,ckd}, "measurement_only":{...}},
  "e_values":{mace:.., ckd:..}, "qba_interval":[lo,hi], "result_table":"phenotype-grid" }

// triangulation
{ "designs":[{name:"O (ATO)", hr_mace, hr_ckd, estimable, gate_status},
             {name:"P (target trial)", ...}, {name:"R (IV)", ...}],
  "concordance":"concordant", "most_credible":"O" }
```

## Appendix B — key files

- Detail page / tabs: `frontend/src/features/studies/pages/StudyDetailPage.tsx`
- Results tab: `frontend/src/features/studies/components/StudyResultsTab.tsx`
- Result renderer (switch): `frontend/src/features/studies/components/StudyResultSummary.tsx`
- Hooks / API / types: `frontend/src/features/studies/{hooks/useStudies.ts, api/studyApi.ts, types/study.ts}`
- Reusable charts: `frontend/src/features/estimation/components/*`, `frontend/src/features/data-explorer/components/charts/*`
- Projector: `backend/app/Services/Studies/StudyResultProjector.php`
- Result controller / model: `backend/app/Http/Controllers/Api/V1/StudyResultController.php`, `backend/app/Models/App/StudyResult.php`
- Routes: `backend/routes/api.php` (studies group ~L819–893)
- Study command (net-new): `backend/app/Console/Commands/StudyHtnV4.php`

## Appendix C — guardrails (must hold)

- HIGHSEC: all new routes `auth:sanctum + permission:studies.view` (read) / `studies.execute` (run/reproject). No unauthenticated path to cohort/PHI data.
- No `person_id`/MRN/PHI in `summary_data`, API responses, CSV exports, or logs — group-level aggregates only.
- `CdmModel` read-only; writes only to `app.*`, `results.htn_v4_*`, `php.*`.
- Pint (Docker) after every PHP edit; PHPStan level 8, no new baseline; `tsc --noEmit` **and** `vite build`.
- Withheld estimates (failed gates) render as an explicit withheld state — never a blinded/silent number.
```
