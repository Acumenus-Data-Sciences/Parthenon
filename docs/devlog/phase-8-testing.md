# Phase 8: Testing — Development Log

**Date:** 2026-03-02
**Branch:** `master`
**Status:** Foundation complete — static analysis upgraded, 195 tests green across 3 stacks, factory infrastructure built. Eunomia integration tests, Playwright E2E, and R testthat remain for future passes.

---

## Overview

Phase 8 establishes the testing infrastructure and baseline test coverage for all runtimes. The guiding principle from PLAN.md: "testing is a first-class concern throughout every phase, not a post-hoc activity."

Work completed in this pass:

1. **PHPStan level 8** — upgraded from level 6, generated 289-error baseline
2. **Model factories** — 10 factories covering all major App models
3. **Backend feature tests** — new tests for CdmModel, ConceptSet, CohortDefinition; fixes for Auth, Source, Vocabulary tests
4. **Frontend test utilities** — shared `renderWithProviders()` helper, 4 UI component test suites
5. **Test fixes** — resolved namespace errors, response format mismatches, throttle flakiness, vocabulary seeding

---

## What Was Built

### PHPStan Level 8 with Baseline

Upgraded `phpstan.neon` from level 6 → 8. At level 8, 289 existing errors were baselined in `phpstan-baseline.neon` — mostly Larastan limitations (enum casts through `fresh()`, JSON column access, missing model stubs for future phases).

Key configuration additions:
- `missingType.iterableValue` and `missingType.generics` globally ignored (Larastan noise)
- `argument.templateType`, `property.notFound`, `isset.offset` ignored
- Baseline prevents regressions: any new code must pass level 8 cleanly

Three genuine import bugs were caught and fixed during the upgrade:
- `ClinicalCoherenceEngineService` and `PopulationRiskScoreEngineService` imported `SqlRendererService` from non-existent `App\Services\Achilles` namespace (correct: `App\Services\SqlRenderer`)
- `NotifiesOnCompletion` compared `$execution->status` directly to `ExecutionStatus` enum without accounting for string-backed column access

### Model Factories (10 new)

All factories in `database/factories/App/`:

| Factory | States |
|---|---|
| SourceFactory | — |
| SourceDaimonFactory | `cdm()`, `vocabulary()`, `results()` |
| CohortDefinitionFactory | PascalCase expression_json |
| CohortGenerationFactory | `completed()` |
| ConceptSetFactory | — |
| ConceptSetItemFactory | `excluded()` |
| CharacterizationFactory | — |
| AnalysisExecutionFactory | `running()`, `completed()`, `failed()` |
| IncidenceRateAnalysisFactory | — |
| StudyFactory | — |

Notable: `CohortDefinitionFactory` uses PascalCase keys in `expression_json` to match `CohortExpressionSchema` validation (OHDSI Circe convention), with a non-empty `CriteriaList` under `PrimaryCriteria`.

### Backend Feature Tests

**New test files:**

- `CdmModelTest.php` (7 tests) — verifies read-only guard: create/update/delete throw `RuntimeException`, model uses `cdm` connection, timestamps disabled, can read persons and conditions from live CDM
- `ConceptSetTest.php` (9 tests) — full CRUD cycle: auth required, create, validate name, list with pagination, show with items, update, soft delete, add item, remove item
- `CohortDefinitionTest.php` (11 tests) — full CRUD + generate dispatch, SQL preview, copy, generation listing

**Fixed test files:**

- `AuthTest.php` — rewritten for email-enumeration-safe register endpoint (returns 200 with generic message regardless of email existence); added wrong-password and duplicate-email tests; disabled throttle middleware to prevent rate-limit flakiness in parallel runs
- `SourceCrudTest.php` — fixed `App\Models\App\User` → `App\Models\User` namespace; fixed response assertions (flat JSON, not `data.` wrapped; delete returns 204 not 200)
- `VocabularySearchTest.php` — fixed namespace; replaced raw `INSERT INTO vocab.concepts` with Eloquent `DB::connection('vocab')->table('concept')->insertOrIgnore()` for consolidated DB layout; added count-check to skip seeding when real vocabulary data exists

### Frontend Test Infrastructure

**`test-utils.tsx`** — shared test utility:
- `createTestQueryClient()` — TanStack Query client with retries disabled, gc time 0
- `renderWithProviders()` — wraps component in `QueryClientProvider` + `MemoryRouter`, accepts `initialRoute` option

**`App.test.tsx`** — updated to use shared utility, added subtitle test.

**New UI component tests:**
- `Badge.test.tsx` (5 tests) — renders text, applies variant classes
- `StatusDot.test.tsx` (4 tests) — renders status dot with correct color class
- `MetricCard.test.tsx` (5 tests) — renders label, value, change indicator
- `EmptyState.test.tsx` (5 tests) — renders title, optional message/icon/action

---

## Test Counts

| Stack | Tests | Assertions | Status |
|---|---|---|---|
| Backend (Pest) | 109 | 905 | All pass |
| Frontend (Vitest) | 64 | — | All pass |
| Python (pytest) | 22 | — | All pass |
| **Total** | **195** | | **All green** |

---

## Issues Encountered

### Parallel test runner + rate limiter
Running `php artisan test --parallel` with 32 processes caused the `throttle:5,15` middleware on the login route to trigger 429s across test processes sharing the same IP. Fixed by disabling `ThrottleRequests` middleware in `AuthTest`'s `beforeEach`.

### Docker bind mount sync
PHPStan configuration changes on the host weren't immediately visible inside the PHP container. Required `docker compose restart php` to force a bind mount refresh. Baseline generation had to be done inside the container and then copied to host via `docker cp`.

### CohortExpressionSchema PascalCase convention
OHDSI's Circe uses PascalCase keys (`PrimaryCriteria`, `CriteriaList`, `ObservationWindow`), not camelCase. Initial test fixtures used camelCase, causing 422 validation errors. Factory and tests updated to match the schema.

### Vocabulary test seeding
After DB consolidation (all schemas in one Postgres instance with search_path), the old `INSERT INTO vocab.concepts` SQL failed. Migrated to Eloquent with connection-aware table references. Added a count-check so tests skip seeding when running against a live database with 7M+ concepts.

---

## Not Yet Implemented

From PLAN.md Phase 8, these remain for future passes:

- **Eunomia integration tests** — cohort generation against synthetic dataset with known-output validation
- **Playwright E2E** — critical user journeys (login, source config, cohort build, analysis run)
- **R testthat** — HADES package wrapper validation
- **MSW handlers** — frontend integration tests with mocked API responses
- **Coverage gates** — CI enforcement of 80%+ overall threshold
- **Contract tests** — API schema validation between frontend and backend
- **Snapshot tests** — SQL dialect translation verification

---

## Commits

```
982493d7  feat: Phase 6F/6G — auth regime (includes Phase 8 testing work)
7e958299  fix: disable throttle middleware in AuthTest to prevent rate-limit flakiness
```
