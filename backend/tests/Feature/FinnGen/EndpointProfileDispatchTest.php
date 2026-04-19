<?php

declare(strict_types=1);

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\User;
use App\Services\FinnGen\EndpointProfileDispatchService;
use App\Services\FinnGen\FinnGenRunService;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Phase 18 GENOMICS-09/10/11 — Feature test for POST /api/v1/finngen/endpoints/{name}/profile.
 *
 * Flipped GREEN by Plan 18-04 Task 2. Follows the Phase 14 GwasDispatchTest /
 * Phase 17 PrsDispatchTest precedent:
 *   - NO RefreshDatabase — collides with Phase 13.1 isolate_finngen_schema
 *     ALTER TABLE ... SET SCHEMA migration on replay (42P07 duplicate).
 *   - Fake FinnGenRunService so the test never inserts finngen.runs rows.
 *   - Seeds minimal pancreas.death + pancreas.observation_period so
 *     EndpointProfileDispatchService's precondition 2 passes.
 *
 * Scenarios (maps to <behavior> in 18-04-PLAN.md):
 *   T1: 202 envelope shape when all preconditions pass.
 *   T2: 422 source_ineligible when source has no death AND no obs_period.
 *   T3: 422 endpoint_not_resolvable when endpoint has no concepts.
 *   T4: 403 when caller lacks finngen.endpoint_profile.compute (viewer).
 *   T5: 202 even when access-log write fails (T-18-05 middleware try-catch).
 */
beforeEach(function (): void {
    $this->seed(FinnGenTestingSeeder::class);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $this->viewer = User::where('email', 'finngen-test-viewer@test.local')->firstOrFail();

    // Seed a FULLY_MAPPED endpoint with resolved concepts so precondition 3
    // (endpoint_not_resolvable) passes. Explicit non-empty resolved_concepts
    // avoids the factory's default empty shape.
    EndpointDefinition::query()->where('name', 'E4_DM2')->delete();
    EndpointDefinition::factory()->create([
        'name' => 'E4_DM2',
        'longname' => 'Type 2 diabetes',
        'description' => 'Phase 18 Plan 04 dispatch fixture',
        'release' => 'df14',
        'coverage_profile' => CoverageProfile::UNIVERSAL,
        'coverage_bucket' => CoverageBucket::FULLY_MAPPED,
        'qualifying_event_spec' => [
            'resolved_concepts' => [
                'conditions_standard' => [201826, 201254, 201531],
                'drugs_standard' => [1502905, 1503297],
                'source_concept_ids' => [45567100],
            ],
        ],
    ]);

    // Also seed an UNMAPPED endpoint with zero concepts so the T3 scenario
    // (endpoint_not_resolvable) can hit the precondition.
    EndpointDefinition::query()->where('name', 'E4_UNMAPPED')->delete();
    EndpointDefinition::factory()->create([
        'name' => 'E4_UNMAPPED',
        'longname' => 'Unmapped endpoint',
        'description' => 'Phase 18 Plan 04 precondition-fail fixture',
        'release' => 'df14',
        'coverage_profile' => CoverageProfile::UNIVERSAL,
        'coverage_bucket' => CoverageBucket::UNMAPPED,
        'qualifying_event_spec' => [
            'resolved_concepts' => [
                'conditions_standard' => [],
                'drugs_standard' => [],
                'source_concept_ids' => [],
            ],
        ],
    ]);

    // Minimal pancreas.death + pancreas.observation_period so precondition 2
    // passes for the PANCREAS source. Single-row seed is enough for COUNT(*)>0.
    DB::connection('pgsql')->statement('CREATE SCHEMA IF NOT EXISTS pancreas');
    DB::connection('pgsql')->statement('
        CREATE TABLE IF NOT EXISTS pancreas.death (
            person_id BIGINT NOT NULL,
            death_date DATE NULL
        )
    ');
    DB::connection('pgsql')->statement('
        CREATE TABLE IF NOT EXISTS pancreas.observation_period (
            person_id BIGINT NOT NULL,
            observation_period_start_date DATE NULL,
            observation_period_end_date DATE NULL
        )
    ');
    DB::connection('pgsql')->statement('
        CREATE TABLE IF NOT EXISTS pancreas.drug_exposure (
            person_id BIGINT NOT NULL,
            drug_concept_id BIGINT NULL,
            drug_exposure_start_date DATE NULL
        )
    ');
    DB::connection('pgsql')->table('pancreas.death')->delete();
    DB::connection('pgsql')->table('pancreas.observation_period')->delete();
    DB::connection('pgsql')->table('pancreas.drug_exposure')->delete();
    DB::connection('pgsql')->table('pancreas.death')->insert([
        ['person_id' => 1, 'death_date' => '2023-05-01'],
    ]);
    DB::connection('pgsql')->table('pancreas.observation_period')->insert([
        ['person_id' => 1, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2024-01-01'],
    ]);
    DB::connection('pgsql')->table('pancreas.drug_exposure')->insert([
        ['person_id' => 1, 'drug_concept_id' => 1502905, 'drug_exposure_start_date' => '2023-02-01'],
    ]);

    // Clean any pre-existing FinnGenEndpointGeneration rows for this
    // (endpoint, source) pair so precondition 4 consistently returns null
    // and the dispatch uses the no-generation branch.
    FinnGenEndpointGeneration::query()
        ->where('endpoint_name', 'E4_DM2')
        ->where('source_key', 'PANCREAS')
        ->delete();

    // Fake FinnGenRunService — mirrors Phase 14/17 patterns. Captures the
    // dispatch parameters without inserting a real finngen.runs row.
    $this->createCalls = [];
    $createCallsRef = &$this->createCalls;
    $fake = new class($createCallsRef) extends FinnGenRunService
    {
        /** @param array<int, array<string, mixed>> $callsRef */
        public function __construct(private array &$callsRef)
        {
            // Skip parent ctor — create() never invokes the analysis-module registry.
        }

        /**
         * @param  array<string, mixed>  $params
         */
        public function create(int $userId, string $sourceKey, string $analysisType, array $params): Run
        {
            $this->callsRef[] = compact('userId', 'sourceKey', 'analysisType', 'params');
            $run = new Run;
            // VARCHAR(26) — fake id is 26 chars.
            $run->id = '01HEP'.str_pad((string) count($this->callsRef), 21, '0', STR_PAD_LEFT);
            $run->user_id = $userId;
            $run->source_key = $sourceKey;
            $run->analysis_type = $analysisType;
            $run->params = $params;
            $run->status = Run::STATUS_QUEUED;
            $run->exists = true;

            return $run;
        }
    };
    $this->app->instance(FinnGenRunService::class, $fake);
    $this->app->forgetInstance(EndpointProfileDispatchService::class);
});

afterEach(function (): void {
    DB::connection('pgsql')->statement('DROP TABLE IF EXISTS pancreas.death');
    DB::connection('pgsql')->statement('DROP TABLE IF EXISTS pancreas.observation_period');
    DB::connection('pgsql')->statement('DROP TABLE IF EXISTS pancreas.drug_exposure');
});

it('returns 202 + run envelope when researcher dispatches endpoint profile against eligible source', function (): void {
    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/profile', [
            'source_key' => 'PANCREAS',
        ]);

    $response->assertStatus(202)
        ->assertJsonStructure([
            'data' => ['run_id', 'endpoint_name', 'source_key', 'expression_hash'],
        ])
        ->assertJsonPath('data.endpoint_name', 'E4_DM2')
        ->assertJsonPath('data.source_key', 'PANCREAS');

    expect($this->createCalls)->toHaveCount(1);
    expect($this->createCalls[0]['analysisType'])->toBe(EndpointProfileDispatchService::ANALYSIS_TYPE);
    expect($this->createCalls[0]['sourceKey'])->toBe('PANCREAS');
    expect($this->createCalls[0]['params'])->toHaveKeys([
        'endpoint_name',
        'source_key',
        'expression_hash',
        'min_subjects',
        'cohort_definition_id',
        'condition_concept_ids',
    ]);

    // Schema should be lazy-provisioned on dispatch.
    $schemaExists = DB::selectOne(
        "SELECT 1 AS ok FROM information_schema.schemata WHERE schema_name = 'pancreas_co2_results'"
    );
    expect($schemaExists)->not->toBeNull();
});

it('returns 422 source_ineligible when source has no death AND no observation_period', function (): void {
    // Wipe both tables — dispatch precondition 2 MUST fail.
    DB::connection('pgsql')->table('pancreas.death')->delete();
    DB::connection('pgsql')->table('pancreas.observation_period')->delete();

    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/profile', [
            'source_key' => 'PANCREAS',
        ]);

    $response->assertStatus(422);
    expect($response->json('error_code'))->toBe('source_ineligible');
    expect($this->createCalls)->toHaveCount(0);
});

