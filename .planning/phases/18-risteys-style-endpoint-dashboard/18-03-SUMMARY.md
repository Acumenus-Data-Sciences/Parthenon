---
phase: 18-risteys-style-endpoint-dashboard
plan: 03
subsystem: backend-services
tags: [laravel, postgres, finngen, endpoint-profile, provisioner, hasher, eloquent, highsec, sha256]

# Dependency graph
requires:
  - phase: 13.1-finngen-schema-isolation
    provides: parthenon_migrator / parthenon_app / parthenon_finngen_rw / parthenon_finngen_ro PG roles
  - phase: 14-regenie-gwas-infrastructure
    provides: GwasSchemaProvisioner single-txn provisioner template + GwasCacheKeyHasher canonical-JSON SHA-256 pattern
  - phase: 18-risteys-style-endpoint-dashboard
    provides: Plan 18-01 Wave 0 RED Pest stubs (Co2SchemaProvisionerTest + EndpointExpressionHasherTest)
provides:
  - App\Services\FinnGen\Co2SchemaProvisioner — idempotent single-txn provisioner for {source}_co2_results schema + 4 tables + HIGHSEC §4.1 three-tier grants
  - App\Services\FinnGen\EndpointExpressionHasher — canonical SHA-256 hex hasher for endpoint expression JSON (D-10 cache-key source of truth)
  - App\Models\FinnGen\EndpointProfileSummary — one row per (endpoint_name, source_key, expression_hash)
  - App\Models\FinnGen\EndpointProfileKmPoint — KM step-function points
  - App\Models\FinnGen\EndpointProfileComorbidity — phi-ranked comorbidity rows
  - App\Models\FinnGen\EndpointProfileDrugClass — top ATC3 drug-class rows
  - Per-source onSource(string $sourceKey): self factory pattern with regex-guarded table binding (reusable for any future per-source Eloquent model)
affects: [18-04, 18-05, 18-07]

# Tech tracking
tech-stack:
  added: []  # no new composer / npm deps — pure Laravel services + Eloquent models
  patterns:
    - "GwasSchemaProvisioner-pattern port — single DB::transaction, CREATE ... IF NOT EXISTS, AUTHORIZATION parthenon_migrator with pg_roles guard, three-tier HIGHSEC §4.1 grants inside DO $grants$ blocks gated on role existence (portable dev/CI/prod)"
    - "Regex allow-list /^[a-z][a-z0-9_]*$/ on lowercased source_key BEFORE any SQL interpolation (T-18-03) — replicated verbatim in Co2SchemaProvisioner AND each of the 4 Eloquent models' ::onSource() factory so callers cannot bypass the gate by skipping the service"
    - "Per-source Eloquent factory: ::onSource(string $sourceKey): self returns a new instance with setTable('{source}_co2_results.{table}'); direct instantiation leaves the model table-unbound (fail-loud when missing table qualifier)"
    - "Canonical-JSON SHA-256 hashing — recursive ksort on associative arrays with array_is_list preserving list order, integral-float-to-int coercion for concept_id stability, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE to avoid whitespace/escape drift"
    - "uses(TestCase::class) explicit bind in tests/Unit/FinnGen/* since backend/tests/Pest.php only auto-binds Feature / Integration / Unit/Services / Unit/Seeders"

key-files:
  created:
    - backend/app/Services/FinnGen/Co2SchemaProvisioner.php
    - backend/app/Services/FinnGen/EndpointExpressionHasher.php
    - backend/app/Models/FinnGen/EndpointProfileSummary.php
    - backend/app/Models/FinnGen/EndpointProfileKmPoint.php
    - backend/app/Models/FinnGen/EndpointProfileComorbidity.php
    - backend/app/Models/FinnGen/EndpointProfileDrugClass.php
  modified:
    - backend/tests/Unit/FinnGen/Co2SchemaProvisionerTest.php  # 4 markTestIncomplete stubs → 4 GREEN Pest assertions
    - backend/tests/Unit/FinnGen/EndpointExpressionHasherTest.php  # 3 markTestIncomplete stubs → 3 GREEN Pest assertions

