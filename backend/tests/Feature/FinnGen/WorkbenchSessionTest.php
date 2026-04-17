<?php

declare(strict_types=1);

use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Models\App\CohortDefinition;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\WorkbenchSession;
use App\Models\App\WebApiRegistry;
use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->viewer = User::where('email', 'finngen-test-viewer@test.local')->firstOrFail();
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
});

it('POST /workbench/sessions requires authentication', function () {
    $this->postJson('/api/v1/finngen/workbench/sessions', [])->assertStatus(401);
});

it('POST /workbench/sessions denies viewer (no finngen.workbench.use)', function () {
    $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/workbench/sessions', [
            'source_key' => 'PANCREAS',
            'name' => 'denied',
        ])->assertStatus(403);
});

it('researcher can create a workbench session', function () {
    $resp = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/sessions', [
            'source_key' => 'PANCREAS',
            'name' => 'My session',
            'description' => 'Initial draft',
            'session_state' => ['step' => 1, 'selected' => [221]],
        ])
        ->assertStatus(201);

    $resp->assertJsonPath('data.user_id', $this->researcher->id);
    $resp->assertJsonPath('data.source_key', 'PANCREAS');
    $resp->assertJsonPath('data.session_state.step', 1);
    expect($resp->json('data.id'))->toBeString()->toHaveLength(26);
});

it('researcher cannot read another researcherʼs session (404, not 403)', function () {
    $other = User::factory()->create()->assignRole('researcher');
    $session = WorkbenchSession::create([
        'user_id' => $other->id,
        'source_key' => 'PANCREAS',
        'name' => 'private',
        'session_state' => [],
        'last_active_at' => now(),
    ]);

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/workbench/sessions/{$session->id}")
        ->assertStatus(404);
});

it('researcher cannot update another researcherʼs session', function () {
    $other = User::factory()->create()->assignRole('researcher');
    $session = WorkbenchSession::create([
        'user_id' => $other->id,
        'source_key' => 'PANCREAS',
        'name' => 'private',
        'session_state' => [],
        'last_active_at' => now(),
    ]);

    $this->actingAs($this->researcher)
        ->patchJson("/api/v1/finngen/workbench/sessions/{$session->id}", [
            'session_state' => ['hijacked' => true],
        ])
        ->assertStatus(404);

    expect(WorkbenchSession::find($session->id)->session_state)->toBe([]);
});

it('PATCH session_state writes back and bumps last_active_at', function () {
    $session = WorkbenchSession::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'PANCREAS',
        'name' => 'mine',
        'session_state' => ['step' => 1],
        'last_active_at' => now()->subHour(),
    ]);
    $oldActive = $session->last_active_at;

    $this->actingAs($this->researcher)
        ->patchJson("/api/v1/finngen/workbench/sessions/{$session->id}", [
            'session_state' => ['step' => 2, 'tree' => [['op' => 'UNION']]],
        ])
        ->assertStatus(200)
        ->assertJsonPath('data.session_state.step', 2);

    $session->refresh();
    expect($session->last_active_at->gt($oldActive))->toBeTrue();
});

it('GET /workbench/sessions only lists the callerʼs sessions', function () {
    $other = User::factory()->create()->assignRole('researcher');
    WorkbenchSession::create([
        'user_id' => $other->id,
        'source_key' => 'PANCREAS',
        'name' => 'theirs',
        'session_state' => [],
        'last_active_at' => now(),
    ]);
    WorkbenchSession::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'PANCREAS',
        'name' => 'mine',
        'session_state' => [],
        'last_active_at' => now(),
    ]);

    $resp = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/workbench/sessions')
        ->assertStatus(200);

    expect($resp->json('data'))->toHaveCount(1);
    expect($resp->json('data.0.name'))->toBe('mine');
});

it('GET /workbench/sessions filters by source_key', function () {
    WorkbenchSession::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'PANCREAS',
        'name' => 'p',
        'session_state' => [],
        'last_active_at' => now(),
    ]);
    WorkbenchSession::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'EUNOMIA',
        'name' => 'e',
        'session_state' => [],
        'last_active_at' => now(),
    ]);

    $resp = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/workbench/sessions?source_key=PANCREAS')
        ->assertStatus(200);

    expect($resp->json('data'))->toHaveCount(1);
    expect($resp->json('data.0.source_key'))->toBe('PANCREAS');
});

