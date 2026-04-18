---
phase: 14-regenie-gwas-infrastructure
plan: 06
subsystem: finngen.gwas
tags: [gwas, regenie, artisan, smoke-test, cache-prune, highsec, d-04, d-15, d-16]
requires:
  - 14-01 (Pest skeletons)
  - 14-02 (app.finngen_source_variant_indexes + app.finngen_gwas_covariate_sets)
  - 14-03 (GwasCacheKeyHasher + GwasSchemaProvisioner + Eloquent models)
  - 14-04 (PrepareSourceVariantsCommand — super-admin gate pattern)
  - 14-05 (GwasRunService — the dispatch wrapper both commands consume)
provides:
  - `php artisan finngen:gwas-smoke-test` end-to-end smoke test (D-15, D-16)
  - `php artisan finngen:gwas-cache-prune` step-1 LOCO eviction command (D-04)
  - 12 Pest tests (4 smoke-test + 8 cache-prune, 45 assertions) covering
    happy path, dry-run, security gates, and error handling
  - Reusable super-admin gate pattern (shared 1:1 with PrepareSourceVariantsCommand
    and to be reused by Phase 15 HTTP dispatch controller)
affects:
  - Wave 6 phase-gate checkpoint (GATE-EVIDENCE.md) — smoke-test command's
    JSON summary output is the paste target
  - Phase 15 GENOMICS-03 dispatch controller — cache-prune semantics
    inform the future `auto-evict on dispatch` toggle (v1.1 revisit per D-04)
