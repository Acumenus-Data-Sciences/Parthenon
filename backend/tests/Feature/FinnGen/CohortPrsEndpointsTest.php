<?php

declare(strict_types=1);

use App\Models\App\CohortDefinition;
use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Phase 17 GENOMICS-08 — Plan 04 backend read API.
 *
 * Covers:
 *   - GET /api/v1/cohort-definitions/{id}/prs       (aggregated histogram)
 *   - GET /api/v1/cohort-definitions/{id}/prs/{scoreId}/download (CSV)
 *   - GET /api/v1/pgs-catalog/scores                (score picker)
 *
 * Test isolation pattern mirrors PrsDispatchTest (Phase 13.1 isolate_finngen_schema
 * collides with RefreshDatabase → manual seed + manual cleanup).
 *
 * Synthetic fixture: 100 rows of raw_score ~ N(0, 1) seeded into
 * pancreas_gwas_results.prs_subject_scores for (score_id=PGS000001,
 * cohort_definition_id=<sentinel>). Real data is NOT required; the
 * aggregation service operates on whatever rows match.
 */
const PRS_SENTINEL_SCORE_ID = 'PGS000001';
const PRS_SENTINEL_COHORT_ID = 777100;
const PRS_SENTINEL_SUBJECT_COUNT = 100;

uses()->beforeEach(function (): void {
    $this->seed(FinnGenTestingSeeder::class);

    // Plan 17-01's migration seeds `finngen.prs.compute` but RolePermissionSeeder
    // (called inside FinnGenTestingSeeder) re-syncs and drops it. Re-attach both
    // read-side permissions we actually gate this plan's routes on.
    foreach (['profiles.view'] as $permName) {
        Permission::findOrCreate($permName, 'web');
    }
    foreach (['viewer', 'researcher', 'data-steward', 'admin', 'super-admin'] as $roleName) {
        $role = Role::findByName($roleName, 'web');
        if (! $role->hasPermissionTo('profiles.view', 'web')) {
            $role->givePermissionTo('profiles.view');
        }
    }
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $this->viewer = User::where('email', 'finngen-test-viewer@test.local')->firstOrFail();

    // Defensive cleanup — prior test run may have left the sentinel id in place.
    DB::connection()->statement(
        'DELETE FROM pancreas_gwas_results.prs_subject_scores WHERE cohort_definition_id = ?',
        [PRS_SENTINEL_COHORT_ID]
    );
    DB::connection('pgsql_testing')->table('cohort_definitions')
        ->where('id', PRS_SENTINEL_COHORT_ID)->delete();

    // Create a real CohortDefinition so findOrFail works in the controller.
    $tmp = CohortDefinition::create([
        'name' => 'PRS test cohort',
        'description' => 'Phase 17 Plan 04 synthetic',
        'expression_json' => ['ConceptSets' => [], 'PrimaryCriteria' => []],
        'author_id' => $this->researcher->id,
        'is_public' => true,
    ]);
    // Override id to a sentinel that won't clash with other tests
    DB::connection('pgsql_testing')->table('cohort_definitions')
        ->where('id', $tmp->id)
        ->update(['id' => PRS_SENTINEL_COHORT_ID]);
    $this->cohort = CohortDefinition::findOrFail(PRS_SENTINEL_COHORT_ID);

    // Seed vocab.pgs_scores (Plan 01 table). ON CONFLICT avoids clobbering
    // rows written by LoadPgsCatalogCommandTest that share the same sentinel.
    DB::connection()->statement(
        'INSERT INTO vocab.pgs_scores
            (score_id, pgs_name, trait_reported, variants_number, genome_build, loaded_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())
         ON CONFLICT (score_id) DO NOTHING',
        [PRS_SENTINEL_SCORE_ID, 'PRS77_BC', 'Breast Cancer', 77, 'GRCh38']
    );

    // Clean any prior sentinel rows.
    DB::connection()->statement(
        'DELETE FROM pancreas_gwas_results.prs_subject_scores WHERE score_id = ? AND cohort_definition_id = ?',
        [PRS_SENTINEL_SCORE_ID, PRS_SENTINEL_COHORT_ID]
    );

    // Seed 100 rows of raw_score drawn deterministically from a rough Normal(0,1).
    // Deterministic: use a Box-Muller transform on a fixed seed for reproducibility.
    $rows = [];
    srand(42);
    for ($i = 0; $i < PRS_SENTINEL_SUBJECT_COUNT; $i++) {
        $u1 = (rand(1, 999999) / 1000000.0);
        $u2 = (rand(1, 999999) / 1000000.0);
        $z = sqrt(-2.0 * log($u1)) * cos(2.0 * M_PI * $u2);
        $rows[] = [
            'score_id' => PRS_SENTINEL_SCORE_ID,
            'cohort_definition_id' => PRS_SENTINEL_COHORT_ID,
            'subject_id' => 900000 + $i,
            'raw_score' => $z,
            'scored_at' => now()->toIso8601String(),
            'gwas_run_id' => '01HPRSENDPOINT'.str_pad((string) $i, 12, '0', STR_PAD_LEFT),
        ];
    }
    DB::connection()->table('pancreas_gwas_results.prs_subject_scores')->insert($rows);
});