it('DELETE removes the session', function () {
    $session = WorkbenchSession::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'PANCREAS',
        'name' => 'mine',
        'session_state' => [],
        'last_active_at' => now(),
    ]);

    $this->actingAs($this->researcher)
        ->deleteJson("/api/v1/finngen/workbench/sessions/{$session->id}")
        ->assertStatus(204);

    expect(WorkbenchSession::find($session->id))->toBeNull();
});

// ── SP4 Phase B.3 — preview-counts ──────────────────────────────────────────

it('POST /preview-counts denies viewer', function () {
    Http::fake();
    $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/workbench/preview-counts', [
            'source_key' => 'EUNOMIA',
            'tree' => ['kind' => 'cohort', 'id' => 'a', 'cohort_id' => 1],
        ])->assertStatus(403);
});

it('POST /preview-counts unwraps the Darkstar {ok, result} envelope', function () {
    // Regression — production darkstar wraps sync responses in
    // {ok, result} via .safe_sync/run_with_classification. Controller
    // must read result.result.total, not result.total.
    Http::fake([
        '*/finngen/cohort/preview-count' => Http::response(
            ['ok' => true, 'result' => ['total' => 361]],
            200,
        ),
    ]);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/preview-counts', [
            'source_key' => 'EUNOMIA',
            'tree' => ['kind' => 'cohort', 'id' => 'c1', 'cohort_id' => 221],
        ])
        ->assertStatus(200)
        ->assertJsonPath('data.total', 361);
});

it('POST /preview-counts returns total + operation string for a valid tree', function () {
    Http::fake([
        '*/finngen/cohort/preview-count' => Http::response(['total' => 1234], 200),
    ]);

    $tree = [
        'kind' => 'op',
        'id' => 'root',
        'op' => 'MINUS',
        'children' => [
            [
                'kind' => 'op',
                'id' => 'left',
                'op' => 'UNION',
                'children' => [
                    ['kind' => 'cohort', 'id' => 'a', 'cohort_id' => 221],
                    ['kind' => 'cohort', 'id' => 'b', 'cohort_id' => 222],
                ],
            ],
            ['kind' => 'cohort', 'id' => 'c', 'cohort_id' => 223],
        ],
    ];

    $resp = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/preview-counts', [
            'source_key' => 'EUNOMIA',
            'tree' => $tree,
        ])
        ->assertStatus(200);

    $resp->assertJsonPath('data.total', 1234);
    $resp->assertJsonPath('data.operation_string', '(221 UNION 222) MINUS 223');
    $resp->assertJsonPath('data.cohort_ids', [221, 222, 223]);

    Http::assertSent(function ($request) {
        $body = $request->data();

        return str_contains((string) $request->url(), '/finngen/cohort/preview-count')
            && isset($body['source'])
            && isset($body['sql'])
            && str_contains($body['sql'], 'EXCEPT')
            && str_contains($body['sql'], 'cohort_definition_id = 223');
    });
});

it('POST /preview-counts returns 422 on invalid tree (op with one child)', function () {
    Http::fake();
    $tree = [
        'kind' => 'op',
        'id' => 'root',
        'op' => 'UNION',
        'children' => [
            ['kind' => 'cohort', 'id' => 'a', 'cohort_id' => 1],
        ],
    ];
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/preview-counts', [
            'source_key' => 'EUNOMIA',
            'tree' => $tree,
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.0.code', 'OP_NEEDS_AT_LEAST_TWO_CHILDREN');
});

