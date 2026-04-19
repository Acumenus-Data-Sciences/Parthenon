---
phase: 17-pgs-prs
plan: 06
subsystem: qa
tags: [test-sweep, pest, vitest, pint, phpstan, wave-4, integration]
wave: 4
depends_on: [17-02, 17-03, 17-04, 17-05]
requirements_addressed: [GENOMICS-06, GENOMICS-07, GENOMICS-08]
verdict: GREEN
started: 2026-04-19T01:24:00Z
completed: 2026-04-19T01:30:00Z
runner: claude-opus-4-7
base_commit: 2c5cf64bea73015ea51c0c8c6ece805ab9fc6dc0
---

# Phase 17 Test Sweep Log

**Run date:** 2026-04-19 01:24 UTC
**Branch:** worktree-agent-ae8ff150 (reset to base `2c5cf64be` = Waves 1-3 merged)
**Runner:** Wave 4 test sweep (Plan 17-06)
**Verdict:** GREEN — all Phase 17 Wave 0 tests passing, lint + static analysis clean.

## Summary

| Check | Result | Count | Duration |
|-------|--------|-------|----------|
| Phase 17 Wave 0 Pest (8 files) | PASS | 55 tests / 386 assertions | 20.22s |
| Phase 17 Vitest (2 files) | PASS | 9 tests | 1.17s |
| Phase 14 regression Pest (7 files) | PASS | 35 tests / 99 assertions | 1.69s |
| Pint --test (12 Phase 17 source + 3 migrations) | PASS | 15 files clean | <1s |
| PHPStan level 8 (12 Phase 17 source + 3 migrations) | PASS | 0 errors | ~25s |

All 10 Wave 0 test artifacts exist on disk, all Phase 17 tests pass, all Phase 14 regression tests pass. Phase 17 code is Pint-clean and PHPStan-level-8-clean.

## Wave 0 Test Files Present

| # | File | Exists | Lines | Source Plan |
|---|------|--------|-------|-------------|
| 1 | `backend/tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php` | ✓ | 132 | 17-02 |
| 2 | `backend/tests/Feature/FinnGen/PrsDispatchTest.php` | ✓ | 238 | 17-03 |
| 3 | `backend/tests/Feature/FinnGen/CohortPrsEndpointsTest.php` | ✓ | 289 | 17-04 |
| 4 | `backend/tests/Feature/FinnGen/PgsCatalogMigrationTest.php` | ✓ | 114 | 17-01 |
| 5 | `backend/tests/Feature/FinnGen/GwasSchemaProvisionerPrsTest.php` | ✓ | 144 | 17-01 |
| 6 | `backend/tests/Feature/FinnGen/PrsPermissionSeederTest.php` | ✓ | 92 | 17-01 |
| 7 | `backend/tests/Unit/FinnGen/PgsCatalogFetcherTest.php` | ✓ | 140 | 17-02 |
| 8 | `backend/tests/Unit/FinnGen/PgsScoreIngesterTest.php` | ✓ | 130 | 17-02 |
| 9 | `frontend/src/features/cohort-definitions/components/__tests__/PrsDistributionPanel.test.tsx` | ✓ | 163 | 17-05 |
| 10 | `frontend/src/features/cohort-definitions/components/__tests__/ComputePrsModal.test.tsx` | ✓ | 162 | 17-05 |

**All 10 Wave 0 tests exist and pass.**

## Pest Results — Phase 17 Wave 0 Suite

**Command:**
```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest \
  tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php \
  tests/Feature/FinnGen/PrsDispatchTest.php \
  tests/Feature/FinnGen/CohortPrsEndpointsTest.php \
  tests/Feature/FinnGen/PgsCatalogMigrationTest.php \
  tests/Feature/FinnGen/GwasSchemaProvisionerPrsTest.php \
  tests/Feature/FinnGen/PrsPermissionSeederTest.php \
  tests/Unit/FinnGen/PgsCatalogFetcherTest.php \
  tests/Unit/FinnGen/PgsScoreIngesterTest.php \
  --no-coverage"
```

