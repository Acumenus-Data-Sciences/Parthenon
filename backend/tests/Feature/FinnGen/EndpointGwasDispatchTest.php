<?php

declare(strict_types=1);

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGen\EndpointGwasRun;
use App\Models\App\FinnGen\GwasCovariateSet;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\SourceVariantIndex;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\User;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\GwasCacheKeyHasher;
use App\Services\FinnGen\GwasRunService;
use Database\Seeders\FinnGenGwasCovariateSetSeeder;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

/**
 * Phase 15 Plan 08 — HTTP contract coverage for POST /finngen/endpoints/{name}/gwas.
 *
 * Posture mirrors Phase 14 GwasDispatchTest.php:
 *   - Fake FinnGenRunService so we never insert finngen.runs rows (cross-DB FK risk).
 *   - Seed FinnGen analysis modules + GwasCovariateSetSeeder for the default covariate set.
 *   - Seed a SourceVariantIndex row for PANCREAS so the source-prepared precondition passes.
 *   - Seed an endpoint_definitions row + endpoint_generations row + app.cohort_definitions
 *     row + {source}.cohort row so all 7 preconditions in GwasRunService::dispatchFullGwas pass.
 *   - NEVER send an Idempotency-Key header (Pitfall 3 — idempotency middleware short-circuits 409s).
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    (new FinnGenGwasCovariateSetSeeder)->run();

    $this->admin = User::where('email', 'finngen-test-admin@test.local')->firstOrFail();
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();

    // Cross-connection cleanup: RefreshDatabase rolls back pgsql but not finngen
    // (separate connection, separate implicit tx). Clear state up-front.
    EndpointGwasRun::query()->delete();
    FinnGenEndpointGeneration::query()->where('endpoint_name', 'E4_DM2')->delete();
    EndpointDefinition::query()->where('name', 'E4_DM2')->delete();
    SourceVariantIndex::query()->delete();

    // SourceVariantIndex row for PANCREAS — source_prepared precondition.
    SourceVariantIndex::updateOrCreate(
        ['source_key' => 'pancreas'],
        [
            'format' => 'pgen',
            'pgen_path' => '/opt/finngen-artifacts/variants/pancreas/all',
            'pc_tsv_path' => '/opt/finngen-artifacts/variants/pancreas/pcs.tsv',
            'variant_count' => 10000,
            'sample_count' => 360,
            'pc_count' => 20,
            'built_at' => now(),
        ],
    );

    // endpoint_definitions row (FULLY_MAPPED → passes unresolvable-concepts precondition).
    EndpointDefinition::factory()->create([
        'name' => 'E4_DM2',
        'longname' => 'Type 2 diabetes',
        'description' => 'Phase 15 Plan 08 dispatch fixture',
        'release' => 'df14',
        'coverage_profile' => CoverageProfile::UNIVERSAL,
        'coverage_bucket' => CoverageBucket::FULLY_MAPPED,
    ]);

    // endpoint_generations row (succeeded + subject_count > 0 → endpoint_materialized passes).
    // Test DB may still have a NOT NULL on cohort_definition_id (prod dropped this
    // in Phase 13.2 D-01; testing DB hasn't caught up). Pass a sentinel to satisfy.
    FinnGenEndpointGeneration::create([
        'endpoint_name' => 'E4_DM2',
        'finngen_endpoint_name' => 'E4_DM2',
        'source_key' => 'PANCREAS',
        'cohort_definition_id' => 1,
        'run_id' => null,
        'last_status' => 'succeeded',
        'last_subject_count' => 500,
    ]);

    // app.cohort_definitions control cohort — control_cohort_not_prepared passes.
    // Use a small numeric id (< FinnGen offset). Raw DB insert because there's no factory column match.
    $this->controlCohortId = 221;
    DB::connection('pgsql')->table('cohort_definitions')->updateOrInsert(
        ['id' => $this->controlCohortId],
        [
            'name' => 'PANCREAS Healthy controls',
            'author_id' => $this->admin->id,
            'domain' => 'cohort',
            'created_at' => now(),
            'updated_at' => now(),
        ],
    );

    // Fake per-source cohort table row proving the cohort was generated on PANCREAS.
    DB::connection('pgsql')->statement('CREATE SCHEMA IF NOT EXISTS pancreas');
    DB::connection('pgsql')->statement('
        CREATE TABLE IF NOT EXISTS pancreas.cohort (
            cohort_definition_id BIGINT NOT NULL,
            subject_id BIGINT NOT NULL,
            cohort_start_date DATE NULL,
            cohort_end_date DATE NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    ');
    DB::connection('pgsql')->table('pancreas.cohort')
        ->where('cohort_definition_id', $this->controlCohortId)
        ->delete();
    DB::connection('pgsql')->table('pancreas.cohort')->insert([
        'cohort_definition_id' => $this->controlCohortId,
        'subject_id' => 1,
        'cohort_start_date' => '2020-01-01',
        'cohort_end_date' => '2023-01-01',
    ]);

    $this->defaultCovariateSet = GwasCovariateSet::where('is_default', true)->firstOrFail();

    // Fake FinnGenRunService — mirrors Phase 14 GwasDispatchTest.
    $this->createCalls = [];
    $createCallsRef = &$this->createCalls;
    $this->fakeRunService = new class($createCallsRef) extends FinnGenRunService
    {
        /** @param array<int, array<string, mixed>> $callsRef */
        public function __construct(private array &$callsRef)
        {
            // Skip parent::__construct — we don't need the analysis-module registry here.
        }

        /**
         * @param  array<string, mixed>  $params
         */
        public function create(int $userId, string $sourceKey, string $analysisType, array $params): Run
        {
            $this->callsRef[] = compact('userId', 'sourceKey', 'analysisType', 'params');
            $run = new Run;
            // VARCHAR(26) — keep fake id exactly 26 chars. "01HFAKE" (7) + 19-char zero pad.
            $run->id = '01HFAKE'.str_pad((string) (count($this->callsRef)), 19, '0', STR_PAD_LEFT);
            $run->user_id = $userId;
            $run->source_key = $sourceKey;
            $run->analysis_type = $analysisType;
            $run->params = $params;
            $run->status = Run::STATUS_QUEUED;
            $run->exists = true;

            return $run;
        }
    };
    $this->app->instance(FinnGenRunService::class, $this->fakeRunService);
    $this->app->forgetInstance(GwasRunService::class);
});