afterEach(function (): void {
    DB::connection()->statement(
        'DELETE FROM pancreas_gwas_results.prs_subject_scores WHERE score_id = ? AND cohort_definition_id = ?',
        [PRS_SENTINEL_SCORE_ID, PRS_SENTINEL_COHORT_ID]
    );
    DB::connection('pgsql_testing')->table('cohort_definitions')
        ->where('id', PRS_SENTINEL_COHORT_ID)->delete();
});

// ─── GET /api/v1/cohort-definitions/{id}/prs ───────────────────────────────

it('returns aggregated PRS envelope with histogram, quintiles, summary', function (): void {
    $id = PRS_SENTINEL_COHORT_ID;
    $response = $this->actingAs($this->researcher)->getJson("/api/v1/cohort-definitions/{$id}/prs");

    $response->assertStatus(200)
        ->assertJsonStructure([
            'scores' => [
                '*' => [
                    'score_id',
                    'pgs_name',
                    'trait_reported',
                    'scored_at',
                    'subject_count',
                    'summary' => ['mean', 'stddev', 'min', 'max', 'median', 'iqr_q1', 'iqr_q3'],
                    'quintiles' => ['q20', 'q40', 'q60', 'q80'],
                    'histogram' => [
                        '*' => ['bin', 'bin_lo', 'bin_hi', 'n'],
                    ],
                ],
            ],
        ]);

    $scores = $response->json('scores');
    expect($scores)->toHaveCount(1);
    expect($scores[0]['score_id'])->toBe(PRS_SENTINEL_SCORE_ID);
    expect($scores[0]['subject_count'])->toBe(PRS_SENTINEL_SUBJECT_COUNT);
    expect($scores[0]['pgs_name'])->toBe('PRS77_BC');
    expect($scores[0]['trait_reported'])->toBe('Breast Cancer');
    expect($scores[0]['summary']['mean'])->toBeFloat();
    expect($scores[0]['summary']['median'])->toBeFloat();
    expect($scores[0]['quintiles']['q20'])->toBeFloat();
    expect($scores[0]['histogram'])->toBeArray();
    expect(count($scores[0]['histogram']))->toBeGreaterThan(0);
});

it('clamps ?bins=500 to 200 and ?bins=3 to 10', function (): void {
    $id = PRS_SENTINEL_COHORT_ID;

    // Upper clamp
    $hi = $this->actingAs($this->researcher)->getJson("/api/v1/cohort-definitions/{$id}/prs?bins=500");
    $hi->assertStatus(200);
    $binsHi = $hi->json('scores.0.histogram');
    // With 100 points across 200 bins, expect <= 200 non-empty bins back.
    expect(count($binsHi))->toBeLessThanOrEqual(200);

    // Lower clamp
    $lo = $this->actingAs($this->researcher)->getJson("/api/v1/cohort-definitions/{$id}/prs?bins=3");
    $lo->assertStatus(200);
    $binsLo = $lo->json('scores.0.histogram');
    // With 100 points across 10 bins, expect <= 10 non-empty bins back.
    expect(count($binsLo))->toBeLessThanOrEqual(10);
});

it('does NOT expose per-subject raw scores in the index response (T-17-S2)', function (): void {
    $id = PRS_SENTINEL_COHORT_ID;
    $response = $this->actingAs($this->researcher)->getJson("/api/v1/cohort-definitions/{$id}/prs");
    $response->assertStatus(200);

    $json = $response->json();
    $flat = json_encode($json);
    expect($flat)->not->toContain('subject_id');
    expect($flat)->not->toContain('raw_score');
    expect($flat)->not->toContain('"subjects"');
});

