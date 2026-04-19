<?php

declare(strict_types=1);

use App\Models\App\FinnGen\Run;
use App\Models\User;
use Database\Factories\App\FinnGen\SummaryStatsFactory;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

/**
 * Phase 16-02 — GwasManhattanController::region HTTP contract coverage.
 *
 * Exercises `GET /api/v1/finngen/runs/{id}/manhattan/region?chrom=&start=&end=`:
 *   - chrom regex whitelist (D-18)
 *   - 2 Mb window guard (T-16-S4)
 *   - full-resolution (non-thinned) payload within bounded window
 *
 * The regional view is NOT cached — small windows, always live.
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();

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

    $this->run = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'PANCREAS',
        'analysis_type' => 'finngen.gwas.step2',
        'params' => [],
        'status' => Run::STATUS_SUCCEEDED,
        'started_at' => now()->subMinutes(5),
        'finished_at' => now(),
    ]);

    (new SummaryStatsFactory)->seed(
        schema: 'pancreas_gwas_results',
        runId: $this->run->id,
        rowsPerChrom: 50,
        chroms: ['1', '2', 'X'],
    );
});

afterEach(function () {
    DB::connection()->statement('TRUNCATE pancreas_gwas_results.summary_stats');
});

it('rejects chrom="23" (out of whitelist) with 422', function () {
    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$this->run->id}/manhattan/region?chrom=23&start=1&end=1000")
        ->assertStatus(422)
        ->assertJsonValidationErrors('chrom');
});

it('rejects chrom="chr1" (with chr prefix) with 422', function () {
    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$this->run->id}/manhattan/region?chrom=chr1&start=1&end=1000")
        ->assertStatus(422)
        ->assertJsonValidationErrors('chrom');
});

it('accepts chrom="X"', function () {
    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$this->run->id}/manhattan/region?chrom=X&start=1000&end=500000")
        ->assertOk();
});

it('accepts chrom="MT"', function () {
    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$this->run->id}/manhattan/region?chrom=MT&start=1&end=1000")
        ->assertOk();
});

it('rejects end <= start with 422', function () {
    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$this->run->id}/manhattan/region?chrom=1&start=500&end=500")
        ->assertStatus(422);
});

it('rejects window > 2 Mb with 422 (T-16-S4)', function () {
    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$this->run->id}/manhattan/region?chrom=1&start=1&end=3000000")
        ->assertStatus(422)
        ->assertJsonValidationErrors('end');
});

it('returns full-resolution variants for valid window', function () {
    $resp = $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$this->run->id}/manhattan/region?chrom=1&start=0&end=600000");

    $resp->assertOk()->assertJsonStructure([
        'variants',
        'chrom',
        'start',
        'end',
    ]);

    // Full-res row schema: chrom/pos/ref/alt/af/beta/se/p_value/snp_id
    $rows = $resp->json('variants');
    expect($rows)->toBeArray();
    if (count($rows) > 0) {
        expect($rows[0])->toHaveKeys(['chrom', 'pos', 'ref', 'alt', 'af', 'beta', 'se', 'p_value', 'snp_id']);
    }
});

it('returns 403 for non-owner', function () {
    $other = User::factory()->create();
    $other->assignRole('researcher');

    $this->actingAs($other)
        ->getJson("/api/v1/finngen/runs/{$this->run->id}/manhattan/region?chrom=1&start=1&end=1000")
        ->assertStatus(403);
});

it('returns 401 for unauthenticated', function () {
    $this->getJson("/api/v1/finngen/runs/{$this->run->id}/manhattan/region?chrom=1&start=1&end=1000")
        ->assertStatus(401);
});