it('POST /preview-counts maps Darkstar timeout to 504', function () {
    Http::fake([
        '*/finngen/cohort/preview-count' => fn () => throw new ConnectionException('timed out'),
    ]);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/preview-counts', [
            'source_key' => 'EUNOMIA',
            'tree' => [
                'kind' => 'op', 'id' => 'r', 'op' => 'UNION',
                'children' => [
                    ['kind' => 'cohort', 'id' => 'a', 'cohort_id' => 1],
                    ['kind' => 'cohort', 'id' => 'b', 'cohort_id' => 2],
                ],
            ],
        ])
        ->assertStatus(504); // ConnectionException with "timed out" → Timeout → 504
});

it('POST /preview-counts maps generic Darkstar connection error to 502', function () {
    Http::fake([
        '*/finngen/cohort/preview-count' => fn () => throw new ConnectionException('refused'),
    ]);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/preview-counts', [
            'source_key' => 'EUNOMIA',
            'tree' => [
                'kind' => 'op', 'id' => 'r', 'op' => 'UNION',
                'children' => [
                    ['kind' => 'cohort', 'id' => 'a', 'cohort_id' => 1],
                    ['kind' => 'cohort', 'id' => 'b', 'cohort_id' => 2],
                ],
            ],
        ])
        ->assertStatus(502); // No "timeout" → Unreachable → 502
});

// ── SP4 Phase D — match wrapper ─────────────────────────────────────────────

it('POST /workbench/match denies viewer', function () {
    Bus::fake();
    $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/workbench/match', [
            'source_key' => 'EUNOMIA',
            'primary_cohort_id' => 1,
            'comparator_cohort_ids' => [2],
        ])->assertStatus(403);
});

it('POST /workbench/match creates a cohort.match run + dispatches the analysis job', function () {
    Bus::fake();

    $resp = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/match', [
            'source_key' => 'EUNOMIA',
            'primary_cohort_id' => 221,
            'comparator_cohort_ids' => [222, 223],
            'ratio' => 2,
            'match_sex' => true,
            'match_birth_year' => true,
            'max_year_difference' => 1,
        ])
        ->assertStatus(202);

    $resp->assertJsonPath('data.analysis_type', 'cohort.match');
    $resp->assertJsonPath('data.params.primary_cohort_id', 221);
    $resp->assertJsonPath('data.params.comparator_cohort_ids', [222, 223]);
    $resp->assertJsonPath('data.params.ratio', 2);
    $resp->assertJsonPath('data.user_id', $this->researcher->id);

    // Regression — see fix for double-dispatch bug surfaced by SP4 live smoke
    // (260416-owf). FinnGenRunService::create() already dispatches the job;
    // the controller MUST NOT redispatch, otherwise materialize-style writes
    // race themselves and inflate row counts 2×.
    Bus::assertDispatched(RunFinnGenAnalysisJob::class, 1);
});

it('POST /workbench/match validates required fields', function () {
    Bus::fake();
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/match', [
            'source_key' => 'EUNOMIA',
            // missing primary_cohort_id and comparator_cohort_ids
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['primary_cohort_id', 'comparator_cohort_ids']);
});

it('POST /workbench/match rejects > 10 comparators', function () {
    Bus::fake();
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/match', [
            'source_key' => 'EUNOMIA',
            'primary_cohort_id' => 1,
            'comparator_cohort_ids' => range(2, 12),
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['comparator_cohort_ids']);
});

// ── SP4 Polish 2 — materialize wrapper ──────────────────────────────────────

it('POST /workbench/materialize denies viewer', function () {
    Bus::fake();
    $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/workbench/materialize', [
            'source_key' => 'EUNOMIA',
            'name' => 'denied',
            'tree' => ['kind' => 'cohort', 'id' => 'a', 'cohort_id' => 1],
        ])->assertStatus(403);
});