it('returns empty scores array when no prs_subject_scores rows exist for this cohort', function (): void {
    // Point to a cohort id that has no prs rows at all.
    $emptyCohort = CohortDefinition::create([
        'name' => 'empty-prs cohort',
        'description' => 'no prs rows',
        'expression_json' => [],
        'author_id' => $this->researcher->id,
        'is_public' => true,
    ]);

    $response = $this->actingAs($this->researcher)->getJson("/api/v1/cohort-definitions/{$emptyCohort->id}/prs");
    $response->assertStatus(200);
    expect($response->json('scores'))->toBe([]);

    $emptyCohort->forceDelete();
});

it('returns 401 for unauthenticated GET /prs', function (): void {
    $id = PRS_SENTINEL_COHORT_ID;
    $response = $this->getJson("/api/v1/cohort-definitions/{$id}/prs");
    $response->assertStatus(401);
});

// ─── GET /api/v1/pgs-catalog/scores ────────────────────────────────────────

it('returns sorted picker list from vocab.pgs_scores', function (): void {
    $response = $this->actingAs($this->researcher)->getJson('/api/v1/pgs-catalog/scores');
    $response->assertStatus(200)
        ->assertJsonStructure([
            'scores' => [
                '*' => ['score_id', 'pgs_name', 'trait_reported', 'variants_number'],
            ],
        ]);

    $scores = $response->json('scores');
    // Our sentinel must be in the list.
    $ids = array_column($scores, 'score_id');
    expect($ids)->toContain(PRS_SENTINEL_SCORE_ID);

    // Sort key assertion: (trait_reported ASC, score_id ASC). Walk the list.
    $pairs = array_map(fn ($r) => [$r['trait_reported'] ?? '', $r['score_id']], $scores);
    $sorted = $pairs;
    sort($sorted);
    expect($pairs)->toEqual($sorted);
});

it('returns 401 for unauthenticated GET /pgs-catalog/scores', function (): void {
    $response = $this->getJson('/api/v1/pgs-catalog/scores');
    $response->assertStatus(401);
});

// ─── GET /api/v1/cohort-definitions/{id}/prs/{scoreId}/download ─────────────

it('streams CSV download with header + row-per-subject', function (): void {
    $id = PRS_SENTINEL_COHORT_ID;
    $scoreId = PRS_SENTINEL_SCORE_ID;

    $response = $this->actingAs($this->researcher)
        ->get("/api/v1/cohort-definitions/{$id}/prs/{$scoreId}/download");
    $response->assertStatus(200);
    expect($response->headers->get('Content-Type'))->toStartWith('text/csv');
    expect($response->headers->get('Content-Disposition'))
        ->toContain("prs-{$scoreId}-cohort-{$id}.csv")
        ->toStartWith('attachment');

    $body = $response->streamedContent();
    $lines = array_values(array_filter(preg_split('/\r?\n/', $body) ?: []));

    // Header + N data rows.
    expect($lines[0])->toBe('score_id,subject_id,raw_score');
    expect(count($lines))->toBe(PRS_SENTINEL_SUBJECT_COUNT + 1);

    // Spot-check the first data row starts with the sentinel score_id.
    expect($lines[1])->toStartWith("{$scoreId},");
});

it('returns 404 when no PRS rows exist for (cohort, score)', function (): void {
    $id = PRS_SENTINEL_COHORT_ID;
    $response = $this->actingAs($this->researcher)
        ->get("/api/v1/cohort-definitions/{$id}/prs/PGS999999/download");
    $response->assertStatus(404);
});

it('returns 404 for missing cohort_definition_id', function (): void {
    $response = $this->actingAs($this->researcher)
        ->get('/api/v1/cohort-definitions/999888777/prs/PGS000001/download');
    $response->assertStatus(404);
});

it('returns 404 for invalid scoreId (route constraint)', function (): void {
    $id = PRS_SENTINEL_COHORT_ID;
    // Route ->where('scoreId', '^PGS\d{6,}$') rejects NOT_A_PGS → 404
    // (Laravel returns 404 when the URL pattern fails, not 422).
    $response = $this->actingAs($this->researcher)
        ->get("/api/v1/cohort-definitions/{$id}/prs/NOT_A_PGS/download");
    $response->assertStatus(404);
});

it('returns 401 for unauthenticated CSV download', function (): void {
    $id = PRS_SENTINEL_COHORT_ID;
    $response = $this->get("/api/v1/cohort-definitions/{$id}/prs/PGS000001/download");
    $response->assertStatus(401);
});
