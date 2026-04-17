---
phase: 13
plan: 05
subsystem: finngen
tags: [resolver, stcm, vocabulary, icd8, icdo3, nomesco, kela-reimb, pitfall-2]
requires:
  - 13-01 (TDD RED baseline with StandardFirstResolverTest + FinnishVocabResolverTest)
  - ADR-001 (STCM target schema = vocab.source_to_concept_map)
provides:
  - FinnGenConceptResolver.resolveViaStcm() private helper
  - 3 new public methods: resolveIcdO3, resolveNomesco, resolveKelaReimb
  - Pitfall 2 mitigation (invalid_reason IS NULL guards on src/std/cr)
affects:
  - FinnGenEndpointImporter (consumes resolver via public interface — unchanged)
  - R worker finngen_endpoint_generate_execute (consumes resolved arrays — unchanged)
tech-stack:
  added: []
  patterns: [STCM-first resolution, schema-qualified SQL, list-type array contracts]
key-files:
  created: []
  modified:
    - backend/app/Services/FinnGen/FinnGenConceptResolver.php (standard-first rewrite)
    - backend/tests/Unit/FinnGen/StandardFirstResolverTest.php (fix bootstrap — TestCase uses)
    - backend/tests/Unit/FinnGen/FinnishVocabResolverTest.php (fix bootstrap — TestCase uses)
decisions:
  - ADR-001 applied: all STCM SQL literally `FROM vocab.source_to_concept_map`
  - Pitfall 2 mitigated: three invalid_reason IS NULL guards (src, std, cr)
  - Public method signatures preserved for existing 4 methods (importer + R worker untouched)
  - resolveIcd8 no longer hardcoded-empty; calls resolveViaStcm('ICD8', …)
  - resolveAtc intentionally STCM-skip (KELA_REIMB → ATC is a separate method)
metrics:
  duration: ~15m
  tasks: 1
  files_modified: 3
  completed: 2026-04-17
---

# Phase 13 Plan 05: FinnGen Standard-First Resolver Summary

STCM-first resolution against `vocab.source_to_concept_map` for every FinnGen vocab, with `resolveLikeAny` as a fallback only for vocabs with native `vocab.concept` rows (ICD10CM, ICD9CM, ATC). Adds 3 new STCM-only public methods (ICDO3, NOMESCO, KELA_REIMB) and closes Pitfall 2 with three `invalid_reason IS NULL` filters.

## Tasks Completed

| Task | Name                                                      | Commit     | Files                                                         |
| ---- | --------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| 1    | STCM-first rewrite + 3 new methods + invalid_reason guard | 6e5bf8905  | FinnGenConceptResolver.php, StandardFirstResolverTest.php, FinnishVocabResolverTest.php |

## Resolver File Diff Summary

| Metric                        | Before | After | Delta   |
| ----------------------------- | ------ | ----- | ------- |
| Total lines                   | 207    | 346   | +139    |
| Public methods                | 4      | 7     | +3      |
| Private helpers               | 2      | 4     | +2 (resolveViaStcm, mergeStcmWithLikeAny) |
| SQL-level invalid_reason guards | 0    | 4     | +4 (src, std, cr in resolveLikeAny; stcm in resolveViaStcm) |
| DB::connection() target       | vocab  | vocab | unchanged (per C-13) |

Net diff (git show HEAD):
- 230 insertions, 41 deletions on resolver
- 3 insertions, 1 deletion each on the two test skeleton bootstraps

## Verification Results

### Pint

```
PASS  ........................ 1 file
```

### PHPStan level 8

```
[OK] No errors
```

### Pest — RED → GREEN transitions

```
PASS  Tests\Unit\FinnGen\StandardFirstResolverTest
  ✓ it prefers STCM target_concept_id over LIKE-ANY for ICD10_FIN source codes   2.04s
Tests: 1 passed (1 assertion) — WAS RED

PASS  Tests\Unit\FinnGen\FinnishVocabResolverTest
  ✓ it exposes resolveNomesco returning the standard resolver shape     1.98s
  ✓ it exposes resolveKelaReimb returning the standard resolver shape   0.03s
  ✓ it exposes resolveIcdO3 returning the standard resolver shape       0.03s
Tests: 3 passed (9 assertions) — WAS RED
```

### Pest — backward compatibility (must stay GREEN)

```
PASS  Tests\Feature\FinnGen\ConceptResolutionTest
  ✓ it resolveIcd10 finds at least one standard concept for I21
  ✓ it resolveIcd10 finds standard concepts across multiple prefixes
  ✓ it resolveAtc finds RxNorm-adjacent concepts for A10B prefix
  ✓ it resolveIcd9 handles Finnish trailing-letter codes by stripping them
  ✓ it resolveIcd10 returns empty arrays for genuinely unknown codes
  ✓ it resolveIcd8 always returns empty (ICD-8 not loaded)
  ✓ it rejects non-alphanumeric tokens (SQL injection defense)
  ✓ it resolveIcd10 inserts decimal for un-dotted Finnish ICD-10 codes (E291 → E29.1)
  ✓ it resolveIcd10 inserts decimal for 5-char codes (K0531 → K05.31)
  ✓ it resolveIcd10 leaves dotted codes alone
  ✓ it resolver sanitize drops single-char tokens
Tests: 11 passed (24 assertions) — NO REGRESSION

PASS  Tests\Unit\FinnGen\PatternExpansionTest
Tests: 20 passed (23 assertions) — NO REGRESSION
```

