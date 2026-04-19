<?php

declare(strict_types=1);

use App\Models\App\FinnGen\EndpointGwasRun;
use App\Models\App\FinnGen\Run;
use App\Models\User;
use App\Services\FinnGen\GwasRunService;
use App\Services\FinnGen\GwasSchemaProvisioner;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;
use Tests\TestCase;

/**
 * Phase 15 Plan 08 — FinnGenGwasRunObserver unit coverage.
 *
 * Six scenarios from 15-RESEARCH §Validation Architecture Test Map (GENOMICS-05):
 *   (1) step-2 success → tracking row status/finished_at backfill
 *   (2) step-2 success with summary → case_n / control_n backfill
 *   (3) step-2 success with seeded summary_stats → top_hit_p_value backfill
 *   (4) top_hit_p_value MIN query error is swallowed (tracking row unblocked)
 *   (5) observer is idempotent (repeated status updates don't double-insert)
 *   (6) step-1 failure → tracking row status=failed + finished_at
 */
uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    app(GwasSchemaProvisioner::class)->provision('pancreas');
    $this->user = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();

    // Clear any residual tracking rows from prior runs.
    EndpointGwasRun::query()->delete();
});

function seedRun(int $userId, string $analysisType, string $status = Run::STATUS_QUEUED, array $extra = []): Run
{
    $run = new Run;
    $run->id = (string) Ulid::generate();
    $run->user_id = $userId;
    $run->source_key = 'PANCREAS';
    $run->analysis_type = $analysisType;
    $run->params = ['cohort_definition_id' => 1];
    $run->status = $status;
    foreach ($extra as $k => $v) {
        $run->{$k} = $v;
    }
    $run->save();

    return $run;
}

function seedTracking(Run $step2Run, ?Run $step1Run = null, string $status = 'queued'): EndpointGwasRun
{
    return EndpointGwasRun::create([
        'endpoint_name' => 'E4_DM2',
        'source_key' => 'PANCREAS',
        'control_cohort_id' => 1,
        'covariate_set_id' => 1,
        'run_id' => (string) $step2Run->id,
        'step1_run_id' => $step1Run?->id,
        'status' => $status,
    ]);
}

it('backfills status on step-2 success', function () {
    $run = seedRun($this->user->id, GwasRunService::ANALYSIS_TYPE_STEP2);
    $tracking = seedTracking($run);

    $run->update(['status' => Run::STATUS_SUCCEEDED, 'finished_at' => now()]);

    $tracking->refresh();
    expect($tracking->status)->toBe('succeeded');
    expect($tracking->finished_at)->not->toBeNull();
});

it('backfills case_n and control_n from summary', function () {
    $run = seedRun($this->user->id, GwasRunService::ANALYSIS_TYPE_STEP2);
    $tracking = seedTracking($run);

    $run->update([
        'status' => Run::STATUS_SUCCEEDED,
        'summary' => ['case_n' => 42, 'control_n' => 100],
        'finished_at' => now(),
    ]);

    $tracking->refresh();
    expect((int) $tracking->case_n)->toBe(42);
    expect((int) $tracking->control_n)->toBe(100);
});

it('computes top_hit_p_value via MIN query against the per-source summary_stats', function () {
    // pancreas_gwas_results.summary_stats is provisioned in testing DB.
    $run = seedRun($this->user->id, GwasRunService::ANALYSIS_TYPE_STEP2);
    $tracking = seedTracking($run);

    // Seed two rows — the MIN should resolve to 4.2e-9.
    DB::connection('pgsql')->statement(
        'INSERT INTO pancreas_gwas_results.summary_stats (gwas_run_id, cohort_definition_id, p_value, chrom, pos, ref, alt, snp_id, af, beta, se, case_n, control_n)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $run->id, 1, 0.05, '1', 1000, 'A', 'G', 'rs1', 0.3, 0.1, 0.05, 1, 1,
            $run->id, 1, 4.2e-9, '1', 2000, 'A', 'G', 'rs2', 0.2, 0.5, 0.05, 1, 1,
        ],
    );

    try {
        $run->update(['status' => Run::STATUS_SUCCEEDED, 'finished_at' => now()]);
        $tracking->refresh();
        expect((float) $tracking->top_hit_p_value)->toEqualWithDelta(4.2e-9, 1e-12);
    } finally {
        DB::connection('pgsql')->table('pancreas_gwas_results.summary_stats')
            ->where('gwas_run_id', $run->id)->delete();
    }
});

it('swallows top_hit_p_value MIN query failure on a nonexistent source schema', function () {
    $run = seedRun($this->user->id, GwasRunService::ANALYSIS_TYPE_STEP2);

    $tracking = EndpointGwasRun::create([
        'endpoint_name' => 'E4_DM2',
        'source_key' => 'NONEXISTENT_SOURCE',  // no nonexistent_source_gwas_results schema
        'control_cohort_id' => 1,
        'covariate_set_id' => 1,
        'run_id' => (string) $run->id,
        'step1_run_id' => null,
        'status' => 'queued',
    ]);

    // Observer MUST NOT throw — query failure is caught and logged.
    expect(fn () => $run->update(['status' => Run::STATUS_SUCCEEDED, 'finished_at' => now()]))
        ->not->toThrow(Throwable::class);

    $tracking->refresh();
    expect($tracking->top_hit_p_value)->toBeNull();
    // Status still flips to succeeded — the MIN query is bonus backfill.
    expect($tracking->status)->toBe('succeeded');
});

it('is idempotent on repeated status updates', function () {
    $run = seedRun($this->user->id, GwasRunService::ANALYSIS_TYPE_STEP2);
    $tracking = seedTracking($run);

    $run->update(['status' => Run::STATUS_SUCCEEDED, 'summary' => ['case_n' => 42, 'control_n' => 100], 'finished_at' => now()]);
    $firstState = $tracking->fresh();

    // Force another update with identical fields — observer should converge.
    $run->update(['updated_at' => now()->addSecond()]);
    $secondState = $tracking->fresh();

    expect($secondState->status)->toBe($firstState->status);
    expect((int) $secondState->case_n)->toBe((int) $firstState->case_n);
    expect((int) $secondState->control_n)->toBe((int) $firstState->control_n);
    expect(EndpointGwasRun::query()->count())->toBe(1);
});

it('marks tracking row failed when step-1 fails', function () {
    $step1Run = seedRun($this->user->id, GwasRunService::ANALYSIS_TYPE_STEP1);
    $step2Run = seedRun($this->user->id, GwasRunService::ANALYSIS_TYPE_STEP2);
    $tracking = seedTracking($step2Run, $step1Run);

    $step1Run->update(['status' => Run::STATUS_FAILED, 'finished_at' => now()]);

    $tracking->refresh();
    expect($tracking->status)->toBe('failed');
    expect($tracking->finished_at)->not->toBeNull();
});