it('POST /workbench/materialize creates cohort_definition + dispatches run', function () {
    Bus::fake();

    $tree = [
        'kind' => 'op',
        'id' => 'root',
        'op' => 'UNION',
        'children' => [
            ['kind' => 'cohort', 'id' => 'a', 'cohort_id' => 221],
            ['kind' => 'cohort', 'id' => 'b', 'cohort_id' => 222],
        ],
    ];

    $resp = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/materialize', [
            'source_key' => 'EUNOMIA',
            'name' => 'Workbench union of 221 + 222',
            'description' => 'Smoke test',
            'tree' => $tree,
        ])
        ->assertStatus(202);

    $resp->assertJsonPath('data.run.analysis_type', 'cohort.materialize');
    $resp->assertJsonPath('data.run.params.referenced_cohort_ids', [221, 222]);
    expect($resp->json('data.cohort_definition_id'))->toBeInt()->toBeGreaterThan(0);
    expect($resp->json('data.run.params.subject_sql'))
        ->toContain('SELECT subject_id FROM')
        ->toContain('cohort_definition_id = 221')
        ->toContain('cohort_definition_id = 222');

    // Regression — exactly one dispatch (see match test above).
    Bus::assertDispatched(RunFinnGenAnalysisJob::class, 1);

    // The cohort_definition row exists with the researcher as author and the
    // workbench tree stored under expression_json.workbench_tree.
    $cohortId = (int) $resp->json('data.cohort_definition_id');
    $def = CohortDefinition::find($cohortId);
    expect($def)->not->toBeNull();
    expect($def->author_id)->toBe($this->researcher->id);
    expect($def->expression_json['source_key'] ?? null)->toBe('EUNOMIA');
    expect($def->expression_json['referenced_cohort_ids'] ?? [])->toBe([221, 222]);
});

it('POST /workbench/materialize returns 422 on invalid tree', function () {
    Bus::fake();
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/materialize', [
            'source_key' => 'EUNOMIA',
            'name' => 'bad',
            'tree' => [
                'kind' => 'op', 'id' => 'r', 'op' => 'UNION',
                'children' => [['kind' => 'cohort', 'id' => 'a', 'cohort_id' => 1]],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.0.code', 'OP_NEEDS_AT_LEAST_TWO_CHILDREN');
});

it('POST /workbench/materialize requires name', function () {
    Bus::fake();
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/materialize', [
            'source_key' => 'EUNOMIA',
            'tree' => [
                'kind' => 'op', 'id' => 'r', 'op' => 'UNION',
                'children' => [
                    ['kind' => 'cohort', 'id' => 'a', 'cohort_id' => 1],
                    ['kind' => 'cohort', 'id' => 'b', 'cohort_id' => 2],
                ],
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});

// ── SP4 Phase E — Atlas import ──────────────────────────────────────────────

it('GET /workbench/atlas/cohorts denies viewer', function () {
    Http::fake();
    $this->actingAs($this->viewer)
        ->getJson('/api/v1/finngen/workbench/atlas/cohorts')
        ->assertStatus(403);
});

it('GET /workbench/atlas/cohorts returns 503 when no active registry', function () {
    Http::fake();
    WebApiRegistry::query()->update(['is_active' => false]);
    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/workbench/atlas/cohorts')
        ->assertStatus(503)
        ->assertJsonPath('message', fn ($msg) => is_string($msg) && str_contains($msg, 'No active WebAPI registry'));
});

it('GET /workbench/atlas/cohorts lists cohorts from active registry', function () {
    $registry = WebApiRegistry::create([
        'name' => 'Atlas Test',
        'base_url' => 'https://atlas.test.example.com/WebAPI',
        'auth_type' => 'none',
        'is_active' => true,
        'created_by' => $this->researcher->id,
    ]);

    Http::fake([
        '*/source/sources' => Http::response([], 200),
        '*/conceptset/' => Http::response([], 200),
        '*/cohortdefinition' => Http::response([
            ['id' => 101, 'name' => 'Atlas HF cohort', 'description' => 'Heart failure'],
            ['id' => 102, 'name' => 'Atlas T2D cohort', 'description' => null],
        ], 200),
        '*' => Http::response([], 200),
    ]);

    $resp = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/workbench/atlas/cohorts')
        ->assertStatus(200);

    $resp->assertJsonPath('data.registry.id', $registry->id);
    $resp->assertJsonPath('data.registry.name', 'Atlas Test');
    $resp->assertJsonPath('data.cohort_count', 2);
});

it('POST /workbench/atlas/import denies viewer', function () {
    Http::fake();
    $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/workbench/atlas/import', ['atlas_ids' => [1]])
        ->assertStatus(403);
});

it('POST /workbench/atlas/import validates atlas_ids', function () {
    Http::fake();
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/atlas/import', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['atlas_ids']);
});

it('POST /workbench/atlas/import rejects > 50 ids', function () {
    Http::fake();
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/atlas/import', [
            'atlas_ids' => range(1, 51),
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['atlas_ids']);
});

it('POST /workbench/atlas/import returns 503 when no active registry', function () {
    Http::fake();
    WebApiRegistry::query()->update(['is_active' => false]);
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/atlas/import', [
            'atlas_ids' => [101, 102],
        ])
        ->assertStatus(503);
});

