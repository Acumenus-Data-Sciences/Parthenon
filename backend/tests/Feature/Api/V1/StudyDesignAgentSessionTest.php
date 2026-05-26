<?php

use App\Models\App\AgentSession;
use App\Models\App\Study;
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
        '*/agent/sessions' => Http::response(['ok' => true], 200),
    ]);

    Sanctum::actingAs($this->user, ['*']);

    $response = $this->postJson(
        "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions",
    );

    $response->assertStatus(201)
        ->assertJsonPath('data.channel_name', "private-study-design.session.{$this->session->id}");

    $agentSessionId = $response->json('data.agent_session_id');
    expect($agentSessionId)->toBeInt();

    $this->assertDatabaseHas('agent_sessions', [
        'id' => $agentSessionId,
        'profile' => 'study_design',
        'subject_type' => 'study_design_session',
        'subject_id' => $this->session->id,
        'user_id' => $this->user->id,
        'status' => 'active',
    ]);
});

// ---------------------------------------------------------------------------
// start — minted token has correct name and abilities
// ---------------------------------------------------------------------------

it('start mints a scoped token with study-designer-agent name and correct abilities', function () {
    Http::fake([
        '*/agent/sessions' => Http::response(['ok' => true], 200),
    ]);

    Sanctum::actingAs($this->user, ['*']);

    $response = $this->postJson(
        "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions",
    );

    $response->assertStatus(201);

    $agentSessionId = $response->json('data.agent_session_id');
    $agentSession = AgentSession::findOrFail($agentSessionId);

    // token_id must be recorded on the agent session row
    expect($agentSession->token_id)->not->toBeNull();

    $token = $this->user->tokens()->where('id', $agentSession->token_id)->firstOrFail();

    expect($token->name)->toBe('study-designer-agent');
    expect($token->abilities)->toBe(['studies.view', 'studies.create']);
});

// ---------------------------------------------------------------------------
// start — python-ai receives correct generic /agent/sessions body
// ---------------------------------------------------------------------------

it('start posts correct profile/subject_id/channel/ingest_path/context to python-ai', function () {
    Http::fake([
        '*/agent/sessions' => Http::response(['ok' => true], 200),
    ]);

    Sanctum::actingAs($this->user, ['*']);

    $this->postJson(
        "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions",
    )->assertStatus(201);

    Http::assertSent(function ($request) {
        $body = $request->data();

        return str_ends_with($request->url(), '/agent/sessions')
            && $body['profile'] === 'study_design'
            && (int) $body['subject_id'] === (int) $this->session->id
            && $body['channel'] === "private-study-design.session.{$this->session->id}"
            && str_contains($body['ingest_path'], '/agent/sessions/')
            && str_contains($body['ingest_path'], '/ingest')
            && isset($body['context']['study_slug'])
            && (int) $body['context']['design_session_id'] === (int) $this->session->id;
    });
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
// message — 202 and python-ai /agent/sessions/{id}/turn endpoint is called
// ---------------------------------------------------------------------------

it('message forwards to python-ai turn endpoint and returns 202', function () {
    Http::fake([
        '*/agent/sessions' => Http::response(['ok' => true], 200),
        '*/agent/sessions/*/turn' => Http::response(['ok' => true], 200),
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
        return str_ends_with($request->url(), "/agent/sessions/{$agentSessionId}/turn");
    });
});

// ---------------------------------------------------------------------------
// ingest — persists cost/tokens/session_id and returns 200
// ---------------------------------------------------------------------------

it('ingest persists cost tokens and anthropic_session_id and returns 200', function () {
    Sanctum::actingAs($this->user, ['*']);

    $agentSession = AgentSession::create([
        'profile' => 'study_design',
        'subject_type' => 'study_design_session',
        'subject_id' => $this->session->id,
        'user_id' => $this->user->id,
        'status' => 'active',
        'cost_usd' => 0,
        'tokens_in' => 0,
        'tokens_out' => 0,
        'last_active_at' => now(),
    ]);

    $response = $this->postJson(
        "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions/{$agentSession->id}/ingest",
        [
            'anthropic_session_id' => 'sess-abc',
            'cost_usd' => 0.12,
            'tokens_in' => 100,
            'tokens_out' => 40,
            'status' => 'active',
        ],
    );

    $response->assertStatus(200)
        ->assertJsonPath('data.ok', true);

    $this->assertDatabaseHas('agent_sessions', [
        'id' => $agentSession->id,
        'anthropic_session_id' => 'sess-abc',
        'tokens_in' => 100,
        'tokens_out' => 40,
        'status' => 'active',
    ]);

    // Check cost_usd persisted (float comparison via model)
    $agentSession->refresh();
    expect((float) $agentSession->cost_usd)->toBe(0.12);
});

// ---------------------------------------------------------------------------
// start — python-ai failure revokes token and sets status=error
// ---------------------------------------------------------------------------

it('start revokes scoped token and sets status error when python-ai fails', function () {
    Http::fake(['*' => Http::response([], 500)]);

    Sanctum::actingAs($this->user, ['*']);

    $response = $this->postJson(
        "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions",
    );

    $response->assertStatus(503);

    // No study-designer-agent token must remain for the user
    expect($this->user->tokens()->where('name', 'study-designer-agent')->count())->toBe(0);

    // The agent session row must exist with status=error and token_id=null
    $this->assertDatabaseHas('agent_sessions', [
        'profile' => 'study_design',
        'subject_type' => 'study_design_session',
        'subject_id' => $this->session->id,
        'user_id' => $this->user->id,
        'status' => 'error',
        'token_id' => null,
    ]);
});

it('ingest increments cost and tokens on a second call', function () {
    Sanctum::actingAs($this->user, ['*']);

    $agentSession = AgentSession::create([
        'profile' => 'study_design',
        'subject_type' => 'study_design_session',
        'subject_id' => $this->session->id,
        'user_id' => $this->user->id,
        'status' => 'active',
        'cost_usd' => 0,
        'tokens_in' => 0,
        'tokens_out' => 0,
        'last_active_at' => now(),
    ]);

    $payload = [
        'anthropic_session_id' => 'sess-abc',
        'cost_usd' => 0.12,
        'tokens_in' => 100,
        'tokens_out' => 40,
        'status' => 'active',
    ];

    $url = "/api/v1/studies/{$this->study->slug}/design-sessions/{$this->session->id}/agent/sessions/{$agentSession->id}/ingest";

    $this->postJson($url, $payload)->assertStatus(200);
    $this->postJson($url, $payload)->assertStatus(200);

    $agentSession->refresh();
    expect((float) $agentSession->cost_usd)->toBe(0.24);
    expect($agentSession->tokens_in)->toBe(200);
    expect($agentSession->tokens_out)->toBe(80);
});