tech-stack:
  added:
    - Carbon for --older-than ISO8601 mtime reporting
    - Illuminate\Support\Facades\File for safe recursive directory deletion
  patterns:
    - Protected cacheRoot() overridable method (test isolation without
      config pollution; planner's executor-note refactor)
    - Anonymous Command subclass in Pest beforeEach → Kernel::registerCommand
      binding pattern (clean test-local override without touching DI config)
    - Structured JSONL audit trail emitted BEFORE destructive rmdir
      (T-14-29 mitigation)
    - preg_match allow-list on --source re-validated at glob-build time
      (T-14-28 mitigation — belt-and-suspenders with Laravel's input layer)
key-files:
  created:
    - backend/app/Console/Commands/FinnGen/GwasSmokeTestCommand.php
    - backend/app/Console/Commands/FinnGen/GwasCachePruneCommand.php
    - backend/tests/Feature/FinnGen/GwasSmokeTestCommandTest.php
    - backend/tests/Feature/FinnGen/GwasCachePruneCommandTest.php
    - .planning/phases/14-regenie-gwas-infrastructure/14-06-SUMMARY.md
decisions:
  - D-15 smoke-test command signature pinned: --source=PANCREAS,
    --cohort-id=221, optional --covariate-set-id (default: is_default=true
    row), --assert-cache-hit-on-rerun, --force-as-user, --timeout-minutes=30
  - D-04 cache-prune command signature pinned: --older-than=30d (accepts
    {s,m,h,d} suffix), --source filter, --dry-run, --force-as-user
  - Cache-prune's CACHE_ROOT made overridable via `protected cacheRoot()`
    method (NOT a constant) so Pest can inject a tempdir per the
    planner's executor note. Class is therefore non-final (required for
    the Pest anonymous-subclass pattern to satisfy PHPStan).
  - Smoke-test's --assert-cache-hit-on-rerun reads Run.summary.cache_hit
    (NOT Run.result — the Wave 5 R worker writes its envelope to
    summary per FinnGenRunService::markSucceeded, confirmed in
    14-05-SUMMARY)
  - Both commands gate via the identical 3-predicate pattern from
    PrepareSourceVariantsCommand (Wave 4): APP_ENV local|testing, OR
    --force-as-user resolves to super-admin, OR session user has
    super-admin. This lets all three commands share auth test fixtures
    via the same `detectEnvironment(fn () => 'production')` pattern.
  - Test mocking: smoke-test mocks FinnGenRunService (not GwasRunService)
    at the same abstraction layer Wave 5 used — so we don't re-test
    GwasRunService's precondition logic, but we DO exercise the polling
    + summary_stats assertion + cache-hit-rerun path. Faked Run instances
    use an anonymous Run subclass with fresh() overridden to return $this,
    sidestepping the cross-DB FK problem Wave 5 solved for dispatch tests.
metrics:
  duration_minutes: 25
  completed_at: 2026-04-17
  tasks_completed: 2
  files_created: 4
  tests_now_passing: 12  # 4 smoke-test + 8 cache-prune, 45 assertions total
  lines_of_code_command: ~370  # ~260 smoke-test + ~220 cache-prune after Pint
  lines_of_code_tests: ~520  # ~280 smoke-test + ~240 cache-prune
---

# Phase 14 Plan 06: GWAS Operator Commands Summary

Shipped the two operator-facing artisan commands that close out Phase 14's
execution tooling:

1. **`finngen:gwas-smoke-test`** (D-15, D-16) — end-to-end smoke test.
   Dispatches step-1, polls until terminal, dispatches step-2, polls,
   asserts ≥ 1 `{source}_gwas_results.summary_stats` row keyed by the
   step-2 run id. Optional `--assert-cache-hit-on-rerun` re-dispatches
   step-1 and asserts `summary.cache_hit=true` (GENOMICS-01 SC #2). Emits
   a single-line JSON summary on stdout that Wave 6 operators paste into
   `GATE-EVIDENCE.md`.

2. **`finngen:gwas-cache-prune`** (D-04) — the "keep-forever" default
   policy's manual safety valve. Walks
   `{CACHE_ROOT}/{source_lower}/{cache_key}/` directories, stats the
   `fit_pred.list` marker file (falls back to directory mtime when
   absent), and removes entries older than `--older-than`. `--dry-run`
   emits a JSONL eviction plan without touching disk.

Both commands sit atop `GwasRunService` (Wave 5) and reuse the
`PrepareSourceVariantsCommand` (Wave 4) super-admin gate pattern
verbatim.

## Command Surfaces

```
$ php artisan finngen:gwas-smoke-test --help
Options:
  --source[=SOURCE]                      CDM source key (normalized to lowercase internally) [default: "PANCREAS"]
  --cohort-id[=COHORT-ID]                Case cohort definition id [default: "221"]
  --covariate-set-id[=COVARIATE-SET-ID]  Defaults to the is_default=true covariate set
  --assert-cache-hit-on-rerun            After step-2 success, re-run step-1 and assert cache_hit=true (GENOMICS-01 SC #2)
  --force-as-user[=FORCE-AS-USER]        Run as user id X (super-admin test bypass)
  --timeout-minutes[=TIMEOUT-MINUTES]    Poll timeout per step [default: "30"]

$ php artisan finngen:gwas-cache-prune --help
Options:
  --older-than[=OLDER-THAN]        Age threshold (e.g., 30d, 12h, 7d, 1h, 90s) [default: "30d"]
  --source[=SOURCE]                Limit to one source subtree (preg_match allow-list validated)
  --dry-run                        Print JSONL eviction plan; do not delete
  --force-as-user[=FORCE-AS-USER]  Run as user id X (super-admin test bypass)
```

## Task 1 — GwasSmokeTestCommand (commit 53242d34e)

`backend/app/Console/Commands/FinnGen/GwasSmokeTestCommand.php` (~260 LOC
post-Pint):

| Stage | Method | Behavior |
|-------|--------|----------|
| Auth gate | `authorizedToRun()` | 3-predicate: APP_ENV local\|testing OR --force-as-user resolves to super-admin OR session super-admin |
| Input validation | inline | preg_match allow-list on --source; ctype_digit on --cohort-id |
| Covariate resolution | `resolveCovariateSetId()` | Explicit --covariate-set-id wins; else GwasCovariateSet::where('is_default', true)->firstOrFail() |
| Precondition | inline | SourceVariantIndex::exists() check before dispatch |
| Step-1 dispatch | `GwasRunService::dispatchStep1()` | Wave 5 service; throws SourceNotPreparedException → exit 1 |
| Step-1 poll | `pollUntilTerminal()` | 5s interval, 30-min default deadline, emits status transitions |
| Step-2 dispatch | `GwasRunService::dispatchStep2()` | Wave 5 service; throws Step1ArtifactMissingException → exit 1 |
| Step-2 poll | `pollUntilTerminal()` | Same semantics as step-1 |
| Assertion | `countSummaryStatsRows()` | Parameterized `SELECT COUNT(*) FROM {source}_gwas_results.summary_stats WHERE gwas_run_id = ?` |
| Rerun (optional) | `extractCacheHit()` | Pulls cache_hit from Run.summary envelope |
| Output | `printSummary()` | Single-line JSON; Wave 6 GATE-EVIDENCE.md parse target |

HIGHSEC posture:
- §1.1 super-admin gate (identical to Wave 4)
- §3.2 read-only on summary_stats; all mutation through Wave 5 service
- §10 no shell_exec / passthru / exec — all work through Horizon + Darkstar

Pest suite:

```
PASS  Tests\Feature\FinnGen\GwasSmokeTestCommandTest
  ✓ it runs step-1 → step-2 end-to-end with mocked FinnGenRunService
  ✓ it fails fast when source has no variant index
  ✓ it refuses to run without super-admin gate when APP_ENV is production
  ✓ it rejects invalid --source format

  Tests:    4 passed (13 assertions)
```

**Test mocking strategy:** swap FinnGenRunService with an anonymous
subclass whose `create()` returns hand-built Run instances with
`fresh()` overridden to return `$this`. This satisfies the command's
poll loop (which calls `$run->fresh()` first) without persisting rows
through the cross-DB connection Wave 5 documented as problematic.
The fake also inserts a synthetic row into
`pancreas_gwas_results.summary_stats` on step-2 success so the
`COUNT(*)` assertion sees data.

## Task 2 — GwasCachePruneCommand (commit 0a43eec7b)

`backend/app/Console/Commands/FinnGen/GwasCachePruneCommand.php` (~220
LOC post-Pint):

| Stage | Method | Behavior |
|-------|--------|----------|
| Auth gate | `authorizedToRun()` | Same 3-predicate as Wave 4 |
| Age parse | `parseAge()` | preg_match /^(\d+)([smhd])$/ with match expression → seconds |
| Cache root | `cacheRoot()` | **protected method** (overridable for tests) — reads `finngen.artifacts_path` config + `/gwas/step1` subpath |
| Glob build | `buildGlobPath()` | Re-validates --source against preg_match allow-list (T-14-28 belt-and-suspenders) |
| Enumeration | `glob($path, GLOB_ONLYDIR)` | Handles missing cache root as 0 candidates (no-op) |
| Marker stat | inline | `@filemtime(fit_pred.list)`; falls back to directory mtime when absent |
| Audit trail | `emitJsonLine()` | Per-directory JSONL BEFORE each rmdir (T-14-29 mitigation) |
| Deletion | `File::deleteDirectory()` | Laravel facade; no shell_exec / exec |
| Summary | `emitJsonLine()` | Final line with status/evicted/skipped/errors/dry_run |

The class is NOT `final` — the Pest tests depend on an anonymous
subclass that overrides `cacheRoot()` to point at a tempdir. This
pattern was explicitly suggested in the plan's executor note. PHPStan
would have flagged `final` + anon-subclass with `Anonymous class extends
final class`, so non-final is required.

Pest suite:

```
PASS  Tests\Feature\FinnGen\GwasCachePruneCommandTest
  ✓ it rejects invalid --older-than format
  ✓ it --dry-run lists old candidates but does not delete
  ✓ it deletes old cache directories when not in dry-run
  ✓ it --source filter limits scope to that subtree
  ✓ it rejects unsafe --source via preg_match allow-list (T-14-28)
  ✓ it no-op on empty cache (exits 0 with evicted=0)
  ✓ it refuses to run without super-admin gate when APP_ENV is production
  ✓ it falls back to directory mtime when fit_pred.list is absent

  Tests:    8 passed (32 assertions)
```

Real-world sanity check against the empty `/opt/finngen-artifacts/gwas/step1`
volume in the dev PHP container:

```
$ APP_ENV=local php artisan finngen:gwas-cache-prune --older-than=30d --dry-run
{"status":"ok","evicted":0,"skipped":0,"errors":0,"dry_run":true,"older_than":"30d","cache_root":"/opt/finngen-artifacts/gwas/step1"}
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] PHPStan `classConstant.finalClassAnonymous` on cache-prune test**
- **Found during:** PHPStan level 8 analysis on `GwasCachePruneCommandTest.php`
- **Issue:** Original plan pseudo-code had `final class GwasCachePruneCommand`; Pest's anonymous subclass (for `cacheRoot()` override) triggered `Anonymous class extends final class`. Constructor also flagged as `method.staticCall`.
- **Fix:** Dropped `final` modifier from `GwasCachePruneCommand`; refactored the anonymous subclass to use a public settable property `$testCacheRoot` instead of a constructor-injected readonly (avoids the static-call false positive on parent::__construct from within an anonymous class).
- **Files modified:** `backend/app/Console/Commands/FinnGen/GwasCachePruneCommand.php`, `backend/tests/Feature/FinnGen/GwasCachePruneCommandTest.php`
- **Commit:** `0a43eec7b`

**2. [Rule 3 — Blocking] Pint `class_definition, fully_qualified_strict_types` on test files**
- **Found during:** Pint --test check on both test files
- **Issue:** Pint flagged the same `class_definition` issue that Wave 4 hit — anonymous class brace on same line + hoisted FQN imports.
- **Fix:** Ran `vendor/bin/pint` (no `--test`) to auto-apply fixes. Final files Pint-clean.
- **Commits:** `53242d34e`, `0a43eec7b`

### Auto-approved deviations (from plan)

**Test mocking at FinnGenRunService layer (not GwasRunService)** — the
plan suggested mocking FinnGenClient::submitJob per the Wave 0
skeleton. Shipped at the FinnGenRunService layer instead, matching Wave
5's GwasDispatchTest strategy. We exercise the full GwasRunService
precondition + cache_key hashing path (real code), then fake only the
final FinnGenRunService::create() call to sidestep the cross-DB FK on
`users(id)` that Wave 5 documented. Same contract exercised; cleaner
abstraction.

**`cacheRoot()` as protected method (not class constant)** — the plan
offered "refactor the const to be overridable via a protected method"
as one option. Shipped exactly that. The const
`DEFAULT_CACHE_SUBPATH` remains as documentation; the resolved path
comes from `cacheRoot()` which reads the `finngen.artifacts_path`
config (honoring `FINNGEN_ARTIFACTS_PATH` env override).

**Fallback to directory mtime when fit_pred.list is absent** — the plan
said "stat the fit_pred.list mtime; if missing, the directory mtime."
Shipped exactly that via `@filemtime(is_file($marker) ? $marker : $cacheDir)`.
Test case 8 pins this semantic.

### Environmental blockers

Pre-commit hook bypassed via `--no-verify` per the prompt's
`<sequential_execution>` directive. The i18n sibling worktree
bind-mount has the pre-existing `bootstrap/app.php` Pint nit +
`NotifiesOnCompletion` trait.unused false-positive that Wave 5
documented.

The Docker PHP container bind-mounts `/home/smudoshi/Github/Parthenon/backend`
(main repo). All Pint/PHPStan/Pest verification happened against a
copy at the bind-mount source; the committed worktree files are
byte-identical to the verified copy.

## Acceptance Criteria — Checklist

- [x] 2 tasks in 14-06-PLAN.md executed
- [x] 2 commits with `feat(14-06): <summary>` message: `53242d34e` + `0a43eec7b`
- [x] SUMMARY.md created at `.planning/phases/14-regenie-gwas-infrastructure/14-06-SUMMARY.md`
- [x] `backend/app/Console/Commands/FinnGen/GwasSmokeTestCommand.php` created with the required signature (all 6 flags)
- [x] `backend/app/Console/Commands/FinnGen/GwasCachePruneCommand.php` created with the required signature (all 4 flags)
- [x] Both commands super-admin gated (HIGHSEC §1.1) — mirror the Wave 4 `PrepareSourceVariantsCommand` gate logic exactly
- [x] 2 Pest test files with happy path + dry-run + bad-input cases:
  - GwasSmokeTestCommandTest: 4 tests (happy path, no variant index, prod gate, invalid --source)
  - GwasCachePruneCommandTest: 8 tests (garbage age, dry-run, real delete, --source filter, unsafe --source, empty cache, prod gate, mtime fallback)
- [x] Pint + PHPStan clean on all 4 new files (verified against Docker PHP container)
- [x] No `shell_exec`, `passthru`, `exec(`, or `docker exec`/`docker run` outside docblock mentions
- [x] `GwasCachePruneCommand --dry-run` on empty cache exits 0 with `evicted=0`, `errors=0`, `status=ok`
- [x] `grep -c "fit_pred\.list" GwasCachePruneCommand.php` returns ≥ 1 (actually 3 — marker-file semantics)

## Handoff to Wave 6 + Phase 15

**Wave 6 (phase-gate checkpoint)** — the real-world end-to-end test:

```bash
# On the dev box, after PrepareSourceVariantsCommand --force has populated
# the PANCREAS variant index + the Darkstar regenie image is ready:
docker compose exec php php artisan finngen:gwas-smoke-test \
  --source=PANCREAS \
  --cohort-id=221 \
  --force-as-user=1 \
  --assert-cache-hit-on-rerun \
  --timeout-minutes=45

# Expected stdout (paste into GATE-EVIDENCE.md):
# {"status":"ok","source":"PANCREAS","cohort_id":221,"covariate_set_id":1,
#  "step1_run_id":"01H...","step2_run_id":"01H...","summary_stats_rows":N,
#  "cache_hit_on_rerun":true}
```

The cache-prune command ships as-is for operator use; ops docs will
note the recommended "always `--dry-run` first" cadence.

**Phase 15 (GENOMICS-03 dispatch API)** does NOT need these commands
directly — the HTTP controller calls `GwasRunService::dispatchStep1` /
`dispatchStep2` itself. But the smoke-test command's JSON summary
shape becomes the `POST /api/v1/finngen/endpoints/{name}/gwas`
response envelope's inspiration. And the cache-prune command will
eventually be wrapped by a scheduled Artisan task (decision deferred
to v1.1 per D-04).

## Threat Flags

None — both commands stay inside the threat boundaries established by
the plan's threat_model section (T-14-28, T-14-29, T-14-30, T-14-31
all mitigated as designed). No new surfaces introduced.

## Commits

| Task | Commit | Scope |
|------|--------|-------|
| 1 | `53242d34e` | `feat(14-06): add GwasSmokeTestCommand + Pest (D-15, D-16)` |
| 2 | `0a43eec7b` | `feat(14-06): add GwasCachePruneCommand + Pest (D-04)` |

## Self-Check: PASSED

**Files created (all 4 present on disk in worktree):**
```
backend/app/Console/Commands/FinnGen/GwasSmokeTestCommand.php        FOUND (15,542 bytes)
backend/app/Console/Commands/FinnGen/GwasCachePruneCommand.php       FOUND
backend/tests/Feature/FinnGen/GwasSmokeTestCommandTest.php           FOUND
backend/tests/Feature/FinnGen/GwasCachePruneCommandTest.php          FOUND
```

**Commits present in git log:**
```
53242d34e feat(14-06): add GwasSmokeTestCommand + Pest (D-15, D-16)     FOUND
0a43eec7b feat(14-06): add GwasCachePruneCommand + Pest (D-04)          FOUND
```

**Pest results:** 12 passed (4 + 8), 45 assertions, 0 failed, 0 skipped.

**Pint + PHPStan:** green on all 4 changed files (verified via Docker
PHP container `vendor/bin/pint --test` + `vendor/bin/phpstan analyse`).

**Command registration:** `php artisan finngen:gwas-smoke-test --help`
lists all 6 flags; `php artisan finngen:gwas-cache-prune --help`
lists all 4 flags.

**No forbidden callsites:** grep for `shell_exec|passthru|exec(|docker
run|docker exec` in both commands returns only docblock mentions
(zero actual invocations).

**Empty-cache dry-run:** `APP_ENV=local php artisan finngen:gwas-cache-prune
--older-than=30d --dry-run` returns exit 0, `evicted=0`, `status=ok`.
