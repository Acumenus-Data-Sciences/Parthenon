<?php

use App\Models\User;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('researcher', 'web');
    Role::findOrCreate('super-admin', 'web');
});

afterEach(function () {
    // Clean up users created during tests
    User::where('email', 'like', '%@example%')->delete();
});

it('lists all vocabulary filters', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/etl/aqueduct/lookups/vocabularies');

    $response->assertOk()
        ->assertJsonStructure(['data' => ['vocabularies']])
        ->assertJsonCount(11, 'data.vocabularies');
});

it('previews assembled lookup SQL for a vocabulary', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/etl/aqueduct/lookups/preview/icd10cm');

    $response->assertOk()
        ->assertJsonStructure(['data' => ['vocabulary', 'sql', 'includes_source_to_source']]);

    $sql = $response->json('data.sql');
    expect($sql)->toContain('Source_to_Standard')
        ->toContain('icd10cm')
        ->not->toContain('{vocab_schema}')
        ->not->toContain('{vocabulary_filter}');
});

it('rejects unknown vocabulary with 404', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/etl/aqueduct/lookups/preview/nonexistent');

    $response->assertNotFound();
});

it('generates lookup result envelope for multiple vocabularies', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/etl/aqueduct/lookups/generate', [
            'vocabularies' => ['icd10cm', 'ndc'],
            'include_source_to_source' => true,
            'vocab_schema' => 'vocab',
        ]);

    $response->assertOk()
        ->assertJsonStructure([
            'data' => ['status', 'runtime', 'summary', 'artifacts'],
        ]);

    expect($response->json('data.status'))->toBe('ok');
    expect($response->json('data.artifacts.artifacts'))->toHaveCount(2);
});

it('rejects unauthenticated users', function () {
    $this->getJson('/api/v1/etl/aqueduct/lookups/vocabularies')
        ->assertUnauthorized();
});

it('rejects users without researcher or super-admin role', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/etl/aqueduct/lookups/vocabularies')
        ->assertForbidden();
});

it('rejects vocab_schema with SQL injection characters', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/etl/aqueduct/lookups/generate', [
            'vocabularies' => ['icd10cm'],
            'vocab_schema' => 'vocab; DROP TABLE users; --',
        ]);

    $response->assertUnprocessable();
});

it('shows aqueduct in service discovery', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/study-agent/services');

    $response->assertOk();

    $services = collect($response->json('data.services'));
    $aqueduct = $services->firstWhere('name', 'etl_mapping_workbench');

    expect($aqueduct)->not->toBeNull();
    expect($aqueduct['ui_hints']['title'])->toBe('Aqueduct');
    expect($aqueduct['ui_hints']['accent'])->toBe('teal');
});
