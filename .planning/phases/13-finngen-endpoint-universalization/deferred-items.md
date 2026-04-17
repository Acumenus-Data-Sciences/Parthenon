# Deferred Items — Phase 13 Execution

## Pre-existing migration ordering issue (NOT caused by Plan 07)

**Observed during:** Plan 07 Task 1 regression check (FinnGenRunsRBACTest / FinnGenRunsValidationTest)

**Error:**
```
SQLSTATE[42P01]: Undefined table: 7 ERROR:  relation "vocab.source_to_concept_map" does not exist
at database/migrations/2026_04_18_000300_seed_finngen_source_to_concept_map.php:66
```

**Analysis:** The migration `2026_04_18_000300_seed_finngen_source_to_concept_map.php` (from an earlier Phase 13 plan) assumes `vocab.source_to_concept_map` exists at migration time, but the test DB (`RefreshDatabase`) does not have the shared `vocab` schema seeded. This is a pre-existing issue in Phase 13 Plans 03/05 migrations, NOT caused by Plan 07's controller edits.

**Impact:** All 9 RBAC/validation tests fail at migration-time, so Plan 07 could not run full regression checks on the existing Feature tests.

**Recommendation for owning plan:** Guard the seed migration with `Schema::connection('omop')->hasTable('source_to_concept_map')` or move it into a conditional seeder that only runs when the vocab schema is populated. Tag: `[pre-existing]` — defer to owning plan (likely Plan 03 or 05 author).

**Scope boundary confirmed:** Plan 07 only modified `EndpointBrowserController.php`. Pint + PHPStan level 8 pass on the modified file; the migration error is in a different file and predates this plan.
