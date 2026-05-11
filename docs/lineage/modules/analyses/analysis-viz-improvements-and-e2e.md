# Analysis Visualization Improvements & E2E Test Suite

**Date:** 2026-03-08
**Branch:** feature/analysis-viz-improvements (merged to main via PR #16)

## What Was Built

### Analysis Visualization Improvements (8 Phases)

**Phase 1 — Shared Primitives:**
- `SignificanceVerdictBadge` — protective/harmful/not_significant pill from HR + p-value + CI
- `TrafficLightBadge` — green/amber/red indicator with configurable thresholds
- `ChartMetricCard` — labeled stat card for verdict dashboards
- `CIBar` — SVG horizontal confidence interval bar with null reference line
- `InterpretationTooltip` — toggle popover with plain + technical explanation
- Clinical utilities: `computeNNT`, `computeRateDifference`, `heterogeneityLabel`, `fmtP`

**Phases 2-7 — Verdict Dashboards (one per analysis type):**
- `EstimationVerdictDashboard` — HR, NNT/NNH, calibrated p-value
- `EvidenceSynthesisVerdictDashboard` — pooled effect, I² heterogeneity, site comparison
- `IncidenceRateVerdictDashboard` — IRD, IRR, stratified comparison
- `PredictionVerdictDashboard` — AUROC/calibration traffic-light scorecard, threshold slider
- `SccsVerdictDashboard` — risk window summary, pre-exposure trend test
- `CharacterizationVerdictDashboard` — balance summary, imbalance spotlight

**Phase 8 — Publish & Export System:**
- 3-step wizard: StudySelector → ReportPreview → ExportControls
- Multi-format export (.pdf, .docx, .xlsx, .png, .svg)
- Auto-generated Methods sections
- Single execution or full study scope
- Sidebar navigation integration

### Comprehensive E2E Test Suite

**25 test files, 286 tests passing, 3 skipped:**

| Tier | Coverage | Tests |
|------|----------|-------|
| 1 | Auth, navigation, API health, route coverage | ~98 |
| 2A | Data sources, explorer, vocabulary, ingestion | ~20 |
| 2B | Cohort definitions, concept sets, analyses list/detail | ~39 |
| 2C/2D | Studies, publish, patient profiles, specialized modules | ~40 |
| 3 | Admin, error handling, help system | ~50 |
| Existing | Smoke tests, screenshots, analysis pages | ~39 |

**Key infrastructure:**
- Shared helpers (`helpers.ts`): `assertPageLoads`, `collectErrors`, `dismissModals`, `apiGet`
- Global auth setup with onboarding modal dismissal
- Data-dependent skipping (tests gracefully skip when OMOP data unavailable)
- Separated data-env failures from real code bugs

## Bugs Fixed During E2E

- `computeRateDifference` wrong SE formula (single → split personYears)
- `computeNNT` float precision (=== 0 → Math.abs < 1e-10)
- CIBar log(0) crash (LOG_FLOOR = 0.001 clamp)
- `fmtP` NaN guard
- Onboarding modal blocking test interactions
- Register page selector mismatch (input#name)
- Session expiry test missing localStorage clear
- analysis-pages.spec.ts using wrong base URL

## Gotchas

- Onboarding modal (`modal-container`) intercepts pointer events on all pages — must mark `onboarding_completed=true` in global-setup or call `dismissModals()` before interactions
- `192.168.1.33` may not be reachable — always use `PLAYWRIGHT_BASE_URL=http://localhost:8082`
- Admin password hash can become corrupted (non-Bcrypt) — re-seed with `bcrypt('superuser')` via tinker
- Worktree agents creating duplicate shared primitives → merge conflicts resolved with `--ours`
