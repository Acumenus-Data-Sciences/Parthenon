# v1.0 UX Close-Out — FinnGen Cohort Workbench + Analysis Gallery

**Date:** 2026-04-17
**Milestone:** v1.0 — FinnGen Genomics
**Scope:** Match panel UX, output contract (promote-match), SP3 picker + handoff, shared workbench primitives, Materialize + Operate + Sessions polish, source-select step removal, SP3 gallery/detail polish.

## Summary

Closed the researcher journey from **Match** → **Promote** → **SP3 Analysis**. A successful `cohort.match` run now produces a first-class `cohort_definitions` row with full provenance, visible in the SP3 picker and handoff view. Also shipped a shared workbench primitives module so every step in the Cohort Workbench, Analysis Gallery, and future Morpheus workbenches shares the same Shell/Section/Panel/Divider/StatusStrip vocabulary.

## What changed

### Match panel — full rationalization

Previously a single flat column stacking a config form above a results panel with no visual hierarchy.

After:
- **Two-column grid on md+** (config left, results right); stacks on mobile.
- Config grouped into three labeled sections: **Cohorts** (primary + up to 10 comparators), **Matching criteria** (sex / birth-year toggles with the max-year-diff input correctly nested under its toggle), **Ratio** (explicit `1:N` stepper).
- Sticky footer `Run matching` button with field-specific validation messaging.
- Results panel uses the shared `StatusStrip`; renders a **KPI row** (Primary N · Comparators input N · Matched output N · Match rate), then panel-framed **Counts**, **Attrition waterfall**, and **Covariate balance (SMD)**.
- Promote CTA ("Save matched controls as a first-class cohort") when the run succeeds; badge ("Promoted as cohort #N · {name}") when it has been.

### Output contract — `POST /api/v1/finngen/workbench/promote-match`

The R worker writes matched subjects under a phantom `cohort_definition_id = 9,000,000 + primary_id` (see `darkstar/api/finngen/cohort_ops.R`). The new endpoint closes the gap:

1. Reads the succeeded `cohort.match` run (ownership enforced, must be `STATUS_SUCCEEDED`, `analysis_type = cohort.match`).
2. Builds the source context, resolves `cohort_schema` from the source daimons.
3. Defence-in-depth regex check on `cohort_schema` identifier before raw SQL interpolation.
4. Pre-flight `SELECT COUNT` for phantom rows — returns clean 422 if none exist.
5. Inside a **`DB::transaction()`**: creates a `cohort_definitions` row with full provenance under `expression_json.finngen_match_promotion` (run_id, primary_cohort_id, comparator_cohort_ids, ratio, match_sex, match_birth_year, max_year_difference, phantom_cohort_id, cohort_schema) → UPDATEs phantom rows in `{cohort_schema}.cohort` to point at the new id.
6. **Idempotent** — re-calling for the same `run_id` returns the prior record with `already_promoted: true`; the idempotency key is an `expression_json::jsonb->'finngen_match_promotion'->>'run_id'` lookup owned by the caller.

Session state persists the promotion under `matched_cohort_promotions: Record<run_id, MatchedCohortPromotion>` so a reload shows the badge without a round-trip.

### SP3 picker consumption

`finngen-analyses/components/widgets/CohortPicker.tsx` now surfaces a "Matched 1:N" pill (GitMerge icon, info tone) next to any cohort whose `expression_json.finngen_match_promotion` marker is present. Hovering shows the full provenance string ("Matched cohort · Primary #221 vs [#222, #223] at 1:2 · sex · birth year").

### Handoff step

`HandoffStep` now surfaces two bands:

1. **Handoff: materialized cohort** — the existing materialize-cohort CTA.
2. **Handoff: matched comparator cohorts** — lists every promoted matched cohort from this session with its own "Open in gallery" link. Each link carries `source_key` and `workbench_cohort_id` so `FinnGenAnalysesStandalonePage` pre-selects the cohort in the SettingsForm.

### Source-select step removed