// ── SP4 Phase D.3 — promote-match ───────────────────────────────────────────

it('POST /workbench/promote-match denies viewer', function () {
    $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/workbench/promote-match', [
            'run_id' => str_repeat('0', 26),
        ])->assertStatus(403);
});

it('POST /workbench/promote-match validates run_id format', function () {
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/promote-match', [
            'run_id' => 'too-short',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['run_id']);
});

it('POST /workbench/promote-match returns 404 for non-existent run', function () {
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/promote-match', [
            'run_id' => '01HXXXXXXXXXXXXXXXXXXXXXXX',
        ])
        ->assertStatus(404);
});

it('POST /workbench/promote-match rejects runs of the wrong analysis_type', function () {
    $run = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'cohort.materialize', // wrong type
        'status' => Run::STATUS_SUCCEEDED,
        'params' => ['primary_cohort_id' => 221],
        'finished_at' => now(),
    ]);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/promote-match', [
            'run_id' => $run->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Run is not a cohort.match run');
});

it('POST /workbench/promote-match rejects non-succeeded runs', function () {
    $run = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'cohort.match',
        'status' => Run::STATUS_RUNNING,
        'params' => ['primary_cohort_id' => 221, 'comparator_cohort_ids' => [222]],
    ]);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/promote-match', [
            'run_id' => $run->id,
        ])
        ->assertStatus(422);
});

// Helper: ensure the PANCREAS cohort schema + cohort table exist in the test
// DB. We prefer PANCREAS over EUNOMIA — PANCREAS has the genomics + oncology
// depth that mirrors real FinnGen researcher flows, and project memory calls
// it out as the default source for the workbench.
//
// Uses raw SQL (`DB::statement` / `DB::insert`) throughout. The query
// builder's `DB::table('schema.table')` path double-quotes the whole string
// as a single identifier rather than splitting on the dot, which silently
// targets the wrong table.
function ensurePancreasCohortTable(): void
{
    DB::statement('CREATE SCHEMA IF NOT EXISTS pancreas_results');
    DB::statement(
        'CREATE TABLE IF NOT EXISTS pancreas_results.cohort (
            cohort_definition_id INTEGER NOT NULL,
            subject_id BIGINT NOT NULL,
            cohort_start_date DATE NOT NULL,
            cohort_end_date DATE NOT NULL
        )'
    );
    DB::statement('DELETE FROM pancreas_results.cohort');
}

function seedPhantomCohortRows(int $phantomId, int $count): void
{
    for ($i = 0; $i < $count; $i++) {
        DB::insert(
            'INSERT INTO pancreas_results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date) VALUES (?, ?, ?, ?)',
            [$phantomId, 100 + $i, '2020-01-01', '2020-12-31'],
        );
    }
}

