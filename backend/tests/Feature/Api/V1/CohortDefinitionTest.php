<?php

use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Minimal valid cohort expression (PascalCase keys per OHDSI Circe convention).
 */
function validExpression(): array
{
    return [
        'conceptSets' => [],
        'PrimaryCriteria' => [
            'CriteriaList' => [
                ['ConditionOccurrence' => ['CodesetId' => 0]],
            ],
            'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
        ],
        'QualifiedLimit' => ['Type' => 'First'],
    ];
}

it('requires authentication to list cohort definitions', function () {
    $this->getJson('/api/v1/cohort-definitions')
        ->assertStatus(401);
});

it('creates a cohort definition with valid expression', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/api/v1/cohort-definitions', [
            'name' => 'GI Bleed New Users',
            'description' => 'New users with GI bleed',
            'expression_json' => validExpression(),
            'is_public' => false,
        ])
        ->assertStatus(201);

    $response->assertJsonPath('data.name', 'GI Bleed New Users');
    $response->assertJsonPath('message', 'Cohort definition created.');

    $this->assertDatabaseHas('cohort_definitions', ['name' => 'GI Bleed New Users']);
});

it('validates required fields on creation', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/v1/cohort-definitions', [
            'description' => 'Missing name and expression',
        ])
        ->assertStatus(422);
});

it('lists cohort definitions with generation stats', function () {
    $user = User::factory()->create();
    CohortDefinition::factory()->count(3)->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/cohort-definitions')
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(3);
});

it('shows a cohort definition with generations', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}")
        ->assertStatus(200);

    $response->assertJsonPath('data.id', $cohort->id);
    $response->assertJsonStructure(['data' => ['id', 'name', 'expression_json', 'author', 'generations']]);
});

it('updates a cohort definition and increments version', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create([
        'author_id' => $user->id,
        'version' => 1,
    ]);

    $newExpression = [
        'conceptSets' => [],
        'PrimaryCriteria' => [
            'CriteriaList' => [
                ['ConditionOccurrence' => ['CodesetId' => 0]],
            ],
            'ObservationWindow' => ['PriorDays' => 365, 'PostDays' => 0],
        ],
        'QualifiedLimit' => ['Type' => 'First'],
    ];

    $response = $this->actingAs($user)
        ->putJson("/api/v1/cohort-definitions/{$cohort->id}", [
            'name' => 'Updated Cohort',
            'expression_json' => $newExpression,
        ])
        ->assertStatus(200);

    $response->assertJsonPath('data.name', 'Updated Cohort');
    expect($cohort->fresh()->version)->toBeGreaterThanOrEqual(2);
});

it('soft deletes a cohort definition', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/cohort-definitions/{$cohort->id}")
        ->assertStatus(200)
        ->assertJsonPath('message', 'Cohort definition deleted.');

    $this->assertSoftDeleted('cohort_definitions', ['id' => $cohort->id]);
});

it('copies a cohort definition', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/copy")
        ->assertStatus(201);

    $response->assertJsonPath('message', 'Cohort definition copied.');
    expect($response->json('data.name'))->toContain('Copy of');
    expect(CohortDefinition::count())->toBe(2);
});

it('previews compiled SQL', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}/sql")
        ->assertStatus(200);

    $response->assertJsonStructure(['data' => ['cohort_definition_id', 'sql']]);
});

it('dispatches generation job', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);
    $source = Source::factory()->create();

    $response = $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/generate", [
            'source_id' => $source->id,
        ])
        ->assertStatus(202);

    $response->assertJsonPath('message', 'Cohort generation queued.');
    $response->assertJsonStructure(['data' => ['id', 'status']]);

    $this->assertDatabaseHas('cohort_generations', [
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
    ]);
});

it('lists generation history', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}/generations")
        ->assertStatus(200);

    $response->assertJsonStructure(['data']);
});
