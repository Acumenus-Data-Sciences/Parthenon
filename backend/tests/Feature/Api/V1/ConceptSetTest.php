<?php

use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('requires authentication to list concept sets', function () {
    $this->getJson('/api/v1/concept-sets')
        ->assertStatus(401);
});

it('creates a concept set', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/concept-sets', [
            'name' => 'Diabetes Conditions',
            'description' => 'All diabetes-related conditions',
            'is_public' => true,
            'tags' => ['diabetes', 'endocrine'],
        ])
        ->assertStatus(201);

    $response->assertJsonPath('data.name', 'Diabetes Conditions');
    $response->assertJsonPath('data.is_public', true);
    $response->assertJsonPath('message', 'Concept set created');

    $this->assertDatabaseHas('concept_sets', ['name' => 'Diabetes Conditions']);
});

it('validates required name on creation', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/v1/concept-sets', [
            'description' => 'No name provided',
        ])
        ->assertStatus(422);
});

it('lists concept sets with pagination', function () {
    $user = User::factory()->create();

    ConceptSet::factory()->count(3)->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/concept-sets')
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(3);
});

it('shows a concept set with items', function () {
    $user = User::factory()->create();
    $conceptSet = ConceptSet::factory()->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/concept-sets/{$conceptSet->id}")
        ->assertStatus(200);

    $response->assertJsonPath('data.id', $conceptSet->id);
    $response->assertJsonStructure(['data' => ['id', 'name', 'description', 'items']]);
});

it('updates a concept set', function () {
    $user = User::factory()->create();
    $conceptSet = ConceptSet::factory()->create(['author_id' => $user->id]);

    $this->actingAs($user)
        ->putJson("/api/v1/concept-sets/{$conceptSet->id}", [
            'name' => 'Updated Name',
        ])
        ->assertStatus(200)
        ->assertJsonPath('data.name', 'Updated Name');
});

it('deletes a concept set', function () {
    $user = User::factory()->create();
    $conceptSet = ConceptSet::factory()->create(['author_id' => $user->id]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/concept-sets/{$conceptSet->id}")
        ->assertStatus(200)
        ->assertJsonPath('message', 'Concept set deleted');

    $this->assertSoftDeleted('concept_sets', ['id' => $conceptSet->id]);
});

it('adds an item to a concept set', function () {
    $user = User::factory()->create();
    $conceptSet = ConceptSet::factory()->create(['author_id' => $user->id]);

    $this->actingAs($user)
        ->postJson("/api/v1/concept-sets/{$conceptSet->id}/items", [
            'concept_id' => 201826,
            'is_excluded' => false,
            'include_descendants' => true,
            'include_mapped' => false,
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.concept_id', 201826);

    $this->assertDatabaseHas('concept_set_items', [
        'concept_set_id' => $conceptSet->id,
        'concept_id' => 201826,
        'include_descendants' => true,
    ]);
});

it('removes an item from a concept set', function () {
    $user = User::factory()->create();
    $conceptSet = ConceptSet::factory()->create(['author_id' => $user->id]);

    $item = $conceptSet->items()->create([
        'concept_id' => 201826,
        'is_excluded' => false,
        'include_descendants' => false,
        'include_mapped' => false,
    ]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/concept-sets/{$conceptSet->id}/items/{$item->id}")
        ->assertStatus(200);

    $this->assertDatabaseMissing('concept_set_items', ['id' => $item->id]);
});