it('POST /workbench/promote-match happy path promotes and migrates phantom rows', function () {
    ensurePancreasCohortTable();

    $run = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'PANCREAS',
        'analysis_type' => 'cohort.match',
        'status' => Run::STATUS_SUCCEEDED,
        'params' => [
            'primary_cohort_id' => 221,
            'comparator_cohort_ids' => [222, 223],
            'ratio' => 2,
            'match_sex' => true,
            'match_birth_year' => true,
            'max_year_difference' => 1,
        ],
        'finished_at' => now(),
    ]);

    $phantomId = 9_000_000 + 221;
    seedPhantomCohortRows($phantomId, 3);

    $resp = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/promote-match', [
            'run_id' => $run->id,
            'name' => 'Matched PDAC controls',
        ])
        ->assertStatus(201);

    $resp->assertJsonPath('data.already_promoted', false);
    $resp->assertJsonPath('data.rows_migrated', 3);
    $resp->assertJsonPath('data.name', 'Matched PDAC controls');
    $resp->assertJsonPath('data.provenance.primary_cohort_id', 221);
    $resp->assertJsonPath('data.provenance.comparator_cohort_ids', [222, 223]);
    $resp->assertJsonPath('data.provenance.ratio', 2);

    $newCohortDefId = (int) $resp->json('data.cohort_definition_id');
    expect($newCohortDefId)->toBeGreaterThan(0);

    // Phantom id should now be empty; new id should have the 3 subjects.
    $phantomRemaining = (int) DB::selectOne(
        'SELECT COUNT(*) AS n FROM pancreas_results.cohort WHERE cohort_definition_id = ?',
        [$phantomId],
    )->n;
    expect($phantomRemaining)->toBe(0);

    $migrated = (int) DB::selectOne(
        'SELECT COUNT(*) AS n FROM pancreas_results.cohort WHERE cohort_definition_id = ?',
        [$newCohortDefId],
    )->n;
    expect($migrated)->toBe(3);

    // cohort_definition row carries provenance under expression_json.
    $def = CohortDefinition::where('id', $newCohortDefId)->firstOrFail();
    expect($def->author_id)->toBe($this->researcher->id)
        ->and($def->expression_json['finngen_match_promotion']['run_id'])->toBe($run->id);
});

it('POST /workbench/promote-match is idempotent — second call returns the prior promotion', function () {
    ensurePancreasCohortTable();

    $run = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'PANCREAS',
        'analysis_type' => 'cohort.match',
        'status' => Run::STATUS_SUCCEEDED,
        'params' => [
            'primary_cohort_id' => 300,
            'comparator_cohort_ids' => [301],
            'ratio' => 1,
        ],
        'finished_at' => now(),
    ]);

    seedPhantomCohortRows(9_000_000 + 300, 1);

    $first = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/promote-match', ['run_id' => $run->id])
        ->assertStatus(201);

    $firstId = (int) $first->json('data.cohort_definition_id');
    expect($firstId)->toBeGreaterThan(0);

    // Second call — the run is already promoted; endpoint returns the prior
    // record with already_promoted=true, rows_migrated=0.
    $second = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/promote-match', ['run_id' => $run->id])
        ->assertStatus(200);

    $second->assertJsonPath('data.already_promoted', true);
    $second->assertJsonPath('data.cohort_definition_id', $firstId);
    $second->assertJsonPath('data.rows_migrated', 0);

    // Only one cohort_definition row exists for this run.
    $count = CohortDefinition::whereRaw(
        "expression_json::jsonb->'finngen_match_promotion'->>'run_id' = ?",
        [$run->id],
    )->count();
    expect($count)->toBe(1);
});

it('POST /workbench/promote-match returns 422 when phantom rows are missing', function () {
    ensurePancreasCohortTable();

    $run = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'PANCREAS',
        'analysis_type' => 'cohort.match',
        'status' => Run::STATUS_SUCCEEDED,
        'params' => ['primary_cohort_id' => 999, 'comparator_cohort_ids' => [998]],
        'finished_at' => now(),
    ]);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/promote-match', ['run_id' => $run->id])
        ->assertStatus(422)
        ->assertJsonFragment([
            'message' => 'Matched cohort rows not found in pancreas_results.cohort for phantom id 9000999',
        ]);
});

it('POST /workbench/promote-match refuses to promote another userʼs run', function () {
    $other = User::factory()->create()->assignRole('researcher');
    $run = Run::create([
        'user_id' => $other->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'cohort.match',
        'status' => Run::STATUS_SUCCEEDED,
        'params' => ['primary_cohort_id' => 221, 'comparator_cohort_ids' => [222]],
        'finished_at' => now(),
    ]);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/workbench/promote-match', [
            'run_id' => $run->id,
        ])
        ->assertStatus(404);
});