**Note on `resolveIcd8 always returns empty`:** This Feature test passes because
the resolver's `resolveIcd8()` now routes through `resolveViaStcm('ICD8', …)`,
and `vocab.source_to_concept_map` currently has **zero** ICD8 rows (Plan 04 has
not seeded yet). Once Plan 04 lands, Plan 04's own test suite (or a follow-up
edit from Plan 04) will update this expectation to match the new seeded reality.
For Plan 05 the contract is "no regression from current behavior" — satisfied.

## Sample Dry-Run Resolution

Tinker invocations skipped because this worktree points at a stale `backend/.env` path
(live docker compose is rooted at `/home/smudoshi/Github/Parthenon`, not the worktree).
Shape validation via Pest covers the same contract: `resolveNomesco(['ABC10'])`,
`resolveKelaReimb(['203'])`, `resolveIcdO3(['C50.9'])` all return
`['standard' => [], 'source' => [], 'truncated' => false]` on an un-seeded DB,
exactly as specified. Once Plan 04 seeds STCM rows, live-data dry-runs can be
re-exercised via `php artisan tinker`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Plan 01 RED test skeletons missing `TestCase::class` in `uses()`**
- **Found during:** Task 1 verification (first run of `pest --filter=StandardFirstResolverTest`)
- **Issue:** Both `StandardFirstResolverTest.php` and `FinnishVocabResolverTest.php` used only
  `uses(RefreshDatabase::class)` without including `TestCase::class`. The `backend/tests/Pest.php`
  bootstrap only extends `TestCase` for `Feature`, `Integration`, `Unit/Services`, `Unit/Seeders`
  directories — `Unit/FinnGen/` is not in that list, so the tests failed with
  "A facade root has not been set." before the assertion even ran. Every other
  existing `Unit/FinnGen/*Test.php` file correctly calls `uses(TestCase::class, RefreshDatabase::class)`
  (verified in `FinnGenArtifactServiceTest.php:16`). The Plan 01 skeletons missed this.
- **Fix:** Added `use Tests\TestCase;` import and `uses(TestCase::class, RefreshDatabase::class);`
  to both files — 1-line delta each.
- **Rationale:** Without this, the "RED → GREEN" transition the plan's success criteria demand
  is impossible — the test framework itself would never reach my resolver code.
- **Files modified:** `backend/tests/Unit/FinnGen/StandardFirstResolverTest.php`,
  `backend/tests/Unit/FinnGen/FinnishVocabResolverTest.php`
- **Commit:** 6e5bf8905 (bundled with Task 1)

## Known Stubs

None. All methods are fully wired.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced.
The resolver is application-internal (per T-13-W2C-02, acceptance: "not exposed
via HTTP route; RBAC enforced at the controller layer above the importer").

## Security Verification

- T-13-W2C-01 (LIKE-ANY injection): mitigated — `sanitize()` unchanged, still rejects
  non-alphanumeric tokens; PG text[] binding still belt-and-suspenders
- T-13-W2C-03 (DoS): mitigated — `MAX_RESOLVED=500` cap applied after merge in
  `mergeStcmWithLikeAny()`, truncation flag bubbles up
- T-13-W2C-04 (Silent coverage classification error): mitigated —
  `StandardFirstResolverTest` asserts STCM-first; backward-compat `ConceptResolutionTest`
  still GREEN
- T-13-W2C-05 (deprecated standard concept): mitigated — three `invalid_reason IS NULL`
  guards added to `resolveLikeAny`, one to `resolveViaStcm`

## Self-Check: PASSED

Verification of claims:

1. File `backend/app/Services/FinnGen/FinnGenConceptResolver.php` exists: FOUND (346 lines)
2. Commit `6e5bf8905` exists: FOUND
3. 7 public methods present: FOUND (resolveIcd10, resolveIcd9, resolveAtc, resolveIcd8,
   resolveIcdO3, resolveNomesco, resolveKelaReimb)
4. `private function resolveViaStcm` present: FOUND
5. Literal `FROM vocab.source_to_concept_map` present: FOUND
6. `AND std.invalid_reason IS NULL` present: FOUND
7. `AND cr.invalid_reason IS NULL` present: FOUND
8. `AND src.invalid_reason IS NULL` present: FOUND
9. `AND stcm.invalid_reason IS NULL` present: FOUND
10. Pint clean: CONFIRMED
11. PHPStan level 8 clean: CONFIRMED
12. StandardFirstResolverTest GREEN: CONFIRMED (1/1 passed)
13. FinnishVocabResolverTest GREEN: CONFIRMED (3/3 passed)
14. ConceptResolutionTest GREEN (no regression): CONFIRMED (11/11 passed)
15. PatternExpansionTest GREEN (no regression): CONFIRMED (20/20 passed)
