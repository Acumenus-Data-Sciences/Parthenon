---
phase: 16
plan: 01
subsystem: backend/finngen/gwas
tags: [backend, genomics, gwas, services, artisan, phpstan-l8]
requirements: [GENOMICS-04, GENOMICS-13]
dependency_graph:
  requires: []
  provides:
    - ManhattanAggregationService (thin/region/topVariants + resolveSchemaForRun)
    - GencodeService (singleton findGenesInRange)
    - parthenon:load-gencode-gtf Artisan command
    - SummaryStatsFactory (deterministic Pest fixture seeder)
  affects:
    - backend/app/Providers/AppServiceProvider.php (two new singleton bindings)
tech-stack:
  added: []
  patterns:
    - per-chrom width_bucket + ROW_NUMBER winner thinning (RESEARCH §Pattern 1)
    - UNION GWS-bypass for p < 5e-8 (D-02 / D-03)
    - schema whitelist via ^[a-z][a-z0-9_]*$ + information_schema existence check
    - singleton static-cache scan (GencodeService) for ~60k gene rows
    - SSRF-clamped --file realpath() under storage_path()
    - ".tmp → rename" atomic write for Artisan TSV output
key-files:
  created:
    - backend/app/Services/FinnGen/ManhattanAggregationService.php
    - backend/app/Services/FinnGen/GencodeService.php
    - backend/app/Console/Commands/FinnGen/LoadGencodeGtfCommand.php
    - backend/database/factories/App/FinnGen/SummaryStatsFactory.php
    - backend/tests/Unit/FinnGen/ManhattanAggregationServiceTest.php
    - backend/tests/Feature/FinnGen/LoadGencodeGtfCommandTest.php
  modified:
    - backend/app/Providers/AppServiceProvider.php (+2 use imports, +2 singleton bindings)
decisions:
  - Q6 RESOLVED via grep against GwasRunService.php — cohort_definition_id is
    the canonical Run.params key (L89 dispatchStep1, L120 dispatchStep2,
    L167 dispatchStep2AfterStep1 where $caseCohortId lands under the same
    key). Captured as ManhattanAggregationService::CASE_COHORT_PARAM_KEY so
    Plans 02+03 don't re-derive it.
  - topVariants() takes ?int $cohortDefinitionId (nullable) rather than
    reading $run->params inline. This keeps the service side-effect-free
    and lets controllers thread ownership checks before passing the key.
  - GencodeService biotype filter ships with DEFAULT_TYPES = protein_coding,
    lincRNA, lncRNA, miRNA (Pitfall 7). `includePseudogenes=true` escape
    hatch is a method argument, not a constructor flag — request-scoped
    override without state mutation.
  - SummaryStatsFactory is a plain class (not Eloquent Factory) because
    there is no Eloquent model for summary_stats — Phase 14 writes rows via
    raw Darkstar R SQL. The factory mirrors that contract with DB::table().
metrics:
  duration: ~75 minutes (planning + implementation + test iteration)
  completed: 2026-04-18
---

# Phase 16 Plan 01: Wave-1 Backend Services Foundation Summary

**One-liner:** Phase 16 thinning + gene-range service layer: ManhattanAggregationService (per-chrom width_bucket + GWS-bypass SQL, schema-whitelisted), GencodeService (singleton 60k-row TSV scanner), parthenon:load-gencode-gtf Artisan (SSRF-safe + 100 MB D-29 guard).

## What Shipped

Three backend classes plus a deterministic test-fixture seeder, wired through AppServiceProvider singleton registration. No controllers, no routes, no migrations — exactly the pure-service foundation the Wave-2/3/4 plans consume.

- **ManhattanAggregationService** (`app/Services/FinnGen/ManhattanAggregationService.php`)
  - `resolveSchemaForRun(Run) : ?string` — `{source}_gwas_results` via Source::exists() + regex whitelist + information_schema existence check (Pitfall 2 transaction-poisoning guard).
  - `thin(schema, runId, binCount, threshold) : array{variants, genome.chrom_offsets, thinning{bins, threshold, variant_count_before, variant_count_after}}` — RESEARCH §Pattern 1 CTE emitted verbatim.
  - `region(schema, runId, chrom, start, end) : array{variants, chrom, start, end}` — full-precision window for Plan 03 regional view.
  - `topVariants(schema, runId, sort, dir, limit, ?cohortDefinitionId) : array{rows, total}` — whitelisted ORDER BY column; opt-in cohort_definition_id exploits the (cohort_definition_id, p_value) BTREE (Pitfall 6).
  - `assertSchemaSafe()` re-validates schema at every public entry (defense in depth per T-16-S1).