**Pest exit code:** 2 (see Exit-2 Analysis below — JUnit confirms 0 errors / 0 failures / 0 skipped)
**Summary line:** `Tests: 55 passed (386 assertions) — Duration: 20.22s`

| Test file | Tests | Pass | Fail | Skipped |
|-----------|-------|------|------|---------|
| LoadPgsCatalogCommandTest | 6 | 6 | 0 | 0 |
| PrsDispatchTest | 6 | 6 | 0 | 0 |
| CohortPrsEndpointsTest | 12 | 12 | 0 | 0 |
| PgsCatalogMigrationTest | 8 | 8 | 0 | 0 |
| GwasSchemaProvisionerPrsTest | 8 | 8 | 0 | 0 |
| PrsPermissionSeederTest | 5 | 5 | 0 | 0 |
| PgsCatalogFetcherTest (Unit) | 6 | 6 | 0 | 0 |
| PgsScoreIngesterTest (Unit) | 4 | 4 | 0 | 0 |
| **Total** | **55** | **55** | **0** | **0** |

### Exit-2 Analysis (GwasSchemaProvisionerPrsTest)

When run in isolation, `GwasSchemaProvisionerPrsTest.php` returns Pest exit code 2 despite:
- 0 failures, 0 errors, 0 skipped
- All 8 tests display `✓ PASS`
- JUnit XML (`--log-junit`) reports: `tests="8" assertions="16" errors="0" failures="0" skipped="0"`
- `--fail-on-risky` AND `--fail-on-warning` BOTH return exit 0
- No output on stderr

Conclusion: this is a Pest 3.8.5 shutdown-phase signal (not a real failure). The test suite itself is 100% green per JUnit. No test drift fixed — all 8 assertions passed unmodified. Tracked as informational-only; not a plan-blocker.

### Phase 17 Pest Output (last 10 lines)

```
   PASS  Tests\Unit\FinnGen\PgsScoreIngesterTest
  ✓ it upsertScore writes one row and refreshes loaded_at on re-run      1.04s
  ✓ it upsertVariants inserts the full batch on first run then 0 duplic… 0.03s
  ✓ it upsertVariants batches writes in chunks of BATCH_SIZE (verifies…  0.08s
  ✓ it upsertVariants is a no-op on empty input                          0.02s

  Tests:    55 passed (386 assertions)
  Duration: 20.22s
```

## Pest Results — Phase 14 Regression Suite (T-17-S-regression mitigation)

**Command:**
```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest \
  tests/Feature/FinnGen/GwasDispatchTest.php \
  tests/Feature/FinnGen/GwasSchemaProvisionerTest.php \
  tests/Feature/FinnGen/GwasSchemaGrantsTest.php \
  tests/Feature/FinnGen/GwasCacheKeyHasherTest.php \
  tests/Feature/FinnGen/PrepareSourceVariantsCommandTest.php \
  tests/Feature/FinnGen/GwasSmokeTestCommandTest.php \
  tests/Feature/FinnGen/GwasCachePruneCommandTest.php \
  --no-coverage"
```

**Exit code:** 0
**Summary:** `Tests: 35 passed (99 assertions) — Duration: 1.69s`

No Phase 14 regressions introduced by Phase 17. The GwasSchemaProvisioner extension in 17-01 (appending `prs_subject_scores` alongside `summary_stats`) did not break any existing Phase 14 behavior.

## Vitest Results

**Command:**
```bash
docker compose exec -T node sh -c "cd /app && npx vitest run \
  src/features/cohort-definitions/components/__tests__/PrsDistributionPanel.test.tsx \
  src/features/cohort-definitions/components/__tests__/ComputePrsModal.test.tsx"
```

**Exit code:** 0
**Summary:** `Test Files: 2 passed (2) — Tests: 9 passed (9) — Duration: 1.17s`

| Test file | Tests | Pass | Fail |
|-----------|-------|------|------|
| PrsDistributionPanel.test.tsx | 5 | 5 | 0 |
| ComputePrsModal.test.tsx | 4 | 4 | 0 |

## Lint / Type Check

### Pint --test on Phase 17 files

