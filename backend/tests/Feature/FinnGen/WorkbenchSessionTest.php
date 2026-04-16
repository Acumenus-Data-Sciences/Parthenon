<?php

declare(strict_types=1);

use App\Models\App\FinnGen\WorkbenchSession;
use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
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
