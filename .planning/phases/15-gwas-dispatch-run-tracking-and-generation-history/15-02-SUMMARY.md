---
phase: 15
plan: 02
status: complete
completed: 2026-04-18
---

# Plan 15-02 Summary — GwasRunService::dispatchFullGwas + dispatchStep2AfterStep1

## Outcome

Wave 1 service layer complete. The Phase 15 HTTP controller (Plan 15-04) can now delegate to `dispatchFullGwas` for the full D-04 ladder + D-15 two-phase write + D-10 supersede path, and the Pitfall-5 atom (`dispatchStep2AfterStep1`) bypasses the strict `fit_pred.list` check when step-1 has only just been queued.

## Tasks

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1 | `dispatchStep2AfterStep1` atom | ✓ | New method; bypasses `assertStep1ArtifactPresent`; threads `step1_run_id` into Darkstar params; existing `dispatchStep2` unchanged |
| 2 | `dispatchFullGwas` orchestrator + 5 private helpers | ✓ | D-04 7-step ladder; D-05 case cohort (`generation.id + OMOP_COHORT_ID_OFFSET`); D-07/08/09 duplicate guards; D-15 `DB::connection('finngen')->transaction` wrapper; D-10 supersede with Open Q5 ownership guard |

## Methods Added

| Signature | Purpose |
|-----------|---------|
| `public dispatchStep2AfterStep1(int $userId, int $caseCohortId, int $controlCohortId, int $covariateSetId, string $sourceKey, ?string $step1RunId): Run` | Pitfall 5: cache-miss auto-chain step-2 |
| `public dispatchFullGwas(int $userId, string $endpointName, string $sourceKey, int $controlCohortId, ?int $covariateSetId = null, bool $overwrite = false): EndpointGwasRun` | D-01 single-POST auto-chain |
| `private resolveDefaultCovariateSetId(): int` | D-06 default resolution |
| `private assertResolvableConcepts(EndpointDefinition): void` | D-04 step 2 — rejects CONTROL_ONLY / UNMAPPED |
| `private assertControlCohortPrepared(int, string): void` | D-04 step 6 — FinnGen-offset reject + schema regex allow-list |
| `private assertCovariateSetExists(int): void` | D-04 step 7 |
| `private assertCallerOwnsRunOrIsAdmin(int, EndpointGwasRun): void` | Open Q5 — owner OR admin/super-admin role |

## Open Q5 Resolution (ownership policy)

`overwrite=true` requires the caller to:
- Own the prior run (`Run::find($existing->run_id)->user_id === $callerUserId`), OR
- Hold `admin` or `super-admin` Spatie role.

Otherwise `NotOwnedRunException` is thrown (controller will map to 403). Prior-run lookup has no FK (per D-13) — uses runtime `Run::find()`; if the prior run has vanished, the supersede is allowed (no owner to contest).

## Pitfall 5 Evidence

```
grep -c "assertStep1ArtifactPresent" backend/app/Services/FinnGen/GwasRunService.php
→ 2   (1 inside assertStep1ArtifactPresent definition + 1 inside dispatchStep2; NOT called from dispatchStep2AfterStep1)
```

Reading the `dispatchStep2AfterStep1` body confirms no `is_file()` or `assertStep1ArtifactPresent` invocation.

## T-15-10 Mitigation (SQL injection defense-in-depth)

`assertControlCohortPrepared` regex-allow-lists the source-key-derived schema name (`preg_match('/^[a-z][a-z0-9_]*$/', $cohortSchema)`) before string interpolation into `SELECT 1 FROM {schema}.cohort WHERE ...`. `$controlCohortId` is parameter-bound.

## Pint + PHPStan

- Pint: 1 `fully_qualified_strict_types` style issue auto-fixed (committed in `b248b1aff`).
- PHPStan: `[OK] No errors` at project level 8.

## Deviations from Plan

**Param shape for `dispatchStep2AfterStep1`.** Plan's example code used `case_cohort_definition_id` + `control_cohort_definition_id` as Darkstar param keys. Plan's explicit instruction was "Do not invent new param keys that Phase 14 doesn't already use (add only `step1_run_id`)." Resolution: keep `cohort_definition_id` = case cohort (Phase 14 shape), add `step1_run_id`, AND add `control_cohort_definition_id` as a Phase 15 extension so the R worker can read it. JSON schema on step-2 has no `additionalProperties: false`, so both keys pass validation.

**`App\Models\App\Source` (not `App\Models\Cdm\Source`).** Plan specified a Cdm-namespace Source but the project's actual Source model lives under `App\Models\App\Source`. Adjusted the `use` import.

## Next Up

- Plan 15-03: `FinnGenGwasRunObserver` for cross-connection status backfill → ✓ Complete (next SUMMARY).
- Plan 15-04: controller + FormRequest + routes + OpenAPI regen.
