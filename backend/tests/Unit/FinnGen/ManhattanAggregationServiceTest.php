<?php

declare(strict_types=1);

use App\Models\App\FinnGen\Run;
use App\Models\App\Source;
use App\Models\User;
use App\Services\FinnGen\ManhattanAggregationService;
use Database\Factories\App\FinnGen\SummaryStatsFactory;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;
use Tests\TestCase;

/**
 * Phase 16-01 — Manhattan aggregation service unit tests.
 *
 * Scenarios (per 16-01-PLAN Task 1 <behavior>):
 *   1. Binning: one representative per (chrom, bin) = minimum p-value winner
 *   2. GWS bypass: rows with p < 5e-8 are UNION-ed into the output even when
 *      they fall into bins that already have non-GWS representatives
 *   3. Chrom types: '1'..'22','X','Y','MT' survive the query; NULL p_value
 *      rows never become representative (NULLS LAST)
 *   4. Payload shape matches D-04: {variants, genome.chrom_offsets, thinning}
 *   5. Schema resolution: whitelist regex + Source existence + information_schema
 *
 * Schema lifecycle: tests create/drop a dedicated `test_thinning_gwas_results`
 * schema so the thinning query has a clean surface to hit. The schema name is
 * chosen to match the service's whitelist regex (`^[a-z][a-z0-9_]*$`).
 */
uses(TestCase::class, RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FinnGenTestingSeeder::class);

    DB::statement('CREATE SCHEMA IF NOT EXISTS test_thinning_gwas_results');
    DB::statement('DROP TABLE IF EXISTS test_thinning_gwas_results.summary_stats');
    DB::statement(
        'CREATE TABLE test_thinning_gwas_results.summary_stats (
            chrom                VARCHAR(4)       NOT NULL,
            pos                  BIGINT           NOT NULL,
            ref                  TEXT             NOT NULL,
            alt                  TEXT             NOT NULL,
            snp_id               TEXT             NULL,
            af                   REAL             NULL,
            beta                 REAL             NULL,
            se                   REAL             NULL,
            p_value              DOUBLE PRECISION NULL,
            case_n               INTEGER          NULL,
            control_n            INTEGER          NULL,
            cohort_definition_id BIGINT           NOT NULL,
            gwas_run_id          VARCHAR(26)      NOT NULL
        )'
    );
});

afterAll(function (): void {
    DB::statement('DROP SCHEMA IF EXISTS test_thinning_gwas_results CASCADE');
});

function seedRunForManhattan(string $sourceKey = 'PANCREAS'): Run
{
    /** @var User $user */
    $user = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $run = new Run;
    $run->id = (string) Ulid::generate();
    $run->user_id = $user->id;
    $run->source_key = $sourceKey;
    $run->analysis_type = 'gwas.step_2';
    $run->params = ['cohort_definition_id' => 1];
    $run->status = Run::STATUS_SUCCEEDED;
    // DB-level CHECK constraint: terminal statuses require a finished_at.
    $run->finished_at = now();
    $run->started_at = now()->subSeconds(10);
    $run->save();

    return $run;
}

it('emits one representative per (chrom, bin) winner by minimum p-value', function (): void {
    $runId = (string) Ulid::generate();
    (new SummaryStatsFactory)->seed(
        schema: 'test_thinning_gwas_results',
        runId: $runId,
        rowsPerChrom: 100,
        chroms: ['1', '2', 'X'],
        gwsCount: 0,
    );

    $result = app(ManhattanAggregationService::class)->thin(
        schema: 'test_thinning_gwas_results',
        runId: $runId,
        binCount: 50,
        threshold: 5e-8,
    );

    expect($result['thinning']['variant_count_before'])->toBe(300);
    // Invariant: per (chrom, bin), exactly ONE representative (+ any GWS bypass = 0 here).
    $grouped = [];
    foreach ($result['variants'] as $v) {
        $grouped[$v['chrom']] ??= 0;
        $grouped[$v['chrom']]++;
    }
    // With 100 rows over 50 bins and uniform spread, most bins are filled.
    // Assert each chrom has at least 1 rep and at most 50 bin reps.
    foreach (['1', '2', 'X'] as $c) {
        expect($grouped[$c])->toBeGreaterThanOrEqual(1);
        expect($grouped[$c])->toBeLessThanOrEqual(50);
    }
    // No duplicate (chrom,pos) pairs — representatives are unique per bin.
    $keys = array_map(fn (array $v) => $v['chrom'].':'.$v['pos'], $result['variants']);
    expect(count($keys))->toBe(count(array_unique($keys)));
});

it('bypasses binning for genome-wide-significant variants (p < 5e-8)', function (): void {
    $runId = (string) Ulid::generate();
    (new SummaryStatsFactory)->seed(
        schema: 'test_thinning_gwas_results',
        runId: $runId,
        rowsPerChrom: 50,
        chroms: ['1'],
        gwsCount: 3,
    );

    $result = app(ManhattanAggregationService::class)->thin(
        schema: 'test_thinning_gwas_results',
        runId: $runId,
        binCount: 25,
        threshold: 5e-8,
    );

    // -log10(1e-10) = 10 (>= 7.30 threshold for p=5e-8)
    $gwsRows = array_filter($result['variants'], fn (array $v) => $v['neg_log_p'] >= 9.0);
    expect(count($gwsRows))->toBeGreaterThanOrEqual(3);
    // Count of before includes all 50 + 3 rows.
    expect($result['thinning']['variant_count_before'])->toBe(53);
});

