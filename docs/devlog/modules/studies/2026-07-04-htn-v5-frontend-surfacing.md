# HTN v5 — Frontend Result Surfacing

**Date:** 2026-07-04
**Branch:** `feature/htn-v5-frontend-surfacing`
**Study:** `app.studies.id = 165` (`hypertension-study-v4`)

## Goal

Surface every result of the Hypertension Outcomes Program **v5** (analyses M–R +
triangulation from `docs/research/CLAUDE_PROMPT_v5.md`) natively in the React
studies module — not just as a standalone HTML/PDF report.

## Key finding

v5 has **not been executed**. Study 165 carried only its four **v4** results
(`characterization`, `effect_estimate`×2, `incidence_rate`); there were zero
`results.htn_v4_*` tables and no M–R/triangulation rows anywhere. So the task was
to build the full surfacing pipeline and drive it with a **representative,
clearly-labelled demonstration fixture** (the Phase-8 fallback in the plan) —
grounded in the real v4 baseline facts (T = 109,763; never-dx ≈ 90%;
latency_b ≈ 1,106 d; CKD HR ≈ 2.60; 37.9% encounter coverage). Every fixture row
carries `_fixture: true` + `_provenance`, and the UI renders an explicit
"Demonstration data" banner on every figure so the numbers can never be mistaken
for a real v5 finding.

## What shipped

### Backend
- `SeedHtnV5Fixture` command (`study:seed-htn-v5-fixture`) — idempotent; writes
  7 curated `app.study_results` rows (one per v5 analysis) with compact,
  chart-ready `summary_data`, plus the long-form `results.htn_v4_*` tables.
  Comparative designs (O/P/R) carry estimability gates; IV (R) is withheld from
  publish (`is_publishable=false`) as designed. Pint + PHPStan L8 clean; uses the
  sanctioned `SourceAware` trait (no direct `DB::connection('results')`).
- `scripts/sql/htn-v5-fixture-tables.sql` — owner-run DDL + grants for the
  `results.htn_v4_*` tables (the runtime role `parthenon_app` has USAGE but no
  CREATE on the results schema; owner creates, app populates/reads).

### Frontend (`frontend/src/features/studies/components/`)
- 7 per-analysis renderers under `v5/` dispatched from `StudyResultSummary`'s
  switch: `OverlapWeightedEffectView` (O), `TargetTrialView` (P),
  `InstrumentalVariableView` (R), `ComorbidityMatrixView` (M),
  `BpDistributionView` (N), `PhenotypeRobustnessView` (Q), `TriangulationView`.
- Reuses existing self-contained SVG charts (`ForestPlot`, `LovePlot`,
  `KaplanMeierPlot`, `HeatmapChart`) via small adapters (`v5/narrow.ts`,
  `v5/charts/chartAdapters.ts`) that fill the required `EstimateEntry` /
  `CovariateBalanceEntry` / `KaplanMeierPoint` fields from the compact payloads.
- Two net-new primitives: `RidgelinePlot` (KDE) and `PairedArrowTrellis`
  (t₁→t₂→t_dx) for Analysis N.
- `StudyV5ReportTab` (Layer 3) — assembled native report composing the
  triangulation headline, ATO/target-trial/IV designs, descriptive matrices, and
  a derived `VvAcceptanceMatrix` (V&V §8). Gated to studies that have a
  `triangulation` result, wired into the Evidence tab group in `StudyDetailPage`.
- Estimability withholding: failed gates render an explicit withheld banner,
  never a blinded number.
- M/N/Q "view full" + CSV export render client-side from `summary_data` (which
  already carries the full arrays), so no PHI-bearing member-grain egress.

## Verification
- Backend: `pint` + `phpstan --level=8` clean; seeder run verified 7 study_results
  rows + long-form counts (matrix 102, bp 18, grid 12, instrument 12,
  triangulation 6).
- API: `GET /studies/hypertension-study-v4/results` returns all 11 rows with the
  7 v5 types, correct `_fixture` flag and publishability gating.
- Frontend: `tsc --noEmit` clean, `vite build` clean, `eslint` clean, `vitest`
  14/14 (adapter + narrowing logic).

## Follow-up — real executor + real Analysis M (same day)

Built `study:htn-v4` (`StudyHtnV4` command, CLAUDE_PROMPT_v5 §2) and ran the one
analysis genuinely computable in this environment: **Analysis M (comorbidity
matrix), descriptive core**, from the live CDM.

- Morbidity concepts resolved from **verified** `app.concept_sets` seed roots via
  `vocab.concept_ancestor` descendant expansion (standard OMOP resolution — no
  guessed concept ids). Four morbidities have verified sets: Diabetes (55), Heart
  failure (176), CKD (186), Primary aldosteronism (191).
- Per morbidity × 6 real populations (G1–G4, never-diagnosed, comparator C from
  `results.cohort`) × 2 epochs (pre-existing / newly-occurring vs the member's
  index date): real count + prevalence + **Wilson 95% CI**. 24 real rows → real
  `results.htn_v4_m_comorbidity_matrix`; the `comorbidity_matrix` study_results
  row is now `data_source=cdm` (fixture flag dropped) and the UI shows a green
  "Real CDM data" note listing the pending morbidities.
- Sanity: CKD 9–13% in the diagnosed delay groups vs 0.5% never-diagnosed / 0.4%
  comparator; diabetes shows the expected gradient — clinically coherent.
- Query is index-driven (`idx_co_concept_person`), ~0.2 s per morbidity, no
  `measurement` value-scan, no R. Pint + PHPStan L8 clean.

### Hard environmental blockers (why the rest stays fixture)
- **The R / HADES runtime is absent from this compose stack** (`r-runtime` = "no
  such service"). That makes **O (ATO), P (target-trial + IPCW), R (site IV /
  2SRI), F/G/H (survival), N (BP distribution), and Analysis M's adjusted ORs**
  impossible to run here — they are the statistical heart of v5. The command logs
  an explicit skip rather than fabricating estimates.
- The remaining 13 spec morbidities need concept-set materialisation (verified
  roots), not guesswork.

**To finish v5 for real:** provision the R/HADES runtime (WeightIt/PSweight,
survival, IPCW, 2SRI), materialise the 17 morbidity concept sets, then extend
`study:htn-v4 --action=run` to author the R payloads via `StudyDesignToolRunner`.
This is a statistically-sensitive execution that warrants review before it runs
against the 1M-patient clinical CDM.

## Deferred / follow-up
- Generic source-scoped long-form table-reader endpoint (Layer 2 server side) —
  not needed for the fixture (summary_data carries the full arrays); the
  `results.htn_v4_*` tables + DDL script are the substrate for it.
- Full v5 executor (`StudyHtnV4` per CLAUDE_PROMPT_v5 §2) — when it runs, the same
  renderers display the real rows; the projector should learn the v5 analysis
  types so real executions project automatically.
- i18n: new strings use `defaultValue` fallbacks; add `app` namespace keys for
  full localisation.
