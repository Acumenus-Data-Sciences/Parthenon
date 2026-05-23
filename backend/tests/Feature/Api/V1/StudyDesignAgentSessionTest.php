<?php

use App\Models\App\Study;
use App\Models\App\StudyDesignAgentSession;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);

    $this->user = User::factory()->create();
    $this->user->assignRole('researcher');

    $this->study = Study::factory()->create([
        'created_by' => $this->user->id,
    ]);

    $this->session = $this->study->designSessions()->create([
        'created_by' => $this->user->id,
        'title' => 'Agent test session',
    ]);

    $this->version = $this->session->versions()->create([
        'version_number' => 1,
        'status' => 'draft',
    ]);
});

// ---------------------------------------------------------------------------
// start — 201, DB row, correct channel name
// ---------------------------------------------------------------------------

it('start creates an agent session and returns 201 with channel name', function () {
    Http::fake([
        '*/study-designer/sessions' => Http::response(['ok' => true], 200),
    ]);

    Sanctum::actingAs($this->user, ['*']);

    $response = $this->postJson(
        "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions",
    );

    $response->assertStatus(201)
        ->assertJsonPath('data.channel_name', "private-study-design.session.{$this->session->id}");

    $agentSessionId = $response->json('data.agent_session_id');
    expect($agentSessionId)->toBeInt();

    $this->assertDatabaseHas('study_design_agent_sessions', [
        'id' => $agentSessionId,
        'study_design_session_id' => $this->session->id,
        'user_id' => $this->user->id,
        'status' => 'active',
    ]);
});

// ---------------------------------------------------------------------------
// start — minted token has correct name and abilities
// ---------------------------------------------------------------------------

it('start mints a scoped token with study-designer-agent name and correct abilities', function () {
    Http::fake([
        '*/study-designer/sessions' => Http::response(['ok' => true], 200),
    ]);

    Sanctum::actingAs($this->user, ['*']);

    $response = $this->postJson(
        "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions",
    );

    $response->assertStatus(201);

    $agentSessionId = $response->json('data.agent_session_id');
    $agentSession = StudyDesignAgentSession::findOrFail($agentSessionId);

    // token_id must be recorded on the agent session row
    expect($agentSession->token_id)->not->toBeNull();

    $token = $this->user->tokens()->where('id', $agentSession->token_id)->firstOrFail();

    expect($token->name)->toBe('study-designer-agent');
    expect($token->abilities)->toBe(['studies.view', 'studies.create']);
});

// ---------------------------------------------------------------------------
// start — viewer (no studies.create) gets 403
// ---------------------------------------------------------------------------

it('start returns 403 for a user without studies.create permission', function () {
    $viewer = User::factory()->create();
    $viewer->assignRole('viewer');

    Sanctum::actingAs($viewer, ['*']);

    $response = $this->postJson(
        "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions",
    );

    $response->assertStatus(403);
});

// ---------------------------------------------------------------------------
// message — 202 and python-ai turn endpoint is called
// ---------------------------------------------------------------------------

it('message forwards to python-ai turn endpoint and returns 202', function () {
    Http::fake([
        '*/study-designer/sessions' => Http::response(['ok' => true], 200),
        '*/study-designer/sessions/*/turn' => Http::response(['ok' => true], 200),
    ]);

    Sanctum::actingAs($this->user, ['*']);

    // First create an agent session via start
    $startResponse = $this->postJson(
        "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions",
    );
    $startResponse->assertStatus(201);
    $agentSessionId = $startResponse->json('data.agent_session_id');

    // Now send a message
    $response = $this->postJson(
        "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions/{$agentSessionId}/messages",
        [
            'text' => 'What cohorts should I use for this hypertension study?',
            'idempotency_key' => 'test-key-'.uniqid(),
        ],
    );

    $response->assertStatus(202)
        ->assertJsonPath('data.accepted', true);

    Http::assertSent(function ($request) use ($agentSessionId) {
        return str_ends_with($request->url(), "/study-designer/sessions/{$agentSessionId}/turn");
    });
});