afterEach(function () {
    SourceVariantIndex::query()->delete();
    EndpointGwasRun::query()->delete();
    DB::connection('pgsql')->statement('DROP TABLE IF EXISTS pancreas.cohort');
});

it('dispatches step1 and step2 on cache miss', function () {
    $this->withoutExceptionHandling();
    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
        ]);

    $response->assertStatus(202);
    $response->assertJsonPath('data.cached_step1', false);

    expect(EndpointGwasRun::query()->count())->toBe(1);
    $row = EndpointGwasRun::query()->latest('id')->first();
    expect($row->status)->toBe('queued');
    expect($row->run_id)->not->toStartWith('PENDING_');
    expect($row->step1_run_id)->not->toBeNull();

    // Both step1 and step2 create calls recorded.
    expect(count($this->createCalls))->toBe(2);
    expect($this->createCalls[0]['analysisType'])->toBe(GwasRunService::ANALYSIS_TYPE_STEP1);
    expect($this->createCalls[1]['analysisType'])->toBe(GwasRunService::ANALYSIS_TYPE_STEP2);
});

it('dispatches step2 only on cache hit', function () {
    // Pre-seed fit_pred.list so GwasRunService sees the cache hit and skips step1.
    $service = app(GwasRunService::class);
    $caseCohortId = (int) FinnGenEndpointGeneration::where('endpoint_name', 'E4_DM2')
        ->where('source_key', 'PANCREAS')
        ->value('id') + FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET;
    $cacheKey = GwasCacheKeyHasher::hash(
        $caseCohortId,
        (int) $this->defaultCovariateSet->id,
        (string) $this->defaultCovariateSet->covariate_columns_hash,
        'pancreas',
    );
    $cacheDir = $service->step1CacheDir('pancreas', $cacheKey);
    @mkdir($cacheDir, 0775, true);
    if (! is_dir($cacheDir) || ! is_writable($cacheDir)) {
        $this->markTestSkipped("artifacts volume not writable at {$cacheDir}");
    }
    file_put_contents($cacheDir.'/fit_pred.list', 'dummy');

    try {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
                'source_key' => 'PANCREAS',
                'control_cohort_id' => $this->controlCohortId,
            ]);

        $response->assertStatus(202);
        $response->assertJsonPath('data.cached_step1', true);

        $row = EndpointGwasRun::query()->latest('id')->first();
        expect($row->step1_run_id)->toBeNull();
        expect(count($this->createCalls))->toBe(1);
        expect($this->createCalls[0]['analysisType'])->toBe(GwasRunService::ANALYSIS_TYPE_STEP2);
    } finally {
        @unlink($cacheDir.'/fit_pred.list');
        @rmdir($cacheDir);
    }
});

it('returns 422 when endpoint has no resolvable concepts', function () {
    EndpointDefinition::where('name', 'E4_DM2')->update(['coverage_bucket' => CoverageBucket::UNMAPPED]);

    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
        ]);

    $response->assertStatus(422);
    $response->assertJsonPath('error_code', 'unresolvable_concepts');
});

it('returns 404 when source is unknown', function () {
    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'NONEXISTENT',
            'control_cohort_id' => $this->controlCohortId,
        ]);

    $response->assertStatus(404);
    $response->assertJsonPath('error_code', 'source_not_found');
});

it('returns 422 when source is not prepared', function () {
    SourceVariantIndex::query()->delete();

    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
        ]);

    $response->assertStatus(422);
    $response->assertJsonPath('error_code', 'source_not_prepared');
});

