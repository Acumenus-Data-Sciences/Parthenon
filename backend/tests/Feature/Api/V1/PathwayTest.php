<?php

declare(strict_types=1);

use App\Models\App\PathwayAnalysis;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

it('requires authentication to list pathways', function () {
    $this->getJson('/api/v1/pathways')
        ->assertStatus(401);
});

it('allows viewer access to list pathways (viewer has analyses.view)', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->getJson('/api/v1/pathways')
        ->assertStatus(200);
});

it('lists pathway analyses for researcher', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    PathwayAnalysis::factory()->count(3)->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/pathways')
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(3);
});

it('creates a pathway analysis with valid data', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $payload = [
        'name' => 'T2DM Treatment Pathway',
        'description' => 'Pathway analysis for T2DM first-line therapies',
        'design_json' => [
            'targetCohortId' => 1,
            'eventCohortIds' => [2, 3, 4],
            'maxDepth' => 5,
            'minCellCount' => 5,
            'combinationWindow' => 0,
            'maxPathLength' => 5,
        ],
    ];

    $response = $this->actingAs($user)
        ->postJson('/api/v1/pathways', $payload)
        ->assertStatus(201);

    $response->assertJsonPath('data.name', 'T2DM Treatment Pathway');
    $response->assertJsonPath('message', 'Pathway analysis created.');

    $this->assertDatabaseHas('pathway_analyses', ['name' => 'T2DM Treatment Pathway']);
});

it('validates required fields on pathway creation', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->postJson('/api/v1/pathways', [
            'description' => 'Missing name and design_json',
        ])
        ->assertStatus(422);
});

it('shows a pathway analysis with executions', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $pathway = PathwayAnalysis::factory()->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/pathways/{$pathway->id}")
        ->assertStatus(200);

    $response->assertJsonPath('data.id', $pathway->id);
    $response->assertJsonStructure(['data' => ['id', 'name', 'design_json', 'author', 'executions']]);
});

it('updates a pathway analysis', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $pathway = PathwayAnalysis::factory()->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->putJson("/api/v1/pathways/{$pathway->id}", [
            'name' => 'Updated Pathway Name',
        ])
        ->assertStatus(200);

    $response->assertJsonPath('data.name', 'Updated Pathway Name');
    $response->assertJsonPath('message', 'Pathway analysis updated.');
});

it('soft deletes a pathway analysis', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $pathway = PathwayAnalysis::factory()->create(['author_id' => $user->id]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/pathways/{$pathway->id}")
        ->assertStatus(200)
        ->assertJsonPath('message', 'Pathway analysis deleted.');

    $this->assertSoftDeleted('pathway_analyses', ['id' => $pathway->id]);
});

it('denies viewer from creating a pathway analysis', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->postJson('/api/v1/pathways', [
            'name' => 'Should Fail',
            'design_json' => [
                'targetCohortId' => 1,
                'eventCohortIds' => [2],
            ],
        ])
        ->assertStatus(403);
});
