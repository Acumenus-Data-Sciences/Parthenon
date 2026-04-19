<?php

declare(strict_types=1);

use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\SourceVariantIndex;
use App\Models\User;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\PrsDispatchService;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Phase 17 GENOMICS-07 — PrsDispatchService / EndpointBrowserController::prs.
 *
 * Follows the GwasDispatchTest precedent (Phase 14-04 SUMMARY §Test Isolation):
 *   - NO RefreshDatabase — collides with Phase 13.1 isolate_finngen_schema
 *     ALTER TABLE ... SET SCHEMA on replay.
 *   - Mock FinnGenRunService to avoid cross-DB user FK collisions.
 *   - Manually clean + seed the precondition rows (vocab.pgs_scores,
 *     app.finngen_source_variant_indexes, pancreas_results.cohort).
 *
 * Scenarios (maps to <behavior> in 17-03-PLAN.md):
 *   T1: 202 envelope shape when all preconditions pass.
 *   T2: 422 when score_id not in vocab.pgs_scores.
 *   T3: 422 when source has no variant_index.
 *   T4: 422 when cohort has 0 rows for the resolved id.
 *   T5: 403 when caller lacks finngen.prs.compute (viewer).
 *   T6: 422 (validation error) when score_id regex fails.
 */
uses()->beforeEach(function (): void {
    // Seed roles + permissions + analysis modules + PANCREAS source.
    $this->seed(FinnGenTestingSeeder::class);

    // RolePermissionSeeder::syncPermissions (called inside FinnGenTestingSeeder)
    // WIPES role→permission links and re-syncs from its hardcoded list, which
    // does not yet include `finngen.prs.compute` (Plan 17-01 added the perm via
    // a migration; seeder catch-up is deferred to a follow-on cleanup). Re-attach
    // the permission here so researcher-authored dispatches pass the middleware.
    Permission::findOrCreate('finngen.prs.compute', 'web');
    foreach (['researcher', 'data-steward', 'admin', 'super-admin'] as $roleName) {
        $role = Role::findByName($roleName, 'web');
        if (! $role->hasPermissionTo('finngen.prs.compute', 'web')) {
            $role->givePermissionTo('finngen.prs.compute');
        }
    }
    // Flush Spatie's permission cache so actingAs() sees the new grant.
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $this->viewer = User::where('email', 'finngen-test-viewer@test.local')->firstOrFail();

    // Seed PGS Catalog metadata row (Plan 01 migration created the table;
    // Plan 02 Artisan command normally fills it. Tests seed synthetically).
    DB::statement(
        'INSERT INTO vocab.pgs_scores
            (score_id, pgs_name, trait_reported, variants_number, genome_build, loaded_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())
         ON CONFLICT (score_id) DO NOTHING',
        ['PGS000001', 'PRS77_BC', 'Breast Cancer', 77, 'GRCh38']
    );

    // Phase 14 variant-index row — unblocks PrsDispatchService precondition #3.
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
        ]
    );

    // Seed a cohort row on PANCREAS for cohort_definition_id = 4242
    // so precondition #4 passes. Clean first to keep runs independent.
    $cohortId = 4242;
    DB::connection('pgsql')->statement(
        'DELETE FROM pancreas_results.cohort WHERE cohort_definition_id = ?',
        [$cohortId]
    );
    DB::connection('pgsql')->statement(
        'INSERT INTO pancreas_results.cohort
            (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
         VALUES (?, ?, ?, ?)',
        [$cohortId, 1001, '2020-01-01', '2024-01-01']
    );
    $this->cohortDefinitionId = $cohortId;

    // Mock FinnGenRunService — return a synthetic Run without hitting the DB.
    // Mirrors GwasDispatchTest pattern (the test scope is the dispatch
    // preconditions + envelope shape, not the Run insert lifecycle which has
    // its own test coverage).
    $this->createCalls = [];
    $createCallsRef = &$this->createCalls;
    $fake = new class($createCallsRef) extends FinnGenRunService
    {
        /** @param array<int, array<string, mixed>> $callsRef */
        public function __construct(private array &$callsRef)
        {
            // Skip parent ctor — we don't need the analysis-module registry
            // for the fake because create() never invokes the registry.
        }

        /**
         * @param  array<string, mixed>  $params
         */
        public function create(int $userId, string $sourceKey, string $analysisType, array $params): Run
        {
            $this->callsRef[] = compact('userId', 'sourceKey', 'analysisType', 'params');
            $run = new Run;
            $run->id = '01HPRS'.str_pad((string) count($this->callsRef), 20, '0', STR_PAD_LEFT);
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
    $this->app->forgetInstance(PrsDispatchService::class);
});

afterEach(function (): void {
    // Clean up the synthetic rows to keep runs independent.
    DB::connection('pgsql')->statement(
        'DELETE FROM pancreas_results.cohort WHERE cohort_definition_id = ?',
        [$this->cohortDefinitionId ?? 4242]
    );
    SourceVariantIndex::query()->where('source_key', 'pancreas')->delete();
    DB::statement("DELETE FROM vocab.pgs_scores WHERE score_id = 'PGS000001'");
});

it('dispatches PRS run and returns 202 with full envelope', function (): void {
    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/prs', [
            'source_key' => 'PANCREAS',
            'score_id' => 'PGS000001',
            'cohort_definition_id' => $this->cohortDefinitionId,
        ]);

    $response->assertStatus(202)
        ->assertJsonPath('data.analysis_type', PrsDispatchService::ANALYSIS_TYPE)
        ->assertJsonPath('data.score_id', 'PGS000001')
        ->assertJsonPath('data.source_key', 'PANCREAS')
        ->assertJsonPath('data.cohort_definition_id', $this->cohortDefinitionId)
        ->assertJsonPath('data.endpoint_name', 'E4_DM2');

    // Service layer recorded exactly one dispatch with the right analysis_type.
    expect($this->createCalls)->toHaveCount(1);
    expect($this->createCalls[0]['analysisType'])->toBe(PrsDispatchService::ANALYSIS_TYPE);
    expect($this->createCalls[0]['sourceKey'])->toBe('PANCREAS');
    expect($this->createCalls[0]['params'])->toMatchArray([
        'score_id' => 'PGS000001',
        'source_key' => 'PANCREAS',
        'cohort_definition_id' => $this->cohortDefinitionId,
        'finngen_endpoint_generation_id' => null,
        'overwrite_existing' => false,
    ]);
});

