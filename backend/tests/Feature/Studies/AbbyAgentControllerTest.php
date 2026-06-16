<?php

use App\Models\App\AgentSession;
use App\Models\App\Study;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

it('starts a abby agent session for a study collaborator and calls the AI harness', function () {
    Http::fake(['*/agent/sessions' => Http::response(['ok' => true], 200)]);

    $user = User::factory()->create();
    $study = Study::create(['title' => 'HTN study', 'created_by' => $user->id, 'status' => 'draft']);

    $resp = $this->actingAs($user)->postJson("/api/v1/studies/{$study->slug}/agent/sessions");

    $resp->assertStatus(201)
        ->assertJsonPath('data.channel_name', "private-abby.study.{$study->id}")
        // Defaults preserve EE behavior when python-ai omits the fields.
        ->assertJsonPath('data.provider', 'anthropic')
        ->assertJsonPath('data.actions_enabled', true);

    $this->assertDatabaseHas('agent_sessions', [
        'profile' => 'abby',
        'subject_id' => $study->id,
        'user_id' => $user->id,
        'status' => 'active',
    ]);

    Http::assertSent(fn ($req) => str_contains($req->url(), '/agent/sessions')
        && $req['profile'] === 'abby'
        && $req['context']['study_slug'] === $study->slug);
});

it('passes through a reads-only CE deployment provider + actions flag', function () {
    Http::fake(['*/agent/sessions' => Http::response([
        'provider' => 'local',
        'actions_enabled' => false,
    ], 200)]);

    $user = User::factory()->create();
    $study = Study::create(['title' => 'CE study', 'created_by' => $user->id, 'status' => 'draft']);

    $resp = $this->actingAs($user)->postJson("/api/v1/studies/{$study->slug}/agent/sessions");

    $resp->assertStatus(201)
        ->assertJsonPath('data.provider', 'local')
        ->assertJsonPath('data.actions_enabled', false);
});

it('rejects a non-collaborator with 404 and never calls the agent service', function () {
    Http::fake();

    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $study = Study::create(['title' => 'HTN study', 'created_by' => $owner->id, 'status' => 'draft']);

    $this->actingAs($intruder)
        ->postJson("/api/v1/studies/{$study->slug}/agent/sessions")
        ->assertStatus(404);

    // The true invariant: a blocked intruder created no session.
    $this->assertDatabaseCount('agent_sessions', 0);
});

it('returns 503 and marks the session errored when the agent service is down', function () {
    Http::fake(['*/agent/sessions' => Http::response(null, 500)]);

    $user = User::factory()->create();
    $study = Study::create(['title' => 'HTN study', 'created_by' => $user->id, 'status' => 'draft']);

    $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/agent/sessions")
        ->assertStatus(503);

    $this->assertDatabaseHas('agent_sessions', [
        'subject_id' => $study->id,
        'status' => 'error',
    ]);
});

it('forwards a message to the agent turn endpoint', function () {
    Http::fake([
        '*/agent/sessions' => Http::response(['ok' => true], 200),
        '*/turn' => Http::response(['ok' => true], 202),
    ]);

    $user = User::factory()->create();
    $study = Study::create(['title' => 'HTN study', 'created_by' => $user->id, 'status' => 'draft']);
    $session = AgentSession::create([
        'profile' => 'abby',
        'subject_type' => 'study',
        'subject_id' => $study->id,
        'user_id' => $user->id,
        'status' => 'active',
        'context_json' => ['study_slug' => $study->slug],
        'last_active_at' => now(),
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/studies/{$study->slug}/agent/sessions/{$session->id}/messages", [
            'text' => 'What is blocking this study?',
            'idempotency_key' => 'abc-123',
        ])
        ->assertStatus(202)
        ->assertJsonPath('data.accepted', true);

    Http::assertSent(fn ($req) => str_contains($req->url(), "/agent/sessions/{$session->id}/turn"));
});
