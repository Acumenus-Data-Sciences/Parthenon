<?php

use App\Models\App\CohortAuthoringArtifact;
use App\Models\App\CohortDefinition;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function phase6ValidExpression(): array
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

it('exports an R authoring package with CirceR and Capr handoff files', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create([
        'author_id' => $user->id,
        'name' => 'Cardiac structural disorders',
        'expression_json' => phase6ValidExpression(),
    ]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}/authoring/export?format=r_package")
        ->assertOk();

    $response->assertJsonPath('data.format', 'r_package');
    $response->assertJsonPath('data.mime_type', 'application/json');
    $response->assertJsonPath('data.content.package.type', 'parthenon-ohdsi-authoring');

    $paths = collect($response->json('data.content.files'))->pluck('path')->all();
    expect($paths)->toContain('inst/cohorts/cohort.json')
        ->and($paths)->toContain('R/circer-export.R')
        ->and($paths)->toContain('R/capr-handoff.R');

    $this->assertDatabaseHas('cohort_authoring_artifacts', [
        'cohort_definition_id' => $cohort->id,
        'author_id' => $user->id,
        'direction' => 'export',
        'format' => 'r_package',
    ]);
});

it('exports a CirceR script that embeds the canonical cohort expression', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create([
        'author_id' => $user->id,
        'name' => 'Hemodynamic disorders',
        'expression_json' => phase6ValidExpression(),
    ]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}/authoring/export?format=circer")
        ->assertOk();

    $response->assertJsonPath('data.format', 'circer_r');
    $response->assertJsonPath('data.download_name', 'hemodynamic-disorders.circer.R');

    expect($response->json('data.content'))
        ->toContain('PARTHENON_COHORT_JSON_BEGIN')
        ->and($response->json('data.content'))
        ->toContain('CirceR is installed');
});

it('imports a CirceR artifact and suffixes duplicate cohort names', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create([
        'author_id' => $user->id,
        'name' => 'Cardiovascular hemodynamic disorders',
        'expression_json' => phase6ValidExpression(),
    ]);

    $artifact = $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}/authoring/export?format=circer_r")
        ->assertOk()
        ->json('data.content');

    $response = $this->actingAs($user)
        ->postJson('/api/v1/cohort-definitions/authoring/import', [
            'format' => 'circer_r',
            'artifact' => $artifact,
        ])
        ->assertCreated();

    $response->assertJsonPath('data.status', 'imported');
    $response->assertJsonPath('data.cohort_definition.name', 'Cardiovascular hemodynamic disorders (2)');
    $response->assertJsonPath('data.artifact.direction', 'import');
    $response->assertJsonPath('data.artifact.format', 'circer_r');

    expect(CohortDefinition::query()->where('name', 'Cardiovascular hemodynamic disorders (2)')->exists())
        ->toBeTrue();
});

it('skips duplicate imports when requested', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create([
        'author_id' => $user->id,
        'name' => 'Duplicate managed cohort',
        'expression_json' => phase6ValidExpression(),
    ]);

    $payload = [
        'name' => $cohort->name,
        'description' => $cohort->description,
        'expression' => phase6ValidExpression(),
    ];

    $this->actingAs($user)
        ->postJson('/api/v1/cohort-definitions/authoring/import', [
            'format' => 'atlas_json',
            'artifact' => $payload,
            'duplicate_strategy' => 'skip',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'skipped')
        ->assertJsonPath('data.reason', 'Duplicate name');

    expect(CohortDefinition::query()->where('name', 'Duplicate managed cohort')->count())->toBe(1)
        ->and(CohortAuthoringArtifact::query()->where('direction', 'import')->count())->toBe(0);
});

it('rejects unsupported authoring artifact formats', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::factory()->create([
        'author_id' => $user->id,
        'expression_json' => phase6ValidExpression(),
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}/authoring/export?format=unknown")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['format']);
});