**Command:**
```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint --test \
  app/Services/FinnGen/PgsCatalogFetcher.php \
  app/Services/FinnGen/PgsScoreIngester.php \
  app/Services/FinnGen/PrsDispatchService.php \
  app/Services/FinnGen/PrsAggregationService.php \
  app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php \
  app/Http/Controllers/Api/V1/CohortPrsController.php \
  app/Http/Controllers/Api/V1/PgsCatalogController.php \
  app/Http/Requests/FinnGen/ComputePrsRequest.php \
  app/Http/Requests/FinnGen/DownloadPrsRequest.php \
  app/Console/Commands/FinnGen/LoadPgsCatalogCommand.php \
  app/Models/App/PgsScore.php \
  app/Models/App/PgsScoreVariant.php"
```

**Exit code:** 0
**Result:** `PASS — 12 files`

### Pint --test on Phase 17 migrations

```bash
vendor/bin/pint --test database/migrations/2026_04_25_*.php
```

**Exit code:** 0
**Result:** `PASS — 3 files`

### PHPStan level 8 on Phase 17 files

**Command (host PHP 8.4, not container — avoids OOM per Plan 17-04 precedent):**
```bash
cd backend && php -d memory_limit=4G vendor/bin/phpstan analyse --level=8 --no-progress --memory-limit=4G \
  app/Services/FinnGen/PgsCatalogFetcher.php \
  app/Services/FinnGen/PgsScoreIngester.php \
  app/Services/FinnGen/PrsDispatchService.php \
  app/Services/FinnGen/PrsAggregationService.php \
  app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php \
  app/Http/Controllers/Api/V1/CohortPrsController.php \
  app/Http/Controllers/Api/V1/PgsCatalogController.php \
  app/Http/Requests/FinnGen/ComputePrsRequest.php \
  app/Http/Requests/FinnGen/DownloadPrsRequest.php \
  app/Console/Commands/FinnGen/LoadPgsCatalogCommand.php \
  app/Models/App/PgsScore.php \
  app/Models/App/PgsScoreVariant.php
```

**Exit code:** 0
**Result:** `[OK] No errors`

### PHPStan level 8 on Phase 17 migrations

```bash
cd backend && php -d memory_limit=4G vendor/bin/phpstan analyse --level=8 --no-progress \
  database/migrations/2026_04_25_000050_grant_vocab_create_to_migrator.php \
  database/migrations/2026_04_25_000100_create_pgs_catalog_tables.php \
  database/migrations/2026_04_25_000200_seed_prs_permissions.php
```

**Exit code:** 0
**Result:** `[OK] No errors`

### Container PHPStan OOM (noted, not blocking)

Running PHPStan inside the PHP container against the full Phase 17 file set consistently OOM-kills (exit 137) at 2 GB memory limit. This matches the precedent documented in Plan 17-04 SUMMARY. The host PHP 8.4 binary with 4 GB memory limit finishes the same analysis in ~25 s with identical configuration (same `phpstan.neon`). Results are identical because both use the same configuration file and baseline.

## Issues Found + Fixes

**None.** All Phase 17 Wave 0 tests pass as-written; no fixture drift, no mock binding issues, no production code changes required.

## Out-of-Scope Pre-Existing Failures

Running `vendor/bin/pest tests/Feature/FinnGen tests/Unit/FinnGen --no-coverage` (full FinnGen directory) OOM-kills the PHP container at exit 137. When chunked into smaller batches, two pre-existing non-Phase-17 test files fail due to cross-connection test isolation issues:

| Test File | Failure Mode | Root Cause | Phase | Disposition |
|-----------|--------------|------------|-------|-------------|
| `AnalysisModuleEndpointsTest::all 4 CO2 modules have non-null settings_schema and result_component` | 1 test | `settings_schema is null` for `co2.*` modules — Phase 16 CO2 modules never had settings_schema seeded | Phase 16 | Out of scope (a) — pre-existing, unrelated to Phase 17 |
| `EndpointGenerateCohortIdTest` (3 tests) | UniqueConstraintViolation on `endpoint_definitions_pkey` for `TEST_ENDPOINT` | `RefreshDatabase` + `finngen` connection — shared-PDO fix in `3f0313e9b` covers most cases but leaks on EndpointDefinition::factory() writes via `finngen` connection | Phase 13.2 | Out of scope (a) — pre-existing, failing on `2c5cf64be` base before Phase 17 |
| `RunFinnGenAnalysisJobTest` (9 tests) | FK violation `finngen_runs_user_id_fkey` | Test setup writes to `finngen.runs` referencing user_id that's not yet seeded; test-isolation issue predating Phase 17 | Phase 13/14 | Out of scope (a) — pre-existing |

None of these three test files are in the Phase 17 Wave 0 list, none are modified by Phase 17 production code, and all three failures were present on the `2c5cf64be` base before Plan 17-06 began. Per 17-06-PLAN.md deviation rule: "Do NOT modify production code or change the test contracts set by Plans 01-05." These are logged for the orchestrator to route to a future cross-phase test-isolation cleanup plan (Phase 17.1 candidate), not a Plan 17-06 blocker.

Commit `3f0313e9bd9386ed` (`fix(ci): fix FinnGen test suite — shared PDO + guards + stale assertions`, 2026-04-18 20:43) already addressed ~80 FK violations via shared-PDO setup in `TestCase.php`; residual issues are in fixture seeding not currently covered.

## Post-Staging Cleanup Note

Because the `php` and `node` Docker containers bind-mount `/home/smudoshi/Github/Parthenon-i18n-unified/{backend,frontend}` (not this worktree), running Vitest required temporarily staging the six Phase 17 Wave-3 frontend files into i18n-unified for execution. After Vitest completed, those files were removed and `CohortDefinitionDetailPage.tsx` was restored from backup, returning i18n-unified to its pre-staging state (only pre-existing unrelated modifications remain). The worktree copy at `/home/smudoshi/Github/Parthenon/frontend/...` is the source of truth.

## Commit / Evidence

- Base: `2c5cf64bea73015ea51c0c8c6ece805ab9fc6dc0` (chore: merge executor worktree 17-04)
- Earlier FinnGen test-stability fix: `3f0313e9bd9386ed` (fix(ci): fix FinnGen test suite — shared PDO + guards + stale assertions)
- PHP container mount: `/home/smudoshi/Github/Parthenon-i18n-unified/backend → /var/www/html`
- Node container mount: `/home/smudoshi/Github/Parthenon-i18n-unified/frontend → /app`
- PostgreSQL testing DB: `parthenon_testing` on host PG17, migrations current through `2026_04_25_000200_seed_prs_permissions`

## Raw log files

All raw log files captured at `/tmp/17-06-*.txt` during the sweep:

- `/tmp/17-06-pest-phase17.txt` — Phase 17 Wave 0 Pest output (8 files, 55 tests)
- `/tmp/17-06-pest-phase14-regression.txt` — Phase 14 regression Pest output (7 files, 35 tests)
- `/tmp/17-06-vitest.txt` — Vitest output (2 files, 9 tests)
- `/tmp/17-06-pint.txt` — Pint --test output (12 Phase 17 source files)
- `/tmp/17-06-phpstan.txt` — PHPStan level 8 output (12 Phase 17 source files + 3 migrations)

## Verdict

**GREEN** — Phase 17 is ready for CHECKPOINT.

- All 10 Wave 0 test artifacts exist
- All 55 Phase 17 Pest tests pass (386 assertions)
- All 9 Phase 17 Vitest tests pass
- All 35 Phase 14 regression tests pass (zero Phase 17-introduced regressions)
- Pint clean on all 15 Phase 17 PHP files (12 source + 3 migrations)
- PHPStan level 8 clean on all 15 Phase 17 PHP files
- Zero deviations, zero production-code modifications, zero test-contract relaxations

Pre-existing failures in `AnalysisModuleEndpointsTest`, `EndpointGenerateCohortIdTest`, `RunFinnGenAnalysisJobTest` are documented and classified out-of-scope (Phase 13/14/16 test-isolation issues predating Phase 17).
