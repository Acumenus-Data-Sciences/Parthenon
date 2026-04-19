<?php

declare(strict_types=1);

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\User;
use App\Services\FinnGen\Co2SchemaProvisioner;
use App\Services\FinnGen\EndpointExpressionHasher;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Phase 18 GENOMICS-09/10/11 — Feature test for GET /api/v1/finngen/endpoints/{name}/profile.
 *
 * Flipped GREEN by Plan 18-04 Task 2. Covers the 3 envelope shapes from
 * 18-UI-SPEC.md plus the D-10 stale-hash path and the 42P01 partial-provision
 * fallback. Follows Phase 14/17 test isolation (no RefreshDatabase).
 *
 * Scenarios:
 *   T1: status=cached when hash matches + all 4 tables populated.
 *   T2: status=needs_compute + reason=stale_hash when cached hash != current.
 *   T3: status=needs_compute + reason=no_cache when no row exists.
 *   T4: status=ineligible + error_code=endpoint_not_resolvable when endpoint missing.
 *   T5 (bonus): status=needs_compute + reason=partial_provision when a
 *               sibling table is missing (Warning 3 guard).
 */
beforeEach(function (): void {
    $this->seed(FinnGenTestingSeeder::class);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();

    // Seed a FULLY_MAPPED endpoint with a stable qualifying_event_spec so the
    // expression-hash is deterministic across test runs.
    $this->expressionSpec = [
        'resolved_concepts' => [
            'conditions_standard' => [201826, 201254],
            'drugs_standard' => [1502905],
            'source_concept_ids' => [],
        ],
    ];
    EndpointDefinition::query()->where('name', 'E4_DM2')->delete();
    EndpointDefinition::factory()->create([
        'name' => 'E4_DM2',
        'longname' => 'Type 2 diabetes',
        'description' => 'Phase 18 Plan 04 read fixture',
        'release' => 'df14',
        'coverage_profile' => CoverageProfile::UNIVERSAL,
        'coverage_bucket' => CoverageBucket::FULLY_MAPPED,
        'qualifying_event_spec' => $this->expressionSpec,
    ]);

    $this->currentHash = app(EndpointExpressionHasher::class)->hash($this->expressionSpec);

    // Ensure pancreas_co2_results schema + 4 tables are provisioned so the
    // read path has something to query. Co2SchemaProvisioner is idempotent.
    app(Co2SchemaProvisioner::class)->provision('pancreas');

    // Clean any leftover rows from prior runs.
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_summary')
        ->where('endpoint_name', 'E4_DM2')
        ->where('source_key', 'PANCREAS')
        ->delete();
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_km_points')
        ->where('endpoint_name', 'E4_DM2')
        ->where('source_key', 'PANCREAS')
        ->delete();
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_comorbidities')
        ->where('index_endpoint', 'E4_DM2')
        ->where('source_key', 'PANCREAS')
        ->delete();
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_drug_classes')
        ->where('endpoint_name', 'E4_DM2')
        ->where('source_key', 'PANCREAS')
        ->delete();
});

afterEach(function (): void {
    // Clean rows so each test is independent.
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_summary')
        ->where('endpoint_name', 'E4_DM2')
        ->where('source_key', 'PANCREAS')
        ->delete();
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_km_points')
        ->where('endpoint_name', 'E4_DM2')
        ->where('source_key', 'PANCREAS')
        ->delete();
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_comorbidities')
        ->where('index_endpoint', 'E4_DM2')
        ->where('source_key', 'PANCREAS')
        ->delete();
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_drug_classes')
        ->where('endpoint_name', 'E4_DM2')
        ->where('source_key', 'PANCREAS')
        ->delete();
});

/**
 * Insert a fresh summary row with given hash.
 */
function seedProfileSummary(string $hash, int $subjectCount = 100): void
{
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_summary')->insert([
        'endpoint_name' => 'E4_DM2',
        'source_key' => 'PANCREAS',
        'expression_hash' => $hash,
        'subject_count' => $subjectCount,
        'death_count' => 25,
        'median_survival_days' => 730.0,
        'age_at_death_mean' => 65.5,
        'age_at_death_median' => 66.0,
        'age_at_death_bins' => '[]',
        'universe_size' => 500,
        'min_subjects' => 20,
        'source_has_death_data' => true,
        'source_has_drug_data' => true,
        'run_id' => '01HREAD0000000000000000001',
        'computed_at' => now(),
    ]);
}

