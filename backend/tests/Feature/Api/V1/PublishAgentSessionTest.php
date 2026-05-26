<?php

use App\Models\App\AgentSession;
use App\Models\App\PublicationDraft;
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

    $this->draft = PublicationDraft::create([
        'user_id' => $this->user->id,
        'study_id' => null,
        'title' => 'Agent test draft',
        'template' => 'standard',
        'document_json' => [],
        'status' => 'draft',
        'visibility' => 'private',
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

    $response = $this->postJson("/api/v1/publish/drafts/{$this->draft->id}/agent/sessions");

    $response->assertStatus(201)
        ->assertJsonPath('data.channel_name', "private-publish.draft.{$this->draft->id}");

    $agentSessionId = $response->json('data.agent_session_id');
    expect($agentSessionId)->toBeInt();

    $this->assertDatabaseHas('agent_sessions', [
        'id' => $agentSessionId,
        'profile' => 'publish',
        'subject_type' => 'publication_draft',
        'subject_id' => $this->draft->id,
        'user_id' => $this->user->id,
        'status' => 'active',
    ]);
});

// ---------------------------------------------------------------------------
// start — minted token has correct name and abilities
// ---------------------------------------------------------------------------

it('start mints a scoped token with publish-agent name and correct abilities', function () {
    Http::fake([
        '*/agent/sessions' => Http::response(['ok' => true], 200),
    ]);

    Sanctum::actingAs($this->user, ['*']);

    $response = $this->postJson("/api/v1/publish/drafts/{$this->draft->id}/agent/sessions");

    $response->assertStatus(201);

    $agentSessionId = $response->json('data.agent_session_id');
    $agentSession = AgentSession::findOrFail($agentSessionId);

    // token_id must be recorded on the agent session row
    expect($agentSession->token_id)->not->toBeNull();

    $token = $this->user->tokens()->where('id', $agentSession->token_id)->firstOrFail();

    expect($token->name)->toBe('publish-agent');
    expect($token->abilities)->toBe(['publications.view', 'publications.update']);
});

// ---------------------------------------------------------------------------
// start — python-ai receives correct generic /agent/sessions body
// ---------------------------------------------------------------------------

it('start posts correct profile/subject_id/channel/ingest_path/context to python-ai', function () {
    Http::fake([
        '*/agent/sessions' => Http::response(['ok' => true], 200),
    ]);

    Sanctum::actingAs($this->user, ['*']);

    $this->postJson("/api/v1/publish/drafts/{$this->draft->id}/agent/sessions")
        ->assertStatus(201);

    Http::assertSent(function ($request) {
        $body = $request->data();

        return str_ends_with($request->url(), '/agent/sessions')
            && $body['profile'] === 'publish'
            && (int) $body['subject_id'] === (int) $this->draft->id
            && $body['channel'] === "private-publish.draft.{$this->draft->id}"
            && str_contains($body['ingest_path'], '/agent/sessions/')
            && str_contains($body['ingest_path'], '/ingest')
            && isset($body['context']['draft_id'])
            && (int) $body['context']['draft_id'] === (int) $this->draft->id;
    });
});

// ---------------------------------------------------------------------------
// start — python-ai failure revokes token and sets status=error
// ---------------------------------------------------------------------------

it('start revokes scoped token and sets status error when python-ai fails', function () {
    Http::fake(['*' => Http::response([], 500)]);

    Sanctum::actingAs($this->user, ['*']);

    $response = $this->postJson("/api/v1/publish/drafts/{$this->draft->id}/agent/sessions");

    $response->assertStatus(503);

    // No publish-agent token must remain for the user
    expect($this->user->tokens()->where('name', 'publish-agent')->count())->toBe(0);

    // The agent session row must exist with status=error and token_id=null
    $this->assertDatabaseHas('agent_sessions', [
        'profile' => 'publish',
        'subject_type' => 'publication_draft',
        'subject_id' => $this->draft->id,
        'user_id' => $this->user->id,
        'status' => 'error',
        'token_id' => null,
    ]);
});

// ---------------------------------------------------------------------------
// start — non-owner (policy rejects) gets 404
// ---------------------------------------------------------------------------

it('start returns 404 for a user who does not own the draft and has no study access', function () {
    Http::fake([
        '*/agent/sessions' => Http::response(['ok' => true], 200),
    ]);

    $stranger = User::factory()->create();
    $stranger->assignRole('researcher');

    Sanctum::actingAs($stranger, ['*']);

    $response = $this->postJson("/api/v1/publish/drafts/{$this->draft->id}/agent/sessions");

    $response->assertStatus(404);
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

    // Create an agent session via start
    $startResponse = $this->postJson("/api/v1/publish/drafts/{$this->draft->id}/agent/sessions");
    $startResponse->assertStatus(201);
    $agentSessionId = $startResponse->json('data.agent_session_id');

    // Send a message
    $response = $this->postJson(
        "/api/v1/publish/drafts/{$this->draft->id}/agent/sessions/{$agentSessionId}/messages",
        [
            'text' => 'Help me write the methods section for this publication.',
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
        'profile' => 'publish',
        'subject_type' => 'publication_draft',
        'subject_id' => $this->draft->id,
        'user_id' => $this->user->id,
        'status' => 'active',
        'cost_usd' => 0,
        'tokens_in' => 0,
        'tokens_out' => 0,
        'last_active_at' => now(),
    ]);

    $response = $this->postJson(
        "/api/v1/publish/drafts/{$this->draft->id}/agent/sessions/{$agentSession->id}/ingest",
        [
            'anthropic_session_id' => 'sess-pub-abc',
            'cost_usd' => 0.05,
            'tokens_in' => 200,
            'tokens_out' => 80,
            'status' => 'active',
        ],
    );

    $response->assertStatus(200)
        ->assertJsonPath('data.ok', true);

    $this->assertDatabaseHas('agent_sessions', [
        'id' => $agentSession->id,
        'anthropic_session_id' => 'sess-pub-abc',
        'tokens_in' => 200,
        'tokens_out' => 80,
        'status' => 'active',
    ]);

    $agentSession->refresh();
    expect((float) $agentSession->cost_usd)->toBe(0.05);
});

// ---------------------------------------------------------------------------
// ingest — increments cost and tokens on a second call
// ---------------------------------------------------------------------------

it('ingest increments cost and tokens on a second call', function () {
    Sanctum::actingAs($this->user, ['*']);

    $agentSession = AgentSession::create([
        'profile' => 'publish',
        'subject_type' => 'publication_draft',
        'subject_id' => $this->draft->id,
        'user_id' => $this->user->id,
        'status' => 'active',
        'cost_usd' => 0,
        'tokens_in' => 0,
        'tokens_out' => 0,
        'last_active_at' => now(),
    ]);

    $payload = [
        'anthropic_session_id' => 'sess-pub-abc',
        'cost_usd' => 0.05,
        'tokens_in' => 200,
        'tokens_out' => 80,
        'status' => 'active',
    ];

    $url = "/api/v1/publish/drafts/{$this->draft->id}/agent/sessions/{$agentSession->id}/ingest";

    $this->postJson($url, $payload)->assertStatus(200);
    $this->postJson($url, $payload)->assertStatus(200);

    $agentSession->refresh();
    expect((float) $agentSession->cost_usd)->toBe(0.10);
    expect($agentSession->tokens_in)->toBe(400);
    expect($agentSession->tokens_out)->toBe(160);
});