key-decisions:
  - "Canonical scalar primaryKey=expression_hash on all 4 Eloquent models (same pattern as Plan 18-02 EndpointProfileAccess primaryKey=endpoint_name) — DB enforces the real composite PK via the table's PRIMARY KEY constraint; Eloquent single-col surrogate satisfies PHPStan level-8 covariance with Model::\$primaryKey. Upserts in Plans 18-04 / 18-05 MUST match on all PK columns."
  - "Regex allow-list duplicated on each Eloquent model's onSource() factory, not factored into a trait — each model's factory is a trust-boundary entry point; callers cannot inadvertently bypass the regex by skipping the provisioner, and auditors grep one file per boundary instead of following a trait indirection."
  - "Integral-float coercion threshold |v| < PHP_INT_MAX (not just floor==value) — prevents overflow when casting very large doubles back to int; safe because concept_ids are 32/63-bit positive integers in OMOP. Matches GwasCacheKeyHasher cross-stack expectation."
  - "Test bootstrap binding: added uses(TestCase::class) in Co2SchemaProvisionerTest + EndpointExpressionHasherTest. The original Plan 18-01 RED stubs relied on markTestIncomplete never touching facades; flipping them GREEN now needs the Laravel container. Pest.php auto-bind list was not widened to avoid spreading side-effects; the explicit uses() is self-documenting."
  - "4-table DDL matches 18-RESEARCH.md Pattern 2 verbatim. Two support indexes added per plan: epkm_endpoint_source_idx on KM points + epcom_rank_idx on comorbidities — read paths in Plan 18-04 scan by (endpoint, source) and by rank."

patterns-established:
  - "Phase 18 per-source factory convention: every Phase-18 model bound to {source}_co2_results.* ships an onSource() static factory that re-runs the source_key regex and returns a table-bound instance. Reused by Plans 18-04 / 18-05 on every read/write."
  - "Expression-hash cache-invalidation protocol: D-10 establishes SHA-256(canonical-JSON(resolved-expression)) as the versioning signal. EndpointExpressionHasher is the single source of truth — shared by Plan 18-04 dispatch controller (writes current hash into POST body), Plan 18-04 read path (compares cached_hash vs current_hash), and Plan 18-05 R worker (persists hash alongside results)."

requirements-completed: []  # GENOMICS-09/10/11 marked complete when Plans 18-04 through 18-07 land — Plan 18-03 provides the dependencies only

# Metrics
duration: 5min
completed: 2026-04-19
---

# Phase 18 Plan 03: Co2SchemaProvisioner + EndpointExpressionHasher + 4 result models Summary

**Two FinnGen services + 4 Eloquent result models ship the D-09 cache substrate and D-10 invalidation signal; Plan 18-01's 7 RED Wave 0 unit tests (4 Co2SchemaProvisioner + 3 EndpointExpressionHasher) all flip GREEN, unblocking Plans 18-04 (dispatch) and 18-05 (R worker).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-19T18:27:14Z
- **Completed:** 2026-04-19T18:31:22Z
- **Tasks:** 2
- **Files created:** 6 (2 services, 4 models)
- **Files modified:** 2 (2 test files)

## Accomplishments