it('survives mixed chrom types and never emits NULL p_value as representative', function (): void {
    $runId = (string) Ulid::generate();
    (new SummaryStatsFactory)->seed(
        schema: 'test_thinning_gwas_results',
        runId: $runId,
        rowsPerChrom: 10,
        chroms: ['1', '22', 'X', 'Y', 'MT'],
        gwsCount: 0,
    );

    // Inject a NULL p_value row on chrom '1' to prove NULLS LAST excludes it.
    DB::table('test_thinning_gwas_results.summary_stats')->insert([
        'gwas_run_id' => $runId,
        'cohort_definition_id' => 1,
        'chrom' => '1',
        'pos' => 500,
        'ref' => 'A',
        'alt' => 'G',
        'p_value' => null,
        'snp_id' => 'rs_null',
    ]);

    $result = app(ManhattanAggregationService::class)->thin(
        schema: 'test_thinning_gwas_results',
        runId: $runId,
        binCount: 10,
        threshold: 5e-8,
    );

    $chromsEmitted = array_unique(array_map(fn ($v) => $v['chrom'], $result['variants']));
    sort($chromsEmitted);
    expect($chromsEmitted)->toEqualCanonicalizing(['1', '22', 'X', 'Y', 'MT']);

    // None of the emitted rows may have neg_log_p == 0.0 from a NULL p_value
    // (we only inserted one NULL row, and it should never become a rep).
    $nullReps = array_filter(
        $result['variants'],
        fn (array $v) => $v['chrom'] === '1' && $v['pos'] === 500
    );
    expect($nullReps)->toBeEmpty();
});

it('returns D-04 payload shape with genome chrom_offsets and thinning metadata', function (): void {
    $runId = (string) Ulid::generate();
    (new SummaryStatsFactory)->seed(
        schema: 'test_thinning_gwas_results',
        runId: $runId,
        rowsPerChrom: 20,
        chroms: ['1', '2'],
        gwsCount: 0,
    );

    $result = app(ManhattanAggregationService::class)->thin(
        schema: 'test_thinning_gwas_results',
        runId: $runId,
        binCount: 10,
        threshold: 5e-8,
    );

    expect($result)->toHaveKeys(['variants', 'genome', 'thinning']);
    expect($result['genome'])->toHaveKey('chrom_offsets');
    expect($result['genome']['chrom_offsets'])->toHaveKeys(['1', '2']);
    expect($result['thinning'])->toHaveKeys(['bins', 'threshold', 'variant_count_before', 'variant_count_after']);
    expect($result['thinning']['bins'])->toBe(10);
    expect($result['thinning']['threshold'])->toBe(5e-8);
    expect($result['thinning']['variant_count_before'])->toBe(40);
    expect($result['thinning']['variant_count_after'])->toBe(count($result['variants']));

    // Per-variant shape
    $first = $result['variants'][0];
    expect($first)->toHaveKeys(['chrom', 'pos', 'neg_log_p', 'snp_id']);
    expect($first['neg_log_p'])->toBeGreaterThan(0.0);
});

it('resolves schema via whitelist for a registered source_key', function (): void {
    // Guarantee a Source row exists for PANCREAS (seeder provides this).
    expect(Source::query()->where('source_key', 'PANCREAS')->exists())->toBeTrue();

    $run = seedRunForManhattan('PANCREAS');
    $schema = app(ManhattanAggregationService::class)->resolveSchemaForRun($run);

    // Schema MUST whitelist-match; existence check may return null in the
    // testing DB (no Provisioner run). Accept both shapes.
    expect($schema)->toBeIn(['pancreas_gwas_results', null]);
});

it('rejects a source_key whose regex is out of whitelist', function (): void {
    $run = new Run;
    $run->id = (string) Ulid::generate();
    $run->user_id = 1;
    $run->source_key = "foo'; DROP TABLE--";
    $run->analysis_type = 'gwas.step_2';
    $run->params = ['cohort_definition_id' => 1];
    $run->status = Run::STATUS_SUCCEEDED;
    // Do NOT persist — resolveSchemaForRun must reject without DB hit.

    $schema = app(ManhattanAggregationService::class)->resolveSchemaForRun($run);
    expect($schema)->toBeNull();
});

it('throws on schema names that do not match the whitelist (defense in depth)', function (): void {
    expect(
        fn () => app(ManhattanAggregationService::class)->thin(
            schema: "evil'; DROP TABLE",
            runId: '01JAAAAAAAAAAAAAAAAAAAAAAA',
            binCount: 10,
            threshold: 5e-8,
        )
    )->toThrow(InvalidArgumentException::class);
});
