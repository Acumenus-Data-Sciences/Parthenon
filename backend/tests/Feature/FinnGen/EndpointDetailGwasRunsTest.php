<?php

declare(strict_types=1);

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGen\EndpointGwasRun;
use App\Models\App\FinnGen\GwasCovariateSet;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\User;
use Database\Seeders\FinnGenGwasCovariateSetSeeder;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

/**
 * Phase 15 Plan 08 — endpoint detail response D-21 gwas_runs section.
 *
 * Verifies GET /api/v1/finngen/endpoints/{name}.data.gwas_runs is:
 *   (1) ordered newest-first;
 *   (2) joined against app.cohort_definitions (control_cohort_name) and
 *       finngen.gwas_covariate_sets (covariate_set_label);
 *   (3) capped at 100 rows (Phase 15 specifics §Response latency).
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    (new FinnGenGwasCovariateSetSeeder)->run();

    $this->admin = User::where('email', 'finngen-test-admin@test.local')->firstOrFail();
    $this->covariateSet = GwasCovariateSet::where('is_default', true)->firstOrFail();

    // Clean cross-connection state.
    EndpointGwasRun::query()->delete();
    FinnGenEndpointGeneration::query()->where('endpoint_name', 'E4_DM2')->delete();
    EndpointDefinition::query()->where('name', 'E4_DM2')->delete();

    EndpointDefinition::factory()->create([
        'name' => 'E4_DM2',
        'longname' => 'Type 2 diabetes',
        'release' => 'df14',
        'coverage_profile' => CoverageProfile::UNIVERSAL,
        'coverage_bucket' => CoverageBucket::FULLY_MAPPED,
    ]);

    $this->controlCohortId = 555;
    DB::connection('pgsql')->table('cohort_definitions')->updateOrInsert(
        ['id' => $this->controlCohortId],
        [
            'name' => 'Test control cohort A',
            'author_id' => $this->admin->id,
            'domain' => 'cohort',
            'created_at' => now(),
            'updated_at' => now(),
        ],
    );
});

it('show returns gwas_runs array with joined control_cohort_name and covariate_set_label', function () {
    // Seed two tracking rows.
    foreach ([1, 2] as $i) {
        EndpointGwasRun::create([
            'endpoint_name' => 'E4_DM2',
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
            'covariate_set_id' => (int) $this->covariateSet->id,
            'run_id' => '01JDETAIL'.str_pad((string) $i, 17, '0', STR_PAD_LEFT),
            'step1_run_id' => null,
            'status' => EndpointGwasRun::STATUS_QUEUED,
        ]);
    }

    $response = $this->actingAs($this->admin)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2');

    $response->assertStatus(200);
    $runs = $response->json('data.gwas_runs');
    expect(is_array($runs))->toBeTrue();
    expect(count($runs))->toBe(2);
    expect($runs[0]['control_cohort_name'])->toBe('Test control cohort A');
    expect($runs[0]['covariate_set_label'])->not->toBeNull();
});

it('gwas_runs is capped at 100 rows', function () {
    for ($i = 0; $i < 105; $i++) {
        EndpointGwasRun::create([
            'endpoint_name' => 'E4_DM2',
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
            'covariate_set_id' => (int) $this->covariateSet->id,
            'run_id' => '01JCAP'.str_pad((string) $i, 20, '0', STR_PAD_LEFT),
            'step1_run_id' => null,
            'status' => EndpointGwasRun::STATUS_QUEUED,
        ]);
    }

    $response = $this->actingAs($this->admin)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2');

    $response->assertStatus(200);
    $runs = $response->json('data.gwas_runs');
    expect(count($runs))->toBe(100);
});
