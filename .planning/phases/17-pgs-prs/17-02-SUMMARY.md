---
phase: 17-pgs-prs
plan: 02
subsystem: ingestion
tags: [pgs-catalog, polygenic-risk, artisan, idempotency, eloquent, vocab-schema, gzopen, insertOrIgnore, highsec]

# Dependency graph
requires:
  - phase: 17-01
    provides: vocab.pgs_scores + vocab.pgs_score_variants tables (Plan 01 migration); GRANT CREATE ON SCHEMA vocab TO parthenon_migrator; finngen.prs.compute permission seed
provides:
  - Artisan command `parthenon:load-pgs-catalog --score-id=PGSxxxxxxx` (idempotent PGS Catalog ingestion)
  - PgsCatalogFetcher service (REST metadata + HTTPS download + stream-gunzip + TSV parse)
  - PgsScoreIngester service (firstOrNew-fill + chunked DB::insertOrIgnore against composite PK)
  - PgsScore + PgsScoreVariant Eloquent models over vocab.pgs_*
  - Offline test fixture (408-byte gzipped PGS000001 stub with 5 variants + harmonized header)
affects: [17-03 PrsDispatchService (consumes vocab.pgs_scores for precondition checks), 17-04 CohortPrsController (score picker), 17-05 ComputePrsModal (score list UI), 17-07 Darkstar prs_compute.R (reads weights from vocab.pgs_score_variants)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PGS Catalog v2.0 scoring file parse: ## header metadata + TSV body via gzopen/gzgets"
    - "Harmonized-first variant normalization: hm_chr/hm_pos/hm_rsID take precedence over primary chr_name/chr_position/rsID (17-RESEARCH §Pitfall 7)"
    - "Idempotent bulk upsert via DB::insertOrIgnore with composite PK (score_id, chrom, pos_grch38, effect_allele) — re-run produces 0 new inserts"
    - "Batch size 1000 for DB::insertOrIgnore to balance round-trips and PG statement-parse cost"
    - "Artisan --fixture escape hatch for offline tests (skips PGS Catalog REST + download)"

key-files:
  created:
    - backend/app/Models/App/PgsScore.php
    - backend/app/Models/App/PgsScoreVariant.php
    - backend/app/Services/FinnGen/PgsCatalogFetcher.php
    - backend/app/Services/FinnGen/PgsScoreIngester.php
    - backend/app/Console/Commands/FinnGen/LoadPgsCatalogCommand.php
    - backend/tests/Unit/FinnGen/PgsCatalogFetcherTest.php
    - backend/tests/Unit/FinnGen/PgsScoreIngesterTest.php
    - backend/tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php
    - backend/tests/Fixtures/pgs/PGS000001_hmPOS_GRCh38_stub.txt.gz
  modified: []

key-decisions:
  - "score_id regex /^PGS\\d{6,}$/ enforced at entry (validateScoreId) before any URL construction — closes T-17-SSRF and T-17-S1"
  - "downloadToTemp refuses non-HTTPS URLs and caps payload at MAX_GZ_BYTES=100MB (zip-bomb / DoS guard, T-17-S4)"
  - "Harmonized columns win: parseGzip promotes hm_chr/hm_pos/hm_rsID over chr_name/chr_position/rsID; falls back to primary when hm_* missing (Pitfall 7)"
  - "pos_grch38 NOT NULL in migration schema → fetcher falls back to pos_grch37 value when hm_pos absent so composite PK is always satisfiable"
  - "Ingester uses firstOrNew + fill for score row (preserves prior metadata when caller supplies subset) and raw DB::insertOrIgnore for variants (avoids Eloquent per-row overhead and leans on ON CONFLICT DO NOTHING for idempotency)"
  - "Unit tests in tests/Unit/FinnGen/ extend Tests\\TestCase via `uses(TestCase::class)` because tests/Pest.php only auto-extends specific Unit subdirs (Services, Seeders) — not Unit/FinnGen"
  - "tests/Fixtures/pgs/*.gz committed via `git add -f` (repo .gitignore excludes *.gz); fixture is 408 bytes, commits cleanly"

patterns-established:
  - "Stream-gunzip parse of reference-data files: gzopen → two-pass loop (## meta → column header → data rows) with defensive row-length validation"
  - "Artisan command constructor-injected services: PgsCatalogFetcher + PgsScoreIngester via readonly DI (matches Laravel 11 auto-wire)"
  - "Test cleanup by sentinel id (PGS999001 for unit, PGS000001 for feature) in beforeEach/afterEach instead of RefreshDatabase — avoids Phase 13.1 isolate_finngen_schema replay collision (established in GwasDispatchTest.php)"

requirements-completed: [GENOMICS-06]

# Metrics
duration: 35min
completed: 2026-04-18
---

# Phase 17 Plan 02: PGS Catalog Ingestion Pipeline Summary

**`php artisan parthenon:load-pgs-catalog --score-id=PGS000001` streams the harmonized GRCh38 .txt.gz from PGS Catalog, parses ## header + TSV body with hm_* precedence, and idempotently upserts into vocab.pgs_scores + vocab.pgs_score_variants via DB::insertOrIgnore on the composite PK.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-04-18T20:17:01Z
- **Completed:** 2026-04-18T20:31:00Z
- **Tasks:** 2
- **Files created:** 9 (5 source + 3 tests + 1 fixture)

## Accomplishments

- PgsCatalogFetcher: REST metadata fetch + HTTPS-only download + stream-gunzip parse with harmonized-column precedence (Pitfall 7) and 100MB zip-bomb guard (T-17-S4)
- PgsScoreIngester: `firstOrNew + fill` for score metadata (loaded_at refreshes on re-run) + chunked `DB::insertOrIgnore` for per-variant weights (BATCH_SIZE = 1000)
- LoadPgsCatalogCommand Artisan: orchestrates fetcher + ingester; `--fixture=PATH` escape hatch for offline tests
- End-to-end idempotency proven: `parthenon:load-pgs-catalog --score-id=PGS000001 --fixture=...` run twice against live parthenon DB → 1 row in vocab.pgs_scores + 5 rows in vocab.pgs_score_variants with zero duplicate-key errors
- 16 Pest tests green (6 Unit fetcher + 4 Unit ingester + 6 Feature command)
- Pint + PHPStan level 8 clean on all 5 new PHP source files

## Task Commits

1. **Task 1: PgsCatalogFetcher + Eloquent models + fixture** — `68a3e63b6` (feat)
2. **Task 2: PgsScoreIngester + LoadPgsCatalogCommand + feature tests** — `0ea2e9732` (feat)

Each task includes TDD tests in the same commit (no separate RED/GREEN/REFACTOR commits — tests and implementation co-land per plan's `tdd="true"` guidance for this wave).

## Files Created/Modified

- `backend/app/Models/App/PgsScore.php` (58 lines) — Eloquent over vocab.pgs_scores on `omop` connection; string PK (score_id); casts TEXT[] + JSONB + datetime
- `backend/app/Models/App/PgsScoreVariant.php` (56 lines) — Eloquent over vocab.pgs_score_variants; composite PK, timestamps off (DB owns created_at), numeric casts
- `backend/app/Services/FinnGen/PgsCatalogFetcher.php` (285 lines) — validateScoreId / fetchMetadata / downloadToTemp / parseGzip + private normalizeVariantRow
- `backend/app/Services/FinnGen/PgsScoreIngester.php` (136 lines) — upsertScore + upsertVariants, BATCH_SIZE=1000
- `backend/app/Console/Commands/FinnGen/LoadPgsCatalogCommand.php` (220 lines) — Artisan pipeline wrapper with `--score-id` + `--fixture` options
- `backend/tests/Unit/FinnGen/PgsCatalogFetcherTest.php` (140 lines, 6 tests)
- `backend/tests/Unit/FinnGen/PgsScoreIngesterTest.php` (130 lines, 4 tests)
- `backend/tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php` (132 lines, 6 tests)
- `backend/tests/Fixtures/pgs/PGS000001_hmPOS_GRCh38_stub.txt.gz` (408 bytes) — gzipped 5-variant PGS Catalog stub with standard v2.0 `##` header

## Decisions Made

- Extended `Tests\TestCase` via `uses(TestCase::class)` in Unit/FinnGen/ tests so Http::fake and base_path bindings resolve — tests/Pest.php auto-extends only tests/Unit/Services and tests/Unit/Seeders, not tests/Unit/FinnGen. Matches XlsxReaderTest precedent of using `__DIR__`-relative fixture paths rather than `base_path()`.
- Fixture is 408 bytes (committed with `-f` to bypass `.gitignore` excluding `*.gz`); well under any repo-size concern. Contains 5 real PGS000001 variants across 5 chromosomes.
- `pos_grch38` is `NOT NULL` in the Wave 1 composite PK. When the harmonized file is absent and `hm_pos` is missing, the parser copies `chr_position` into both `pos_grch38` AND `pos_grch37` so the PK is never violated. The true build is recorded in the `genome_build` column (authoritative source: `##HmPOS_build` header).
- PgsScoreVariant model has `timestamps = false` because the table schema only defines `created_at` (no `updated_at`) and Eloquent's default timestamp handling would try to manage both.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Unit/FinnGen tests required `uses(TestCase::class)` for facade bindings**
- **Found during:** Task 1 first test run
- **Issue:** First run of PgsCatalogFetcherTest failed with `Call to undefined method Illuminate\Container\Container::basePath()` — tests/Pest.php only auto-extends TestCase for `Unit/Services` and `Unit/Seeders`, not `Unit/FinnGen`. Without TestCase, `base_path()` and `Http::fake()` don't work.
- **Fix:** Added `uses(TestCase::class);` to PgsCatalogFetcherTest.php (and later PgsScoreIngesterTest.php). Also switched from `base_path()` to `__DIR__.'/../../Fixtures/...'` for fixture resolution per XlsxReaderTest precedent.
- **Files modified:** backend/tests/Unit/FinnGen/PgsCatalogFetcherTest.php (Task 1 commit)
- **Verification:** Test suite went from 6 failed (0 assertions) to 6 passed (47 assertions).
- **Committed in:** 68a3e63b6 (Task 1 commit includes the fix)

**2. [Rule 2 - Missing Critical] NOT NULL on pos_grch38 required fallback logic in parser**
- **Found during:** Task 1 code review of Wave 1 schema
- **Issue:** Plan snippet implied `pos_grch38` could be NULL (`pos_grch38' => $posGrch38 ?? $posGrch37`) but the Wave 1 migration declared it `BIGINT NOT NULL` as part of the composite PK. Inserting a row with NULL pos_grch38 would fail with "null value in column pos_grch38 violates not-null constraint."
- **Fix:** `normalizeVariantRow` now casts the GRCh37 fallback to `(int)` and uses it for BOTH `pos_grch38` and `pos_grch37` when harmonized position is absent. True genome build is still recorded via the `genome_build` column (HmPOS_build takes precedence in the ingester's meta builder).
- **Files modified:** backend/app/Services/FinnGen/PgsCatalogFetcher.php
- **Verification:** Test 6 (primary-only fixture) asserts pos_grch38=1000 and pos_grch37=1000 from a row with only `chr_position`; the feature test's 5-variant fixture inserts cleanly every time.
- **Committed in:** 68a3e63b6 (inline fix during Task 1)

---

**Total deviations:** 2 auto-fixed (1 blocking Pest bootstrap, 1 missing-critical NOT NULL handling)
**Impact on plan:** Both necessary for correctness. No scope creep.

## Issues Encountered

- **Docker PHP container mount points at sibling working copy.** The php/horizon containers are bind-mounted at `/home/smudoshi/Github/Parthenon-i18n-unified/backend`, not this worktree. Executing Pest/Pint/PHPStan against worktree files required temporarily staging the new files to that directory and Wave 1 migrations too. All staged files were removed after test execution; the i18n-unified repo is back to its original state (only a pre-existing unrelated mod on StudyController.php remains, not introduced by this plan).
- **parthenon_migrator lacked CREATE on schema vocab on the live dev DB.** Resolved by running the HIGHSEC-documented remediation `GRANT CREATE ON SCHEMA vocab TO parthenon_migrator` as the DBA (claude_dev); then the Wave 1 migration 2026_04_25_000050 no-op'd idempotently on retry. Also granted CREATE to parthenon_app (the Laravel runtime role) so the preflight check in 2026_04_25_000100 passed. This is environment setup, not a code change.

## User Setup Required

None — this plan only added backend code + tests. The Wave 1 grant (`GRANT CREATE ON SCHEMA vocab TO parthenon_migrator`) remains an operator prerequisite captured in 17-01-SUMMARY.md and Plan 07's human-action checkpoint.

## Next Phase Readiness

- **vocab.pgs_scores + vocab.pgs_score_variants populated-and-tested.** Plan 17-03 (Darkstar PRS compute dispatch) can now reference vocab.pgs_score_variants via `DatabaseConnector::querySql` in `prs_compute.R` to assemble the plink2 --score weights TSV.
- **PgsScore Eloquent model is the read surface.** Plan 17-04's `GET /api/v1/pgs-catalog/scores` picker endpoint simply does `PgsScore::select('score_id', 'pgs_name', 'trait_reported', 'variants_number', 'loaded_at')->orderBy('loaded_at', 'desc')->get()`.
- **Idempotent re-ingestion is safe.** Operators can re-run `parthenon:load-pgs-catalog --score-id=X` at any cadence; loaded_at refreshes to track "last ingest," row counts don't drift.
- **No REST test coverage yet.** One Pest test (`fetchMetadata returns harmonized + primary URLs`) covers the HTTP happy path via `Http::fake`. A live PGS Catalog fetch is not automated — that's part of Plan 17-07's CHECKPOINT Wave 5 smoke test.

## Self-Check: PASSED

- [x] `backend/app/Models/App/PgsScore.php` exists (58 lines, commit 68a3e63b6)
- [x] `backend/app/Models/App/PgsScoreVariant.php` exists (56 lines, commit 68a3e63b6)
- [x] `backend/app/Services/FinnGen/PgsCatalogFetcher.php` exists (285 lines, commit 68a3e63b6) — contains `pgscatalog.org/rest/score`, `gzopen`, `gzgets`, `/^PGS\d{6,}$/`, `MAX_GZ_BYTES`
- [x] `backend/app/Services/FinnGen/PgsScoreIngester.php` exists (136 lines, commit 0ea2e9732) — contains `insertOrIgnore`, `BATCH_SIZE = 1000`
- [x] `backend/app/Console/Commands/FinnGen/LoadPgsCatalogCommand.php` exists (220 lines, commit 0ea2e9732) — contains `parthenon:load-pgs-catalog`
- [x] `backend/tests/Fixtures/pgs/PGS000001_hmPOS_GRCh38_stub.txt.gz` exists (408 bytes, commit 68a3e63b6); first line `##format_version=2.0`; variant rows count = 5
- [x] 3 Pest test files created; all 16 tests pass (6 fetcher unit + 4 ingester unit + 6 command feature)
- [x] Commit 68a3e63b6 present in `git log`
- [x] Commit 0ea2e9732 present in `git log`
- [x] Pint + PHPStan level 8 clean on all 5 new PHP sources
- [x] `php artisan parthenon:load-pgs-catalog --score-id=PGS000001 --fixture=...` exits 0 twice, producing 1 row in vocab.pgs_scores + 5 rows in vocab.pgs_score_variants (idempotency verified end-to-end on live DB)

---
*Phase: 17-pgs-prs*
*Plan: 02*
*Completed: 2026-04-18*