- **GencodeService** (`app/Services/FinnGen/GencodeService.php`)
  - Singleton. Static `self::$genes` cache populated lazily on first `findGenesInRange()` call.
  - O(n) linear scan over ~60k rows; sub-millisecond per range query.
  - Default biotype filter (`DEFAULT_TYPES = protein_coding, lincRNA, lncRNA, miRNA`) with `includePseudogenes=true` argument override.
  - `resetCache()` test helper for PHP-FPM-worker-level cache busting.

- **parthenon:load-gencode-gtf** (`app/Console/Commands/FinnGen/LoadGencodeGtfCommand.php`)
  - Hard-coded URL: `https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_46/gencode.v46.basic.annotation.gff3.gz`. No `--url` flag. HTTPS-only.
  - Flags: `--force` (ignore idempotency window), `--file=<path>` (local override, SSRF-clamped).
  - 100 MB D-29 guard applied BEFORE gunzip; RuntimeException on breach.
  - Streaming gzopen + gzgets; filters `feature=gene` rows; normalizes chromosomes (strip `chr`, map `chrM → MT`).
  - Atomic TSV write: `.tmp → rename` at `storage/app/private/gencode/genes-v46.tsv`.
  - Idempotency: exits SUCCESS without work when TSV is younger than 30d.

- **SummaryStatsFactory** (`database/factories/App/FinnGen/SummaryStatsFactory.php`)
  - Plain class (no Eloquent model exists for summary_stats). `seed(schema, runId, rowsPerChrom, chroms, gwsCount, cohortDefinitionId)` writes deterministic rows via `DB::table()->insert()` chunked at 1000.
  - GWS rows (p=1e-10) are placed at the high-pos end of `chroms[0]` so they land inside an already-populated bin, guaranteeing the UNION-branch test case is exercised.

## Service Method Signatures (for Plans 02 + 03 consumption)

```php
final class ManhattanAggregationService {
    public const CASE_COHORT_PARAM_KEY = 'cohort_definition_id'; // Q6

    public function resolveSchemaForRun(Run $run): ?string;

    /** @return array{
     *   variants: list<array{chrom:string,pos:int,neg_log_p:float,snp_id:?string}>,
     *   genome: array{chrom_offsets: array<string,int>},
     *   thinning: array{bins:int,threshold:float,variant_count_before:int,variant_count_after:int}
     * }
     */
    public function thin(string $schema, string $runId, int $binCount, float $threshold): array;

    /** @return array{variants: list<array<string,mixed>>, chrom: string, start: int, end: int} */
    public function region(string $schema, string $runId, string $chrom, int $start, int $end): array;

    /** @return array{rows: list<array<string,mixed>>, total: int} */
    public function topVariants(
        string $schema, string $runId, string $sort, string $dir,
        int $limit, ?int $cohortDefinitionId = null,
    ): array;
}

final class GencodeService {
    public const DEFAULT_TYPES = ['protein_coding', 'lincRNA', 'lncRNA', 'miRNA'];

    /** @return list<array{gene_name:string,chrom:string,start:int,end:int,strand:string,gene_type:string}> */
    public function findGenesInRange(
        string $chrom, int $start, int $end, bool $includePseudogenes = false,
    ): array;
}
```

## SummaryStatsFactory Usage Pattern (for downstream Pest feature tests)

```php
use Database\Factories\App\FinnGen\SummaryStatsFactory;
use Illuminate\Support\Facades\DB;

// Create synthetic schema + table once per test file:
DB::statement('CREATE SCHEMA IF NOT EXISTS test_thinning_gwas_results');
DB::statement('CREATE TABLE test_thinning_gwas_results.summary_stats (...)'); // see Provisioner

(new SummaryStatsFactory)->seed(
    schema: 'test_thinning_gwas_results',
    runId: '01JAAAAAAAAAAAAAAAAAAAAAAA',
    rowsPerChrom: 100,
    chroms: ['1', '2', 'X'],
    gwsCount: 3,                // 3 rows at p=1e-10 on chroms[0]
    cohortDefinitionId: 1,
);
```

## Q6 Resolution (requested by Task 2 <action>)

`grep -n "cohort_definition_id\|case_cohort_id" backend/app/Services/FinnGen/GwasRunService.php` returns:

```
89:                'cohort_definition_id' => $cohortDefinitionId,
120:               'cohort_definition_id' => $cohortDefinitionId,
167:               'cohort_definition_id' => $caseCohortId,
173:               'control_cohort_definition_id' => $controlCohortId,
```

At L167, `dispatchStep2AfterStep1` explicitly maps `$caseCohortId` onto the
same `cohort_definition_id` key — confirming the Phase 15 convention that
Run.params.cohort_definition_id IS the case-cohort id. Captured as
`ManhattanAggregationService::CASE_COHORT_PARAM_KEY`. No Plan-15 param
shape change required.

## Deviations from Plan

