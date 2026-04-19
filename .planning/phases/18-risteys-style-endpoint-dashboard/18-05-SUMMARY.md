---
phase: 18
plan: 18-05
status: complete
wave: 3
completed_on: 2026-04-19
commits:
  - d7a0adaa9  # feat(18): co2 analysis R module (user-authored while executor agent hit Opus 1M credit cap)
  - TBD-routes # fix(18-05): add routes.R dispatcher entry + Plumber route for co2.endpoint_profile
---

# Plan 18-05 — Darkstar R Worker + Plumber Route Dispatcher

## Objective

Add `finngen_endpoint_profile_execute()` to `darkstar/api/finngen/co2_analysis.R` and wire it into `routes.R` so that `FinnGenRunService::create(analysis_type='co2.endpoint_profile', …)` reaches a real R worker.

## What Shipped

### Task 1 — R worker function (846 lines, appended to `co2_analysis.R`)
Authored manually by the user in commit `d7a0adaa9` on 2026-04-19 16:06 EDT, after the original executor agent hit the Opus 1M credit cap mid-run.

- Function signature: `finngen_endpoint_profile_execute(source_envelope, run_id, export_folder, analysis_settings)`
- Implements all 15 locked decisions D-01 through D-15 from CONTEXT.md:
  - **D-01 time-zero** — earliest qualifying event across condition/drug/procedure UNION branches
  - **D-02 event/censor** — `death.death_date` as event; `MAX(observation_period_end_date)` as censor
  - **D-03 age bins** — 5-year bins persisted as JSONB in `endpoint_profile_summary.age_at_death_bins`
  - **D-04 phi + OR** — vectorized via `Matrix::crossprod` (NOT per-pair `fisher.test`); Haldane-Anscombe OR for zero-cell handling
  - **D-05 universe filter** — `min_subjects` configurable, default 20
  - **D-14 drug window** — 90-day pre-index ATC3 via `vocab.concept` WHERE `vocabulary_id='ATC' AND concept_class_id='ATC 3rd'`, top-10 by cohort %; multi-parent ATC dedup via GROUP BY (subject_id, atc3_code) before subject count aggregate
  - **dual-mode cohort resolution** — `100_000_000_000 + generation_id` when FinnGen generation exists, else on-the-fly qualifying-event UNION expansion (Pitfall 1 from RESEARCH.md; numeric not integer since 100B > INT_MAX)
- Write-back uses `ON CONFLICT DO UPDATE` on `(endpoint_name, source_key, expression_hash)` composite key for all 4 tables in `{source}_co2_results`
- Validates `source_key` against `/^[a-z][a-z0-9_]*$/` regex before any schema interpolation (T-18-03 mitigation)

### Task 2 — Plumber route dispatcher (NEW in routes.R)
Two additions to `darkstar/api/finngen/routes.R`:
- `.build_worker` switch entry at L74-82 for `"finngen.co2.endpoint_profile"` → calls `finngen_endpoint_profile_execute` with standard 4-arg signature (source_envelope, run_id, export_folder, analysis_settings)
- Plumber annotation `#* @post /finngen/co2/endpoint-profile` at L320-324 → dispatches async via `.dispatch_async("finngen.co2.endpoint_profile", body, response)`

The user's `d7a0adaa9` commit added the R worker but did NOT update routes.R; without this follow-up commit, any dispatch from `EndpointProfileDispatchService` would have returned "Unknown FinnGen endpoint key" from the `stop()` fallback at L166.

## Files Modified

| File | Change | By |
|------|--------|-----|
| `darkstar/api/finngen/co2_analysis.R` | +846 lines (finngen_endpoint_profile_execute + helpers) | user (d7a0adaa9) |
| `darkstar/api/finngen/routes.R` | +15 lines (worker switch entry + Plumber route) | resume commit |

## Verification Evidence

- `grep -n 'finngen_endpoint_profile_execute' darkstar/api/finngen/co2_analysis.R` → L1640 (function def)
- `grep -n 'co2.endpoint_profile' darkstar/api/finngen/routes.R` → L74 (worker), L323 (dispatcher)
- `grep -n 'co2/endpoint-profile' darkstar/api/finngen/routes.R` → L320 (URL path)
- `darkstar/api/finngen/co2_analysis.R` line count: 1755 (was 909 pre-phase)
- Function line 1730: `analysis_type = "co2.endpoint_profile"` — matches `EndpointProfileDispatchService::ANALYSIS_TYPE` const on Laravel side

## Deployment Note

`docker compose restart darkstar` is required so Plumber re-reads routes.R and registers the new `/finngen/co2/endpoint-profile` endpoint. The R worker itself is bind-mounted and picks up immediately on next job dispatch without restart.

## REQ Coverage

- GENOMICS-09 (KM survival) — backed by `survival::survfit` call inside worker
- GENOMICS-10 (comorbidity matrix) — backed by `Matrix::crossprod` phi + Haldane-Anscombe OR
- GENOMICS-11 (drug-use timeline) — backed by ATC3 GROUP BY + 90-day window SQL

All three remain `pending` in REQUIREMENTS.md until Plan 18-07's live PANCREAS × E4_DM2 smoke demonstrates end-to-end closure.

## Deviations

- **Task ownership split** — Task 1 (R worker) executed by the user directly rather than via gsd-executor agent (credit cap hit mid-session). Task 2 (routes.R) completed by the resumed executor. SUMMARY.md written retroactively to close the plan file gap.
- **Line-count delta** — actual R worker is 846 lines vs the ~500-line estimate in 18-05-PLAN.md. Growth came from explicit qualifying-event UNION branches for condition/drug/procedure (cohort_ops.R parity per SC 4) and the dual-mode cohort resolution path.

## Next

Plan 18-06 (Wave 4) consumes the dispatched run envelope via the cached `GET /profile` path; no direct dependency on Plumber's async endpoint except through the existing `FinnGenRunService` polling.
