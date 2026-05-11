# SP3 — Analysis Module Gallery — close-out

**Date:** 2026-04-16
**Branch:** main
**Outcome:** All 4 CO2 modules ship on bespoke-SQL workers; CO2AnalysisModules
no longer on the hot path. UI fixture tests green.

---

## Decision: Option C2 — bespoke SQL for every module

`CO2AnalysisModules::execute_*` was designed for the upstream Shiny flow. Three
distinct blockers surfaced when calling those functions directly from our
Plumber endpoints:

1. `execute_*` returns a **path string** to `analysisResults.duckdb`, not the
   list of tibbles the historical wrappers assumed. Cost of fixing alone:
   moderate — open the duckdb and read tables.
2. Inside `execute_CodeWAS`, the assertion `nCasesEntries != nCasesTotal` reads
   from `cohortTableHandler$getCohortCounts()`. That returns an empty tibble
   unless `cohortDefinitionSet` was registered on the handler via the Shiny
   `mod_cohortSelector` flow. Staging rows into `finngen_cohort` doesn't
   register them on the handler — only `insertOrUpdateCohorts()` would, which
   re-executes the cohort generation SQL through `CohortGenerator`.
3. `execute_timeCodeWAS` rejects `temporalStartDays`/`temporalEndDays` outright
   with `assertAnalysisSettings_timeCodeWAS` and wants a different `time_windows`
   shape that the upstream module wires up internally — also gated behind the
   same Shiny lifecycle.

Tried option A (Shiny-parity `analysisSettings` shapes) for Demographics — it
worked because Demographics doesn't touch the handler-state validators. CodeWAS
and Overlaps both hit blocker #2 even with perfect settings.

**Conclusion:** rewrite all four workers as direct SQL on the source's
`{cdmSchema}` / `{cohortSchema}`, mirroring how SP2's Code Explorer sync reads
already bypass ROMOPAPI internals. CO2AnalysisModules stays linked for now but
is dead weight in our hot path.

## What landed

| Module           | Worker                                                    | Smoke (PANCREAS)                                                               |
|------------------|-----------------------------------------------------------|---------------------------------------------------------------------------------|
| Demographics     | duckdb read of `demographicsCounts` from CO2 output       | Cohorts 221/222/223; mean=80.4 / median=75 for 221                              |
| Cohort Overlaps  | 3 direct queries: sizes, names, STRING_AGG membership     | 221/222/223 sets sized 361/146/142; full 3-way intersection = 51                |
| CodeWAS          | UNION ALL across 4 OMOP domains × case+control(no-overlap)| 222 vs 223: 49 concepts tested, 7 Bonferroni-significant; FOLFIRINOX drugs in control, gemcitabine in case |
| timeCodeWAS      | Same as CodeWAS, parameterized per `[start_day, end_day]` | 222 vs 223 over [-365,-1]/[0,30]/[31,365]: 2/46/41 concepts, 15 sig total       |

All 4 emit `display.json` shapes that match the existing TypeScript types. R
returns from CO2's `execute_*` no longer touched in any worker.

## Plumbing also fixed during smoke

- `RunFinnGenAnalysisJob::extractArtifacts` was missing `display.json` and
  `codeWASCounts.csv` from its candidates list. Frontend was getting
  `artifacts: []` on green runs and couldn't fetch displays.
- Race: Darkstar reports terminal HTTP status before the shared volume has
  flushed all output files. Added a ~1s poll for `result.json` (which our
  workers write last) before scanning.
- jsonlite serialized `NA_real_` as the string `"NA"`. Added `na = "null"` to
  `.write_summary` / `.write_display` so TS sees `null` and the defensive
  `typeof === "number"` guard in `DemographicsResults` works.
- Demographics worker was hard-coding `mean_age = NA_real_, median_age = NA_real_`.
  Now computes both from decile midpoints (decile×10+5) weighted by per-decile
  count.
- jsonlite gotcha: `time_windows = [[s,e],...]` auto-simplifies to an N×2
  matrix. timeCodeWAS now normalizes back to a list of 2-element vectors
  before per-row indexing.
- jsonlite gotcha: single-element vectors auto-unbox to scalars. Wrapped
  `members` with `I()` so degree=1 intersections still emit JSON arrays.

## Acceptance evidence in repo

`frontend/src/features/finngen-analyses/__tests__/sp3-real-display-fixtures.test.tsx`
loads the actual `display.json` from succeeded smoke runs (committed under
`__tests__/fixtures/`) and asserts:

- Render-path: ResultViewerSwitch consumes Demographics / CodeWAS / timeCodeWAS
  fixtures without runtime errors.
- Shape-validation for Overlaps: catches the `I(members)` array-emit fix via
  `ix.degree === ix.members.length` and asserts every other field matches
  `OverlapsDisplay`. (UpSet's jsdom render is brittle, so we skip the live
  render and trust the shape contract.)

All 4 tests green: `vitest run sp3-real-display-fixtures.test.tsx → 4 passed`.

## Known follow-ups (non-blocking, file separately)

1. Cohort name fallback in Overlaps — `parthenon_finngen_rw` lacks SELECT on
   `app.cohort_definitions`, so display shows `"Cohort 221"` instead of the
   real name. Either grant SELECT or pass names through the dispatch payload.
2. Nginx SPA fallback for `/finngen/runs/{id}` returns 500 (rewrite loop) —
   pre-existing infra issue surfaced during the UI smoke attempt; the route
   is not rendered from a standalone URL anyway (it's a tab inside the
   investigation panel), so frontend behavior is unaffected.
3. Pre-commit PHPStan check uses `--memory-limit=512M` and OOMs; passes at 1G.
   Same gotcha called out in `ecb41a8d5`. Hook should bump to 1G.
4. Upstream issues filed at FINNGEN/CO2AnalysisModules: #199 (Demographics
   referenceYear), #200 (Overlaps cohortIdCombinations).

## Commits in scope

```
6564c419a fix(finngen): SP3 CodeWAS + Overlaps — bespoke SQL workers (option C2)
e3a09f380 fix(finngen): SP3 timeCodeWAS — bespoke SQL worker (completes option C2)
c6c5ba055 fix(finngen): SP3 close-out — artifacts race + Demographics summary + fixture tests
```

(Plus the cluster of CI fixes that landed in parallel — `ecb41a8d5`,
`39be6827c`. Those weren't strictly SP3 but were on the critical path to a
green pipeline before sprint close.)
