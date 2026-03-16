<?php

use App\Models\App\AtlasIdMapping;
use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Models\App\WebApiRegistry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\actingAs;

uses(RefreshDatabase::class);

it('imports atlas cohort definitions through the finngen cohort operations endpoint', function () {
    Http::fake([
        'https://atlas.example.com/WebAPI/cohortdefinition/101' => Http::response([
            'id' => 101,
            'name' => 'Atlas Diabetes Cohort',
            'description' => 'Imported from Atlas',
            'expression' => [
                'conceptSets' => [],
                'PrimaryCriteria' => [
                    'CriteriaList' => [
                        ['ConditionOccurrence' => ['CodesetId' => 0]],
                    ],
                    'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
                ],
                'QualifiedLimit' => ['Type' => 'First'],
            ],
        ], 200),
    ]);

    $user = User::factory()->create();
    $source = Source::factory()->create([
        'source_key' => 'acumenus',
        'source_dialect' => 'postgresql',
    ]);

    WebApiRegistry::create([
        'name' => 'Atlas Production',
        'base_url' => 'https://atlas.example.com/WebAPI',
        'auth_type' => 'none',
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    actingAs($user)
        ->postJson('/api/v1/study-agent/finngen/cohort-operations', [
            'source' => [
                'id' => $source->id,
                'source_name' => $source->source_name,
                'source_key' => $source->source_key,
                'source_dialect' => $source->source_dialect,
                'daimons' => [],
            ],
            'cohort_definition' => [
                'conceptSets' => [],
                'PrimaryCriteria' => [
                    'CriteriaList' => [
                        ['ConditionOccurrence' => ['CodesetId' => 0]],
                    ],
                    'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
                ],
                'QualifiedLimit' => ['Type' => 'First'],
            ],
            'import_mode' => 'atlas',
            'atlas_cohort_ids' => [101],
        ])
        ->assertOk()
        ->assertJsonPath('data.import_review.1.status', 'ready')
        ->assertJsonPath('data.selected_cohorts.0.name', 'Atlas Diabetes Cohort')
        ->assertJsonPath('data.sample_rows.0.cohort_name', 'Atlas Diabetes Cohort');

    $cohort = CohortDefinition::query()->where('name', 'Atlas Diabetes Cohort')->first();

    expect($cohort)->not->toBeNull();
    expect(AtlasIdMapping::query()
        ->where('entity_type', 'cohort_definition')
        ->where('atlas_id', 101)
        ->where('parthenon_id', $cohort?->id)
        ->exists())->toBeTrue();
});