it('returns status=cached with summary + km_points + comorbidities + drug_classes when hash matches', function (): void {
    seedProfileSummary($this->currentHash);
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_km_points')->insert([
        'endpoint_name' => 'E4_DM2',
        'source_key' => 'PANCREAS',
        'expression_hash' => $this->currentHash,
        'time_days' => 30.0,
        'survival_prob' => 0.98,
        'at_risk' => 100,
        'events' => 2,
    ]);
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_comorbidities')->insert([
        'index_endpoint' => 'E4_DM2',
        'source_key' => 'PANCREAS',
        'expression_hash' => $this->currentHash,
        'comorbid_endpoint' => 'E4_HYPERTENSION',
        'phi_coef' => 0.35,
        'odds_ratio' => 3.2,
        'or_ci_low' => 2.1,
        'or_ci_high' => 4.9,
        'co_count' => 45,
        'rank' => 1,
    ]);
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_drug_classes')->insert([
        'endpoint_name' => 'E4_DM2',
        'source_key' => 'PANCREAS',
        'expression_hash' => $this->currentHash,
        'atc3_code' => 'A10',
        'atc3_name' => 'DRUGS USED IN DIABETES',
        'subjects_on_drug' => 78,
        'subjects_total' => 100,
        'pct_on_drug' => 78.0,
        'rank' => 1,
    ]);

    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2/profile?source_key=PANCREAS');

    $response->assertStatus(200)
        ->assertJsonPath('status', 'cached')
        ->assertJsonStructure([
            'summary',
            'km_points',
            'comorbidities',
            'drug_classes',
            'meta' => ['universe_size', 'min_subjects', 'source_has_death_data', 'source_has_drug_data'],
        ]);
    expect($response->json('km_points'))->toHaveCount(1);
    expect($response->json('comorbidities'))->toHaveCount(1);
    expect($response->json('drug_classes'))->toHaveCount(1);
});

it('returns status=needs_compute with reason=stale_hash when cached hash differs from current expression hash', function (): void {
    // Seed a row with an obviously-different hash (64-char sentinel).
    seedProfileSummary(str_repeat('a', 64));

    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2/profile?source_key=PANCREAS');

    $response->assertStatus(200)
        ->assertJsonPath('status', 'needs_compute')
        ->assertJsonPath('reason', 'stale_hash')
        ->assertJsonPath('dispatch_url', '/api/v1/finngen/endpoints/E4_DM2/profile');
});

it('returns status=needs_compute with reason=no_cache when no row exists for endpoint x source', function (): void {
    // No summary row seeded — read path must return no_cache.
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2/profile?source_key=PANCREAS');

    $response->assertStatus(200)
        ->assertJsonPath('status', 'needs_compute')
        ->assertJsonPath('reason', 'no_cache');
});

it('returns status=ineligible with error_code=endpoint_not_resolvable when endpoint does not exist', function (): void {
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/endpoints/E4_DOES_NOT_EXIST/profile?source_key=PANCREAS');

    $response->assertStatus(200)
        ->assertJsonPath('status', 'ineligible')
        ->assertJsonPath('error_code', 'endpoint_not_resolvable');
});

it('returns status=needs_compute with reason=partial_provision when a sibling table is missing (42P01 guard)', function (): void {
    seedProfileSummary($this->currentHash);
    // Drop a sibling table AFTER seeding summary so the schema-existence check
    // passes, then the km_points read raises 42P01 on SELECT — the controller
    // MUST return needs_compute + reason=partial_provision, not 500.
    DB::connection('pgsql')->statement('DROP TABLE IF EXISTS pancreas_co2_results.endpoint_profile_km_points');

    try {
        $response = $this->actingAs($this->researcher)
            ->getJson('/api/v1/finngen/endpoints/E4_DM2/profile?source_key=PANCREAS');

        $response->assertStatus(200)
            ->assertJsonPath('status', 'needs_compute')
            ->assertJsonPath('reason', 'partial_provision');
    } finally {
        // Recreate so other tests / downstream runs aren't left in a partial state.
        app(Co2SchemaProvisioner::class)->provision('pancreas');
    }
});
