<?php

use App\Models\App\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('requires authentication to list sources', function () {
    $this->getJson('/api/v1/sources')
        ->assertStatus(401);
});

it('creates a source with daimons', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/sources', [
            'source_name' => 'Test CDM',
            'source_key' => 'test_cdm',
            'source_dialect' => 'postgresql',
            'source_connection' => 'jdbc:postgresql://localhost:5432/cdm',
            'daimons' => [
                ['daimon_type' => 'cdm', 'table_qualifier' => 'cdm', 'priority' => 1],
                ['daimon_type' => 'vocabulary', 'table_qualifier' => 'vocab', 'priority' => 1],
                ['daimon_type' => 'results', 'table_qualifier' => 'results', 'priority' => 1],
            ],
        ])
        ->assertStatus(201);

    $response->assertJsonPath('data.source_name', 'Test CDM');
    $response->assertJsonPath('data.source_key', 'test_cdm');

    $this->assertDatabaseHas('sources', ['source_key' => 'test_cdm']);
    $this->assertDatabaseCount('source_daimons', 3);
});

it('validates unique source key', function () {
    $user = User::factory()->create();

    // Create first source
    $this->actingAs($user)
        ->postJson('/api/v1/sources', [
            'source_name' => 'Source 1',
            'source_key' => 'unique_key',
            'source_dialect' => 'postgresql',
            'source_connection' => 'jdbc:postgresql://localhost/db1',
        ])
        ->assertStatus(201);

    // Try duplicate key
    $this->actingAs($user)
        ->postJson('/api/v1/sources', [
            'source_name' => 'Source 2',
            'source_key' => 'unique_key',
            'source_dialect' => 'postgresql',
            'source_connection' => 'jdbc:postgresql://localhost/db2',
        ])
        ->assertStatus(422);
});

it('validates daimon type values', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/v1/sources', [
            'source_name' => 'Bad Source',
            'source_key' => 'bad_source',
            'source_dialect' => 'postgresql',
            'source_connection' => 'jdbc:postgresql://localhost/db',
            'daimons' => [
                ['daimon_type' => 'invalid_type', 'table_qualifier' => 'test'],
            ],
        ])
        ->assertStatus(422);
});

it('lists sources', function () {
    $user = User::factory()->create();

    // Create sources
    $this->actingAs($user)
        ->postJson('/api/v1/sources', [
            'source_name' => 'Source A',
            'source_key' => 'source_a',
            'source_dialect' => 'postgresql',
            'source_connection' => 'jdbc:postgresql://localhost/dba',
        ]);

    $this->actingAs($user)
        ->getJson('/api/v1/sources')
        ->assertStatus(200)
        ->assertJsonStructure(['data']);
});

it('deletes a source', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/sources', [
            'source_name' => 'To Delete',
            'source_key' => 'to_delete',
            'source_dialect' => 'postgresql',
            'source_connection' => 'jdbc:postgresql://localhost/del',
        ]);

    $sourceId = $response->json('data.id');

    $this->actingAs($user)
        ->deleteJson("/api/v1/sources/{$sourceId}")
        ->assertStatus(200);

    $this->assertSoftDeleted('sources', ['id' => $sourceId]);
});