- **Co2SchemaProvisioner** ships the per-source provisioner: `provision('pancreas')` creates `pancreas_co2_results` AUTHORIZATION `parthenon_migrator`, the 4 result tables with idempotent `CREATE TABLE IF NOT EXISTS`, two support indexes (`epkm_endpoint_source_idx`, `epcom_rank_idx`), and HIGHSEC §4.1 three-tier grants (`parthenon_app` DML, `parthenon_finngen_rw` DML, `parthenon_finngen_ro` SELECT) — all inside one `DB::transaction` (T-18-04 partial-provision mitigation) with role-existence guards so it runs clean across dev / CI / prod.
- **T-18-03 SQL-injection mitigation** locked by regex allow-list `/^[a-z][a-z0-9_]*$/` on the lowercased source_key BEFORE any interpolation — throws `InvalidArgumentException` on mismatch. Pest test `it('rejects unsafe source_key values …')` asserts.
- **EndpointExpressionHasher** produces the D-10 cache-key signal: 64-char lowercase hex SHA-256 of canonical JSON (recursive `ksort` + list-order-preserving `array_is_list` + integral-float coercion + `JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE`). Stable across all three drift vectors proven by Phase 14 `GwasCacheKeyHasher` precedent.
- **4 Eloquent result models** (`EndpointProfileSummary`, `EndpointProfileKmPoint`, `EndpointProfileComorbidity`, `EndpointProfileDrugClass`) ship the cache substrate for Plan 18-04 reads and Plan 18-05 R-worker writes. Each:
  - Has `$fillable` whitelist (T-18-02 / HIGHSEC §3.1) — no `$guarded = []`
  - Has `public $timestamps = false` — D-09 tables own `computed_at` semantics manually
  - Exposes `onSource(string $sourceKey): self` factory with the same regex allow-list the provisioner uses — so callers cannot bypass T-18-03 by skipping the service
  - Uses `$connection = 'pgsql'` with fully-qualified `{source}_co2_results.{table}` set via `setTable()` post-regex
- **Plan 18-01 Wave 0 RED stubs flipped GREEN:** `Co2SchemaProvisionerTest` (4 Pest tests: schema + grants + regex + idempotency) and `EndpointExpressionHasherTest` (3 Pest tests: key-order / concept-id-sensitivity / int-vs-float normalization) — 7 tests, 14 assertions, 0.28s runtime.
- Pint clean across all 8 touched files; PHPStan level 8 clean on all 6 new source files.

## Task Commits

Each task was committed atomically:

| # | Task | Commit | Files |
| - | ---- | ------ | ----- |
| 1 | Co2SchemaProvisioner + flip Co2SchemaProvisionerTest GREEN (T-18-03/04) | `7286c59ee` | `Co2SchemaProvisioner.php`, `Co2SchemaProvisionerTest.php` |
| 2 | EndpointExpressionHasher + 4 profile result models + flip EndpointExpressionHasherTest GREEN | `01f15540c` | `EndpointExpressionHasher.php`, `EndpointProfile{Summary,KmPoint,Comorbidity,DrugClass}.php`, `EndpointExpressionHasherTest.php` |

## Pest Test Evidence

```
   PASS  Tests\Unit\FinnGen\Co2SchemaProvisionerTest
  ✓ it creates {source}_co2_results schema with 4 tables: endpoint_prof…
  ✓ it grants SELECT/INSERT/UPDATE to parthenon_app on all 4 tables (HI…
  ✓ it rejects unsafe source_key values matching DROP TABLE / quotes /…
  ✓ it is idempotent — second call on same source_key does not fail or…

   PASS  Tests\Unit\FinnGen\EndpointExpressionHasherTest
  ✓ it produces identical SHA-256 hash across semantically equivalent J…
  ✓ it produces different hash when concept_id list changes
  ✓ it normalizes integer vs float concept_ids (1234 === 1234.0)

  Tests:    7 passed (14 assertions)
  Duration: 0.28s
```

## Hash Determinism Proof

Three stability vectors pinned by EndpointExpressionHasherTest:

1. **Key-order invariance** — `['b'=>2,'a'=>1,'c'=>['z'=>1,'y'=>2]]` and `['a'=>1,'b'=>2,'c'=>['y'=>2,'z'=>1]]` produce identical hex. Recursive `ksort` walks every associative array; `array_is_list` preserves list order so `[100,200]` ≠ `[200,100]` when the caller intentionally orders concept IDs.
2. **Sensitivity to content change** — `['conditions' => [100,200]]` ≠ `['conditions' => [100,200,300]]`. Cache invalidates when endpoint expression truly changes.
3. **Integer / float normalization** — `['id' => 1234]` and `['id' => 1234.0]` produce identical hex. PHP's JSON stage can stringify a whole-number float as `1234.0` on some paths; the canonicalizer coerces integral floats to int before encoding so the hash stays stable across re-imports that roundtrip through floating point (`json_decode` → `json_encode`).

