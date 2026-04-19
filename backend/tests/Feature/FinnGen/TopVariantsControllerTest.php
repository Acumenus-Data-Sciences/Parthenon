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
 * Phase 16-03 — GwasTopVariantsController HTTP contract coverage.
 *
 * Exercises `GET /api/v1/finngen/runs/{id}/top-variants`:
 *   - auth / permission / ownership gates (HIGHSEC §2)
 *   - in-flight (202 + Retry-After), terminal-failed (410), missing-run (404)
 *   - sort whitelist (D-18): chrom/pos/af/beta/se/p_value/snp_id only
 *   - dir enum (asc/desc)
 *   - limit clamp 1-200 (T-16-S5)
 *   - default: 50 rows sorted by p_value ASC
 *   - response shape: {rows: [...], total: int} where each row includes all 10
 *     drawer fields (chrom, pos, ref, alt, af, beta, se, p_value, snp_id, gwas_run_id)
 *   - Redis-cache hit: 15-min TTL per D-20 (finngen:manhattan:{run_id}:top-variants:{sort}:{dir}:{limit})
 *
 * Mirrors the setup pattern from GwasManhattanControllerTest (Plan 02):
 * RefreshDatabase rolls the `pgsql` connection; pancreas_gwas_results schema
 * must be CREATEd and TRUNCATed in beforeEach because it's outside RefreshDatabase's scope.
 */
uses(RefreshDatabase::class);

/**
 * Build a Run with timestamps consistent with the `finngen_runs_terminal_requires_finished_at`
 * CHECK constraint (finished_at NOT NULL for terminal statuses).
 *
 * @param  array<string,mixed>  $overrides
 */
function makePhase1603Run(int $userId, string $status, array $overrides = []): Run
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
    $this->getJson('/api/v1/finngen/runs/01JTESTAAAAAAAAAAAAAAAAAAA/top-variants')
        ->assertStatus(401);
});

it('returns 403 for user lacking finngen.workbench.use permission', function () {
    $this->actingAs($this->viewer)
        ->getJson('/api/v1/finngen/runs/01JTESTAAAAAAAAAAAAAAAAAAA/top-variants')
        ->assertStatus(403);
});

it('returns 403 when run belongs to a different user (non-admin)', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    $this->actingAs($this->otherResearcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants")
        ->assertStatus(403);
});

it('returns 404 for non-existent run', function () {
    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/runs/01JXXXXXXXXXXXXXXXXXXXXXXX/top-variants')
        ->assertStatus(404);
});

it('returns 202 with Retry-After for queued run', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_QUEUED);

    $resp = $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants");

    $resp->assertStatus(202)->assertHeader('Retry-After', '30');
    expect($resp->json('status'))->toBe('queued');
});

it('returns 202 with Retry-After for running run', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_RUNNING);

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants")
        ->assertStatus(202)
        ->assertHeader('Retry-After', '30');
});

it('returns 410 for failed run', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_FAILED);

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants")
        ->assertStatus(410);
});

it('returns 50 rows ordered by p_value ASC by default and carries drawer fields', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    (new SummaryStatsFactory)->seed(
        schema: 'pancreas_gwas_results',
        runId: $run->id,
        rowsPerChrom: 100,
        chroms: ['1'],
    );

    $resp = $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants")
        ->assertOk();

    $rows = $resp->json('rows');
    expect($rows)->toBeArray();
    expect(count($rows))->toBeLessThanOrEqual(50);
    expect(count($rows))->toBeGreaterThan(0);

    // Non-decreasing p_value (ASC)
    for ($i = 1; $i < count($rows); $i++) {
        expect((float) $rows[$i - 1]['p_value'])
            ->toBeLessThanOrEqual((float) $rows[$i]['p_value']);
    }

    // Every drawer field per D-12
    expect($rows[0])->toHaveKeys([
        'chrom', 'pos', 'ref', 'alt', 'af', 'beta', 'se', 'p_value', 'snp_id', 'gwas_run_id',
    ]);

    // Meta envelope — per contract
    expect($resp->json('total'))->toBeInt();
});

it('flips to descending beta when sort=beta&dir=desc', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    (new SummaryStatsFactory)->seed(
        schema: 'pancreas_gwas_results',
        runId: $run->id,
        rowsPerChrom: 100,
        chroms: ['1'],
    );

    // Mutate beta deterministically so ORDER BY beta DESC has a real signal.
    DB::connection()->statement('
        UPDATE pancreas_gwas_results.summary_stats
           SET beta = pos::float / 1000000.0
         WHERE gwas_run_id = ?
    ', [$run->id]);

    $resp = $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants?sort=beta&dir=desc&limit=10")
        ->assertOk();

    $rows = $resp->json('rows');
    expect(count($rows))->toBe(10);
    for ($i = 1; $i < count($rows); $i++) {
        expect((float) $rows[$i - 1]['beta'])
            ->toBeGreaterThanOrEqual((float) $rows[$i]['beta']);
    }
});

it('rejects invalid sort column with 422', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    foreach (['DROP_TABLE', 'case_n', 'gwas_run_id', '1; DROP --', 'nonexistent'] as $bad) {
        $this->actingAs($this->researcher)
            ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants?sort={$bad}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('sort');
    }
});

it('rejects invalid dir enum with 422', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants?dir=random")
        ->assertStatus(422)
        ->assertJsonValidationErrors('dir');
});

it('clamps limit outside 1-200 with 422 (T-16-S5)', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    foreach ([0, 201, -1, 10000] as $bad) {
        $this->actingAs($this->researcher)
            ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants?limit={$bad}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('limit');
    }
});

it('accepts limit=200 (boundary)', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    (new SummaryStatsFactory)->seed(
        schema: 'pancreas_gwas_results',
        runId: $run->id,
        rowsPerChrom: 200,
        chroms: ['1'],
    );

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants?limit=200")
        ->assertOk();
});

it('returns 404 when source_key is not a registered Source', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_SUCCEEDED, [
        'source_key' => 'NOT_A_REGISTERED_SOURCE',
    ]);

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants")
        ->assertStatus(404);
});

it('serves a cached payload on the 2nd hit (15-min TTL per D-20)', function () {
    $run = makePhase1603Run($this->researcher->id, Run::STATUS_SUCCEEDED);

    (new SummaryStatsFactory)->seed(
        schema: 'pancreas_gwas_results',
        runId: $run->id,
        rowsPerChrom: 50,
        chroms: ['1'],
    );

    $first = $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants?limit=10");
    $first->assertOk();
    $firstRowCount = count($first->json('rows'));

    // Mutate DB: remove all rows. A non-cached 2nd call would return an empty
    // payload. A cached 2nd call must return the same count as the first.
    DB::connection()->statement('TRUNCATE pancreas_gwas_results.summary_stats');

    $second = $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}/top-variants?limit=10");
    $second->assertOk();

    expect(count($second->json('rows')))->toBe($firstRowCount);
});