Dropped `"select-source"` from `WorkbenchStepKey` and `WORKBENCH_STEPS`. A session is bound to a source at creation time; the old placeholder did nothing. Header now elevates `source_key` as an info-colored pill next to the session name. Stepper tests updated from 6 → 5 steps. Sessions persisted under the old 6-step order may open one step ahead of where the researcher left off — accepted as a one-time cutover cost; users can click the stepper once to re-orient.

### Materialize step polish

Rewritten with `Shell` + labeled `Section`s (Cohort identity / Operation tree / Overwrite) + sticky footer button. Separate status `Shell` for the polling result with `StatusStrip`. Empty state when no tree is built.

### Operation tree (Operate step) polish

Wrapped the tree canvas in a `Shell` with subtitle explaining UNION/INTERSECT/MINUS. Live expression line moved inside the Shell body with a top separator. Tooltips on `∪` / `∩` / `∖` toolbar buttons explaining each set operation.

### Sessions list polish

Both "New session" and "Your sessions" wrapped in `Shell`. Default session name dropped from `"Untitled session"` (forced retype) to empty + placeholder. Sessions sorted newest-first. `last_active_at` rendered as relative time (`Intl.RelativeTimeFormat`) with absolute tooltip. `source_key` rendered as a pill. Resume button elevated vs. secondary copy/delete icons. Source select shows "Loading sources…" when the query is pending.

### SP3 gallery + detail polish

- `AnalysisGalleryPage`: grid wrapped in `Shell` ("Analysis modules" + subtitle), consolidated loading/empty states.
- `AnalysisDetailPage`: moved from flat `flex gap-6` to `grid md:grid-cols-[20rem_1fr] md:items-start`; each column uses `Shell` (Configure / Recent runs / Results); consistent empty/failed/running states using `Clock`/`AlertCircle` icons.
- `FinnGenAnalysesStandalonePage`: header source pill matches the workbench pattern.

### Shared primitives

Moved `primitives.tsx` to **`frontend/src/components/workbench/primitives.tsx`** (was in `finngen-workbench/components/`). Exports:

- `<Shell title? subtitle? />` — outer card with header strip and body slot.
- `<Section label>` — labeled group inside a Shell (config forms).
- `<Panel label>` — bordered labeled group (data tables/charts). Note: distinct from `@/components/ui/Panel`, which wraps CSS-classed chrome.
- `<Divider />` — subtle horizontal rule between Sections.
- `<StatusStrip status runId? pollingHint? />` — run-status chip row.

Consumers: `MatchingConfigForm`, `MatchingResults`, `MaterializeStep`, `OperationBuilder`, `SessionsListPage` (finngen-workbench) + `AnalysisGalleryPage`, `AnalysisDetailPage` (finngen-analyses).

## Bugs caught during test-and-debug

1. **Schema-step migration repeated every load** — client-side migration decremented `session_state.step` whenever `schema_version < 2`, but nothing bumped `schema_version` server-side, so the decrement re-applied on every reload. Removed the migration entirely.
2. **Promote-match was not atomic** — INSERT `cohort_definitions` + UPDATE cohort rows were separate statements. If the UPDATE failed we leaked an orphan `cohort_definition`. Wrapped in `DB::transaction()`.
3. **Hardcoded `'pgsql'` connection** — the endpoint used `DB::connection('pgsql')`, which in the test environment points at the live dev DB (tests use `pgsql_testing`). Switched to `DB::connection()` so the default connection is used. This was caught by the happy-path feature test crashing because its INSERT wrote to `parthenon_testing` while the endpoint read from `parthenon`.
4. **Defence-in-depth** — regex-check `cohort_schema` against `^[a-zA-Z_][a-zA-Z0-9_]*$` before raw SQL interpolation. `SourceDaimon.table_qualifier` is admin-owned so this should never trip, but the guard closes the trust loop.

## Test coverage

New Pest feature tests in `tests/Feature/FinnGen/WorkbenchSessionTest.php`:

- `denies viewer`
- `validates run_id format`
- `returns 404 for non-existent run`
- `rejects runs of the wrong analysis_type`
- `rejects non-succeeded runs`
- `refuses to promote another user's run`
- **`happy path promotes and migrates phantom rows`** — seeds phantom rows in `pancreas_results.cohort`, asserts 3 rows migrated, new `cohort_definition_id` returned, provenance stored correctly.
- **`is idempotent — second call returns the prior promotion`** — asserts `already_promoted: true` on the second call, same id returned, only one `cohort_definition` row exists.
- `returns 422 when phantom rows are missing` — the endpoint returns a clean 422 instead of crashing with a Postgres error.

Test seeder (`FinnGenTestingSeeder`) now seeds `PANCREAS` and `ACUMENUS` sources alongside the existing `EUNOMIA` fixture — aligns with the project preference for richer sources over Eunomia in researcher flows.

Frontend vitest tests unchanged in count (63 FinnGen-scoped, 677 total) — the refactors are visual/structural and preserve all test-asserted strings (`Run matching`, `Remove comparator`, `Attrition waterfall`, `Covariate balance`, etc.).

## Files touched

### Backend

- `app/Http/Controllers/Api/V1/FinnGen/WorkbenchSessionController.php` — `promoteMatchedCohort` method, default connection, transaction, regex guard.
- `app/Http/Requests/FinnGen/PromoteMatchedCohortRequest.php` — new.
- `routes/api.php` — `POST /finngen/workbench/promote-match` route.
- `database/seeders/Testing/FinnGenTestingSeeder.php` — PANCREAS + ACUMENUS sources.
- `tests/Feature/FinnGen/WorkbenchSessionTest.php` — 9 new assertions.

### Frontend

- `src/components/workbench/primitives.tsx` — new shared module.
- `src/features/finngen-workbench/api.ts` — `promoteMatchedCohort`.
- `src/features/finngen-workbench/hooks/usePromoteMatchedCohort.ts` — new.
- `src/features/finngen-workbench/types.ts` — `MatchedCohortPromotion`.
- `src/features/finngen-workbench/components/{MatchingConfigForm,MatchingResults,MaterializeStep,OperationBuilder,WorkbenchStepper}.tsx` — polish + primitive adoption.
- `src/features/finngen-workbench/pages/{WorkbenchPage,SessionsListPage}.tsx` — polish + stepper changes.
- `src/features/finngen-workbench/__tests__/WorkbenchStepper.test.tsx` — 5-step update.
- `src/features/finngen-analyses/components/widgets/CohortPicker.tsx` — matched-cohort badge.
- `src/features/finngen-analyses/pages/{AnalysisGalleryPage,AnalysisDetailPage,FinnGenAnalysesStandalonePage}.tsx` — primitive adoption.

## Follow-ups closed in this commit

All five remaining v1.0 follow-ups were addressed in the same commit:

- **WorkbenchStepper fast-refresh warning** — `WorkbenchStepKey` + `WORKBENCH_STEPS` extracted to `frontend/src/features/finngen-workbench/lib/workbenchSteps.ts`. The component file now exports only the component.
- **SP3 picker selected-item stickiness** — `CohortPicker` (finngen-analyses) now caches every selected cohort's metadata. Chips survive search filtering that would otherwise drop them; pre-filled ids fall back to `cohort #N` until found.
- **`useMatchRunStatus` rename** — moved to `useFinnGenRunStatus` in a dedicated `hooks/useFinnGenRunStatus.ts` file. The old `useMatchCohort.ts` retains only the `useMatchCohort` mutation. `MatchingResults`, `MaterializeStep`, and the Vitest mock updated.
- **Workbench launcher Shell treatment** — `WorkbenchLauncherPage` now wraps its toolset grid and Recent Investigations in Shells with consistent titles + subtitles; "New Investigation" CTA surfaces only when investigations exist, otherwise a focused empty-state CTA takes its place.
- **Handoff empty state** — when neither a materialized cohort nor any promoted matches exist, the step now renders a single dashed-border empty-state card explaining both routes forward plus a softer "Open gallery without pre-selection" button.

## Verification

- Backend: Pint clean (3 files), PHPStan clean (15 files), Pest 106 passed.
- Frontend: tsc clean, vite build clean, vitest 677 passed / 2 skipped (0 regressions).
- ESLint silent on the touched surface (1 pre-existing Fast Refresh warning unchanged).