The 64-char lowercase-hex format matches Phase 14 GwasCacheKeyHasher for cross-module operational consistency; this is the canonical D-10 invalidation signal consumed by Plans 18-04 and 18-05.

## Per-Source Factory Pattern

Every Phase 18 per-source model ships the same trust-boundary factory:

```php
public static function onSource(string $sourceKey): self
{
    $normalized = strtolower($sourceKey);
    if (preg_match('/^[a-z][a-z0-9_]*$/', $normalized) !== 1) {
        throw new InvalidArgumentException("EndpointProfile{X}::onSource — unsafe source_key '{$sourceKey}'.");
    }
    $instance = new self;
    $instance->setTable("{$normalized}_co2_results.{table}");
    return $instance;
}
```

Rationale for duplicating (not factoring into a trait): each factory is an entry point into the {source}_co2_results trust boundary, and auditors grep a single file per entry rather than following a trait indirection. The `Co2SchemaProvisioner` owns the SAFE_SOURCE_REGEX constant; the 4 models inline the same regex literal for locality.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `uses(TestCase::class)` binding to both test files**

- **Found during:** Task 1 — initial Pest run
- **Issue:** `backend/tests/Pest.php` auto-binds `TestCase` only for `Feature`, `Integration`, `Unit/Services`, `Unit/Seeders`. The Plan 18-01 Wave 0 stubs at `backend/tests/Unit/FinnGen/*` relied on `markTestIncomplete` and so never touched Laravel facades. Flipping them GREEN hit `RuntimeException: A facade root has not been set.` when the provisioner called `DB::transaction`.
- **Fix:** Added `use Tests\TestCase;` + `uses(TestCase::class);` at the top of both `Co2SchemaProvisionerTest.php` and `EndpointExpressionHasherTest.php`. Did NOT widen `Pest.php`'s auto-bind list to avoid side-effects on future `Unit/FinnGen` tests that want a bare-phpunit environment.
- **Files modified:** `backend/tests/Unit/FinnGen/Co2SchemaProvisionerTest.php`, `backend/tests/Unit/FinnGen/EndpointExpressionHasherTest.php`
- **Commit:** folded into Task 1 (`7286c59ee`) and Task 2 (`01f15540c`) respectively

## Key Links

- **Co2SchemaProvisioner** → `{source}_co2_results` schema **via** single `DB::transaction` with `CREATE SCHEMA IF NOT EXISTS … AUTHORIZATION parthenon_migrator` + 4 `CREATE TABLE IF NOT EXISTS` + 2 `CREATE INDEX IF NOT EXISTS` + `DO $grants$` three-tier HIGHSEC §4.1 block
- **EndpointExpressionHasher** → `hash('sha256', json_encode(canonicalize(expr), JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR))` **pattern:** `canonicalize` = recursive `ksort` on assoc arrays (list order preserved via `array_is_list`) + integral-float-to-int coercion
- **EndpointProfile{Summary,KmPoint,Comorbidity,DrugClass}::onSource($src)** → `{src}_co2_results.{table}` **via** regex-guarded `setTable()` post-instantiation

## Self-Check: PASSED

- FOUND: backend/app/Services/FinnGen/Co2SchemaProvisioner.php
- FOUND: backend/app/Services/FinnGen/EndpointExpressionHasher.php
- FOUND: backend/app/Models/FinnGen/EndpointProfileSummary.php
- FOUND: backend/app/Models/FinnGen/EndpointProfileKmPoint.php
- FOUND: backend/app/Models/FinnGen/EndpointProfileComorbidity.php
- FOUND: backend/app/Models/FinnGen/EndpointProfileDrugClass.php
- FOUND: commit 7286c59ee (Task 1)
- FOUND: commit 01f15540c (Task 2)