it('returns 422 when endpoint is not materialized', function () {
    FinnGenEndpointGeneration::where('endpoint_name', 'E4_DM2')->delete();

    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
        ]);

    $response->assertStatus(422);
    $response->assertJsonPath('error_code', 'endpoint_not_materialized');
});

it('returns 422 when control cohort is missing', function () {
    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => 999_999_999,  // exists nowhere, below FinnGen offset
        ]);

    $response->assertStatus(422);
    $response->assertJsonPath('error_code', 'control_cohort_not_prepared');
});

it('returns 422 on unknown covariate set id', function () {
    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
            'covariate_set_id' => 999_999,
        ]);

    $response->assertStatus(422);
    $response->assertJsonPath('error_code', 'covariate_set_not_found');
});

it('resolves default covariate set when omitted', function () {
    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
        ]);

    $response->assertStatus(202);
    $row = EndpointGwasRun::query()->latest('id')->first();
    expect((int) $row->covariate_set_id)->toBe((int) $this->defaultCovariateSet->id);
});

it('returns 409 on in-flight duplicate', function () {
    // Pre-seed a tracking row in queued/running status.
    EndpointGwasRun::create([
        'endpoint_name' => 'E4_DM2',
        'source_key' => 'PANCREAS',
        'control_cohort_id' => $this->controlCohortId,
        'covariate_set_id' => (int) $this->defaultCovariateSet->id,
        'run_id' => '01JEXIST'.str_repeat('0', 18),
        'step1_run_id' => null,
        'status' => EndpointGwasRun::STATUS_RUNNING,
    ]);

    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
        ]);

    $response->assertStatus(409);
    $response->assertJsonPath('error_code', 'run_in_flight');
});

it('returns 409 on succeeded duplicate without overwrite', function () {
    EndpointGwasRun::create([
        'endpoint_name' => 'E4_DM2',
        'source_key' => 'PANCREAS',
        'control_cohort_id' => $this->controlCohortId,
        'covariate_set_id' => (int) $this->defaultCovariateSet->id,
        'run_id' => '01JDONE0'.str_repeat('0', 18),
        'step1_run_id' => null,
        'status' => EndpointGwasRun::STATUS_SUCCEEDED,
        'finished_at' => now(),
    ]);

    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
        ]);

    $response->assertStatus(409);
    $response->assertJsonPath('error_code', 'duplicate_run');
});

it('supersedes prior row on overwrite', function () {
    $priorRunId = '01JOLDXX'.str_repeat('0', 18);

    // Prior tracking row in succeeded state.
    $prior = EndpointGwasRun::create([
        'endpoint_name' => 'E4_DM2',
        'source_key' => 'PANCREAS',
        'control_cohort_id' => $this->controlCohortId,
        'covariate_set_id' => (int) $this->defaultCovariateSet->id,
        'run_id' => $priorRunId,
        'step1_run_id' => null,
        'status' => EndpointGwasRun::STATUS_SUCCEEDED,
        'finished_at' => now(),
    ]);

    // Prior Run row owned by admin so the ownership check passes. Insert via raw
    // DB so we don't trip the EndpointGwasRun model's connection or FK churn.
    DB::connection('finngen')->table('runs')->insert([
        'id' => $priorRunId,
        'user_id' => $this->admin->id,
        'source_key' => 'PANCREAS',
        'analysis_type' => GwasRunService::ANALYSIS_TYPE_STEP2,
        'params' => json_encode(['cohort_definition_id' => 1]),
        'status' => Run::STATUS_SUCCEEDED,
        'finished_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
            'overwrite' => true,
        ]);

    $response->assertStatus(202);
    $prior->refresh();
    expect($prior->status)->toBe(EndpointGwasRun::STATUS_SUPERSEDED);

    $newRow = EndpointGwasRun::where('status', EndpointGwasRun::STATUS_QUEUED)->first();
    expect($newRow)->not->toBeNull();
    expect((int) $prior->superseded_by_tracking_id)->toBe((int) $newRow->id);
});

it('returns 404 on unknown endpoint', function () {
    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/NOT_AN_ENDPOINT/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
        ]);

    $response->assertStatus(404);
    $response->assertJsonPath('error_code', 'endpoint_not_found');
});

it('response shape matches spec', function () {
    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/gwas', [
            'source_key' => 'PANCREAS',
            'control_cohort_id' => $this->controlCohortId,
        ]);

    $response->assertStatus(202);
    $response->assertJsonStructure([
        'data' => [
            'gwas_run' => [
                'id',
                'endpoint_name',
                'source_key',
                'control_cohort_id',
                'covariate_set_id',
                'run_id',
                'step1_run_id',
                'status',
                'created_at',
            ],
            'cached_step1',
        ],
    ]);
    $response->assertJsonPath('data.gwas_run.endpoint_name', 'E4_DM2');
    $response->assertJsonPath('data.gwas_run.source_key', 'PANCREAS');
    $response->assertJsonPath('data.gwas_run.status', 'queued');
});
