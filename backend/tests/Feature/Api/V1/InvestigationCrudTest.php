<?php

use App\Models\App\Investigation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates an investigation', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson('/api/v1/investigations', [
        'title' => 'SGLT2i and CKD Progression',
        'research_question' => 'Does SGLT2 inhibition reduce CKD progression in T2DM?',
    ]);

    $response->assertStatus(201);
    $response->assertJsonPath('title', 'SGLT2i and CKD Progression');
    $response->assertJsonPath('status', 'draft');
    $this->assertDatabaseHas('investigations', ['title' => 'SGLT2i and CKD Progression']);
});

it('lists investigations for the authenticated user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    Investigation::create(['title' => 'Mine', 'owner_id' => $user->id, 'status' => 'draft']);
    Investigation::create(['title' => 'Theirs', 'owner_id' => $other->id, 'status' => 'draft']);

    $response = $this->actingAs($user)->getJson('/api/v1/investigations');

    $response->assertStatus(200);
    $response->assertJsonCount(1, 'data');
    $response->assertJsonPath('data.0.title', 'Mine');
});

it('shows a single investigation with pins', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'draft']);

    $response = $this->actingAs($user)->getJson("/api/v1/investigations/{$inv->id}");

    $response->assertStatus(200);
    $response->assertJsonPath('data.title', 'Test');
    $response->assertJsonPath('data.pins', []);
});

it('updates investigation title and status', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Old', 'owner_id' => $user->id, 'status' => 'draft']);

    $response = $this->actingAs($user)->patchJson("/api/v1/investigations/{$inv->id}", [
        'title' => 'New Title',
        'status' => 'active',
    ]);

    $response->assertStatus(200);
    $response->assertJsonPath('data.title', 'New Title');
    $response->assertJsonPath('data.status', 'active');
});

it('archives an investigation on delete', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'To Archive', 'owner_id' => $user->id, 'status' => 'active']);

    $response = $this->actingAs($user)->deleteJson("/api/v1/investigations/{$inv->id}");

    $response->assertStatus(204);
    $this->assertDatabaseHas('investigations', ['id' => $inv->id, 'status' => 'archived']);
});

it('saves domain state and transitions draft to active', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'draft']);

    $state = ['concept_sets' => [['id' => 'cs1', 'name' => 'T2DM', 'concepts' => []]]];

    $response = $this->actingAs($user)->patchJson(
        "/api/v1/investigations/{$inv->id}/state/phenotype",
        ['state' => $state],
    );

    $response->assertStatus(200);
    $response->assertJsonPath('data.domain', 'phenotype');

    $inv->refresh();
    expect($inv->status)->toBe('active');
    expect($inv->phenotype_state)->toHaveKey('concept_sets');
});

it('rejects invalid domain name', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'draft']);

    $response = $this->actingAs($user)->patchJson(
        "/api/v1/investigations/{$inv->id}/state/invalid_domain",
        ['state' => []],
    );

    $response->assertStatus(422);
});

it('requires authentication', function () {
    $response = $this->getJson('/api/v1/investigations');
    $response->assertStatus(401);
});

it('rejects access to another user investigation', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $inv = Investigation::create(['title' => 'Private', 'owner_id' => $owner->id, 'status' => 'draft']);

    $this->actingAs($other)->getJson("/api/v1/investigations/{$inv->id}")
        ->assertStatus(403);

    $this->actingAs($other)->patchJson("/api/v1/investigations/{$inv->id}", ['title' => 'Hacked'])
        ->assertStatus(403);

    $this->actingAs($other)->deleteJson("/api/v1/investigations/{$inv->id}")
        ->assertStatus(403);
});