it('returns 422 endpoint_not_resolvable when endpoint has no concepts', function (): void {
    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/E4_UNMAPPED/profile', [
            'source_key' => 'PANCREAS',
        ]);

    $response->assertStatus(422);
    expect($response->json('error_code'))->toBe('endpoint_not_resolvable');
    expect($this->createCalls)->toHaveCount(0);
});

it('returns 403 when user lacks finngen.endpoint_profile.compute permission', function (): void {
    // viewer has .view but not .compute (per Plan 18-02 seeder split).
    $response = $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/profile', [
            'source_key' => 'PANCREAS',
        ]);

    $response->assertStatus(403);
    expect($this->createCalls)->toHaveCount(0);
});

it('succeeds when access-log table is unavailable (transaction poisoning mitigation)', function (): void {
    // POST (dispatch) path does NOT use the access-log middleware — only the
    // GET /profile read path does. But if the access-log table were dropped,
    // the dispatcher's own call to FinnGenRunService::create must still
    // succeed — it writes to finngen.runs, not finngen.endpoint_profile_access.
    // We simulate the worst case: drop the access-log table entirely. The
    // POST dispatch must still return 202.
    DB::connection('finngen')->statement('DROP TABLE IF EXISTS finngen.endpoint_profile_access');

    try {
        $response = $this->actingAs($this->researcher)
            ->postJson('/api/v1/finngen/endpoints/E4_DM2/profile', [
                'source_key' => 'PANCREAS',
            ]);

        $response->assertStatus(202);
        expect($this->createCalls)->toHaveCount(1);
    } finally {
        // Recreate the table so downstream tests still see it.
        DB::connection('finngen')->statement('
            CREATE TABLE IF NOT EXISTS finngen.endpoint_profile_access (
                endpoint_name     TEXT        NOT NULL,
                source_key        TEXT        NOT NULL,
                last_accessed_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                access_count      INTEGER     NOT NULL DEFAULT 0,
                created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (endpoint_name, source_key)
            )
        ');
    }
});
