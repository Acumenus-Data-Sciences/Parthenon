---
phase: 15
plan: 03
status: complete
completed: 2026-04-18
---

# Plan 15-03 Summary — FinnGenGwasRunObserver + Registration

## Outcome

Wave 1 observer layer complete. Phase 15 tracking rows now round-trip: `dispatchFullGwas` (Plan 15-02) writes the row at `status='queued'` pre-dispatch; this observer backfills status / finished_at / case_n / control_n / top_hit_p_value when the owning `finngen.runs` row transitions.

## Tasks

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1 | `FinnGenGwasRunObserver` class with backfill logic | ✓ | File exists; Pint + PHPStan green; `class_exists` true under Laravel autoloader |
| 2 | `Run::observe(FinnGenGwasRunObserver::class)` registration | ✓ | Added in `AppServiceProvider::boot()` next to `GwasCovariateSet::observe(...)` |

## Observer Contract

- Listens on `Run::updated` (Laravel Eloquent event).
- Early-returns for non-GWAS analysis types (Phase 14 smoke test + endpoint-generate Runs unaffected).
- Tracking row lookup: `EndpointGwasRun::where('run_id', $run->id)->orWhere('step1_run_id', $run->id)->first()`.
- Missing tracking row → silent return (observer is best-effort; not authoritative).

## Backfill Branches

| Scenario | Attributes set |
|----------|----------------|
| step-2 terminal (succeeded/failed/canceled) | status, finished_at, case_n, control_n, top_hit_p_value (on succeeded) |
| step-2 running/queued | status |
| step-1 failure | status='failed', finished_at |
| step-1 running/succeeded | (no-op — step-2 will drive status) |

## HIGHSEC Posture (CLAUDE.md Gotcha #12)

**Transaction poisoning guard:** every DB operation is wrapped in try-catch; observer NEVER re-throws.

```
grep -c "throw " backend/app/Observers/FinnGen/FinnGenGwasRunObserver.php
→ 0

grep -c "catch (Throwable" backend/app/Observers/FinnGen/FinnGenGwasRunObserver.php
→ 3   (lookup, backfill, top-hit-p-value query)

grep -c "Log::warning" backend/app/Observers/FinnGen/FinnGenGwasRunObserver.php
→ 4   (lookup_failed, backfill_failed, schema_name_rejected, top_hit_query_failed)
```

## T-15-10 Mitigation

`computeTopHitPValue()` regex-allow-lists the derived schema name (`preg_match('/^[a-z][a-z0-9_]*$/', $schema)`) before `sprintf`ing it into the `SELECT MIN(p_value) FROM {schema}.summary_stats WHERE gwas_run_id = ?` query. `$gwasRunId` is parameter-bound.

## Registration

```php
// backend/app/Providers/AppServiceProvider.php::boot()
GwasCovariateSet::observe(GwasCovariateSetObserver::class);

// Phase 15 — backfill EndpointGwasRun tracking rows from finngen.runs status
// transitions. Observer is tight-loop-safe (every DB op try-catch-wrapped,
// never re-throws per CLAUDE.md Gotcha #12 — transaction poisoning guard).
Run::observe(FinnGenGwasRunObserver::class);
```

## Verification

- Pint + PHPStan green on both files.
- `php artisan optimize:clear` clean; `class_exists("App\\Observers\\FinnGen\\FinnGenGwasRunObserver")` returns true under the Laravel autoloader.
- No Phase 14 regression anticipated — observer's early-return on non-GWAS analysis types means `endpoint.generate` Runs and `gwas.regenie.step1`/`step2` Runs from Phase 14 smoke tests flow through unchanged (Phase 14 smoke test doesn't create tracking rows, so `tracking === null` silent-return fires).

## Next Up

Plan 15-04: `DispatchEndpointGwasRequest` FormRequest + `EndpointBrowserController::gwas()` + `::eligibleControls()` + `::show()` extension + route registrations + OpenAPI regen.