**None.** Plan 16-01 executed exactly as written. Two minor adaptations:

1. The example test in Task 1 seeded a Run without `finished_at`. The live
   `finngen_runs_terminal_requires_finished_at` PG CHECK constraint rejects
   terminal-status rows missing `finished_at`. The seed helper was extended
   to set both `finished_at` and `started_at`. This is a test-fixture fix,
   not a plan deviation.

2. The example feature test included `use Tests\TestCase;` + `uses(TestCase::class);`.
   `backend/tests/Pest.php` already auto-extends `TestCase` for
   `Feature/**`, so these lines caused `Test case Tests\TestCase can not
   be used. The folder ... already uses the test case Tests\TestCase`.
   Removed both. Again, fixture-hygiene, not a plan deviation.

## Verification

- **Pest unit:** 7/7 green (42 assertions) — `tests/Unit/FinnGen/ManhattanAggregationServiceTest.php`
- **Pest feature:** 5/5 green (19 assertions) — `tests/Feature/FinnGen/LoadGencodeGtfCommandTest.php`
- **Plan verification command** (`tests/Unit/FinnGen/ManhattanAggregationServiceTest.php tests/Feature/FinnGen/LoadGencodeGtfCommandTest.php --no-coverage`): **12/12 green** (61 assertions) in 6.93s
- **PHPStan level 8:** clean on `app/Services/FinnGen/ManhattanAggregationService.php`, `app/Services/FinnGen/GencodeService.php`, `app/Console/Commands/FinnGen/LoadGencodeGtfCommand.php`. **Zero baseline additions.**
- **Pint:** clean on all 7 Phase 16-01 files.
- **Artisan registration:** `docker compose exec php php artisan list parthenon | grep load-gencode-gtf` → `parthenon:load-gencode-gtf  Ingest GENCODE v46 basic annotation GFF3 → ...`
- **No new migrations** under `backend/database/migrations/` (grep `16_` prefix — empty).
- **No new routes / permissions** (grep `routes/api.php` for 16-related endpoints — empty).

## Threat Model Compliance

| Threat ID | Mitigation | Evidence |
|-----------|------------|----------|
| T-16-S1 (SQL injection via {schema}) | Whitelist regex + Source::exists() + information_schema pre-check at every entry; re-validated per method | `ManhattanAggregationService::assertSchemaSafe()` called in thin/region/topVariants; test case "it throws on schema names that do not match the whitelist" asserts `InvalidArgumentException` |
| T-16-S3 (oversized GENCODE DoS) | 100 MB guard BEFORE gunzip | `LoadGencodeGtfCommand::assertUnderSizeLimit()`; test `it rejects a gz file over the 100 MB D-29 size limit` passes with 100 MB + 1 byte fixture |
| T-16-S6 (SSRF via --file) | URL hardcoded (no --url); --file clamped with realpath() + str_starts_with(storage_path()) | `LoadGencodeGtfCommand::resolveSourcePath()`; test `it rejects --file paths outside storage_path() via the SSRF guard` |
| T-16-S13 (PG transaction poisoning on schema probe) | information_schema.schemata existence check before {schema}.summary_stats SELECT | `ManhattanAggregationService::resolveSchemaForRun()` L71 precedes any dynamic-schema query |
| T-16-S2 (cache poisoning) | ACCEPT — no cache writes in this plan (caching lands in Plan 02/03) | N/A |

## Known Stubs

None. Every class surface is fully wired to either real DB queries or real file I/O. The only "stub-adjacent" behavior is GencodeService returning `[]` when `genes-v46.tsv` is missing — this is intentional: it allows staged rollouts where the Artisan command runs AFTER the backend deploy, and the regional-view gene track degrades gracefully to "no genes" instead of 500-ing.

## Self-Check: PASSED

- `backend/app/Services/FinnGen/ManhattanAggregationService.php` — FOUND
- `backend/app/Services/FinnGen/GencodeService.php` — FOUND
- `backend/app/Console/Commands/FinnGen/LoadGencodeGtfCommand.php` — FOUND
- `backend/database/factories/App/FinnGen/SummaryStatsFactory.php` — FOUND
- `backend/tests/Unit/FinnGen/ManhattanAggregationServiceTest.php` — FOUND
- `backend/tests/Feature/FinnGen/LoadGencodeGtfCommandTest.php` — FOUND
- `backend/app/Providers/AppServiceProvider.php` — MODIFIED (2 imports + 2 bindings)

Commits (worktree-agent-ac6754d7):
- `a1c3830bc test(16-01): add failing thinning + GWS bypass unit tests` — FOUND
- `59ffd586d feat(16-01): implement ManhattanAggregationService + GencodeService` — FOUND
- `258143eba feat(16-01): parthenon:load-gencode-gtf Artisan + Pest feature coverage` — FOUND