it('returns 422 when score_id is not ingested in vocab.pgs_scores', function (): void {
    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/prs', [
            'source_key' => 'PANCREAS',
            'score_id' => 'PGS999999',  // regex-valid, vocab-absent
            'cohort_definition_id' => $this->cohortDefinitionId,
        ]);

    $response->assertStatus(422);
    expect($response->json('message'))->toContain('PGS999999')
        ->and($response->json('message'))->toContain('vocab.pgs_scores');
    expect($this->createCalls)->toHaveCount(0);
});

it('returns 422 when source has no variant_index', function (): void {
    SourceVariantIndex::query()->where('source_key', 'pancreas')->delete();

    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/prs', [
            'source_key' => 'PANCREAS',
            'score_id' => 'PGS000001',
            'cohort_definition_id' => $this->cohortDefinitionId,
        ]);

    $response->assertStatus(422);
    expect($response->json('message'))->toContain('variant_index');
    expect($this->createCalls)->toHaveCount(0);
});

it('returns 422 when cohort has 0 rows for the resolved cohort_definition_id', function (): void {
    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/prs', [
            'source_key' => 'PANCREAS',
            'score_id' => 'PGS000001',
            'cohort_definition_id' => 987654321,  // no rows seeded for this id
        ]);

    $response->assertStatus(422);
    expect($response->json('message'))->toContain('0 rows');
    expect($response->json('message'))->toContain('987654321');
    expect($this->createCalls)->toHaveCount(0);
});

it('returns 403 when caller lacks finngen.prs.compute (viewer)', function (): void {
    $response = $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/prs', [
            'source_key' => 'PANCREAS',
            'score_id' => 'PGS000001',
            'cohort_definition_id' => $this->cohortDefinitionId,
        ]);

    // Route middleware permission:finngen.prs.compute intercepts FIRST with 403.
    // If the middleware somehow let it through, FormRequest::authorize also
    // returns false and Laravel replies 403 — either way, the test passes.
    $response->assertStatus(403);
    expect($this->createCalls)->toHaveCount(0);
});

it('returns 422 when score_id does not match PGS regex (FormRequest rule)', function (): void {
    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/E4_DM2/prs', [
            'source_key' => 'PANCREAS',
            'score_id' => 'NOT_A_PGS_ID',
            'cohort_definition_id' => $this->cohortDefinitionId,
        ]);

    $response->assertStatus(422);
    expect($this->createCalls)->toHaveCount(0);
});
