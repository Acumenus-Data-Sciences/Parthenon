<?php

declare(strict_types=1);

use App\Models\App\FinnGen\Run;
use App\Models\User;
use Database\Factories\App\FinnGen\SummaryStatsFactory;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Phase 16-02 — GwasManhattanController HTTP contract coverage.
 *
 * Exercises the thinned-Manhattan endpoint `GET /api/v1/finngen/runs/{id}/manhattan`:
 *   - auth / permission / ownership gates (HIGHSEC §2)
 *   - in-flight (202 + Retry-After), terminal-failed (410), missing-run (404)
 *   - bin_count clamp (D-27)
 *   - D-04 envelope shape on SUCCEEDED run
 *
 * NOTE: RefreshDatabase rolls back the `pgsql` connection but not the raw-SQL
 * schema created for summary_stats. We CREATE SCHEMA IF NOT EXISTS and
 * TRUNCATE per test to stay deterministic; afterEach drops the table rows.
 *
 * NOTE 2: finngen.runs has a CHECK constraint
 * `finngen_runs_terminal_requires_finished_at` — terminal statuses
 * (succeeded/failed/canceled) require finished_at NOT NULL.
 */
uses(RefreshDatabase::class);

/**
 * Helper: build a Run with the right timestamps for its status so the
 * CHECK constraint passes.
 *
 * @param  array<string,mixed>  $overrides
 */
function makePhase1602Run(int $userId, string $status, array $overrides = []): Run
{
    $attrs = array_merge([
        'user_id' => $userId,
        'source_key' => 'PANCREAS',
        'analysis_type' => 'finngen.gwas.step2',
        'params' => [],
        'status' => $status,
    ], $overrides);

    if (in_array($status, [Run::STATUS_SUCCEEDED, Run::STATUS_FAILED, Run::STATUS_CANCELED], true)) {
        $attrs['started_at'] ??= now()->subMinutes(5);
        $attrs['finished_at'] ??= now();
    } elseif ($status === Run::STATUS_RUNNING) {
        $attrs['started_at'] ??= now();
    }

    return Run::create($attrs);
}

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $this->viewer = User::where('email', 'finngen-test-viewer@test.local')->firstOrFail();
    $this->otherResearcher = User::factory()->create();
    $this->otherResearcher->assignRole('researcher');

    // Create pancreas_gwas_results.summary_stats — Plan 01 ManhattanAggregationService
    // resolves this schema via Source::source_key='PANCREAS' whitelist.
    DB::connection()->statement('CREATE SCHEMA IF NOT EXISTS pancreas_gwas_results');
    DB::connection()->statement('
        CREATE TABLE IF NOT EXISTS pancreas_gwas_results.summary_stats (
            gwas_run_id VARCHAR(26) NOT NULL,
            cohort_definition_id BIGINT NOT NULL,
            chrom VARCHAR(4) NOT NULL,
            pos BIGINT NOT NULL,
            ref VARCHAR(200),
            alt VARCHAR(200),
            af DOUBLE PRECISION,
            beta DOUBLE PRECISION,
            se DOUBLE PRECISION,
            p_value DOUBLE PRECISION,
            snp_id VARCHAR(100),
            case_n INTEGER,
            control_n INTEGER
        )
    ');
    DB::connection()->statement('TRUNCATE pancreas_gwas_results.summary_stats');
    Cache::flush();
});

afterEach(function () {
    DB::connection()->statement('TRUNCATE pancreas_gwas_results.summary_stats');
});

it('returns 401 for unauthenticated', function () {
    $this->getJson('/api/v1/finngen/runs/01JTESTAAAAAAAAAAAAAAAAAAA/manhattan')
        ->assertStatus(401);
});

it('returns 403 for user lacking finngen.workbench.use permission', function () {
    $this->actingAs($this->viewer)
        ->getJson('/api/v1/finngen/runs/01JTESTAAAAAAAAAAAAAAAAAAA/manhattan')
        ->assertStatus(403);
});

it('returns 403 when run belongs to a different user (non-admin)', function () {
    $run = makePhase1602Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    $this->actingAs($this->otherResearcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/manhattan")
        ->assertStatus(403);
});

it('returns 404 for non-existent run', function () {
    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/runs/01JXXXXXXXXXXXXXXXXXXXXXXX/manhattan')
        ->assertStatus(404);
});

it('returns 202 with Retry-After for queued run', function () {
    $run = makePhase1602Run($this->researcher->id, Run::STATUS_QUEUED);

    $resp = $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/manhattan");

    $resp->assertStatus(202)->assertHeader('Retry-After', '30');
    expect($resp->json('status'))->toBe('queued');
});

it('returns 202 with Retry-After for running run', function () {
    $run = makePhase1602Run($this->researcher->id, Run::STATUS_RUNNING);

    $resp = $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/manhattan");

    $resp->assertStatus(202)->assertHeader('Retry-After', '30');
});

it('returns 410 for failed run', function () {
    $run = makePhase1602Run($this->researcher->id, Run::STATUS_FAILED);

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/manhattan")
        ->assertStatus(410);
});

it('rejects bin_count outside the 10-500 clamp with 422', function () {
    $run = makePhase1602Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    foreach ([1, 9, 501, 10000] as $bad) {
        $this->actingAs($this->researcher)
            ->getJson("/api/v1/finngen/runs/{$run->id}/manhattan?bin_count={$bad}")
            ->assertStatus(422);
    }
});

it('returns 200 with D-04 envelope shape for SUCCEEDED run owner', function () {
    $run = makePhase1602Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    (new SummaryStatsFactory)->seed(
        schema: 'pancreas_gwas_results',
        runId: $run->id,
        rowsPerChrom: 50,
        chroms: ['1', '2'],
        gwsCount: 2,
    );

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/manhattan?bin_count=100")
        ->assertOk()
        ->assertJsonStructure([
            'variants',
            'genome' => ['chrom_offsets'],
            'thinning' => ['bins', 'threshold', 'variant_count_before', 'variant_count_after'],
        ]);
});

it('returns 404 when source_key is not a registered Source', function () {
    $run = makePhase1602Run($this->researcher->id, Run::STATUS_SUCCEEDED, [
        'source_key' => 'NOT_A_REGISTERED_SOURCE',
    ]);

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/manhattan")
        ->assertStatus(404);
});
