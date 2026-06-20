<?php

declare(strict_types=1);

use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    $this->exportedCohortIds = [];
});

afterEach(function () {
    if (! empty($this->exportedCohortIds)) {
        DB::connection('pgsql_testing')
            ->table('results.cohort')
            ->whereIn('cohort_definition_id', $this->exportedCohortIds)
            ->delete();
    }
});

function patientSimilarityExportSource(): Source
{
    $source = Source::factory()->create([
        'source_connection' => 'pgsql_testing',
    ]);

    SourceDaimon::factory()->for($source, 'source')->cdm()->create([
        'table_qualifier' => 'cdm',
    ]);
    SourceDaimon::factory()->for($source, 'source')->vocabulary()->create([
        'table_qualifier' => 'vocab',
    ]);
    SourceDaimon::factory()->for($source, 'source')->results()->create([
        'table_qualifier' => 'results',
    ]);

    return $source;
}

it('requires authentication to export a patient similarity cohort', function () {
    $this->postJson('/api/v1/patient-similarity/export-cohort', [])
        ->assertStatus(401);
});

it('requires patient similarity view permission to export a cohort', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/v1/patient-similarity/export-cohort', [
            'person_ids' => [1001, 1002],
            'source_id' => patientSimilarityExportSource()->id,
            'cohort_name' => 'Matched PSM Export',
        ])
        ->assertStatus(403);
});

it('validates explicit matched cohort export payloads', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->postJson('/api/v1/patient-similarity/export-cohort', [
            'person_ids' => [],
            'source_id' => patientSimilarityExportSource()->id,
            'cohort_name' => 'Matched PSM Export',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['person_ids']);
});

it('exports matched person ids into the source results cohort table', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = patientSimilarityExportSource();
    $target = CohortDefinition::factory()->create(['author_id' => $user->id]);
    $comparator = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $response = $this->actingAs($user)
        ->postJson('/api/v1/patient-similarity/export-cohort', [
            'person_ids' => [1001, 1002, 1001, 1003],
            'source_id' => $source->id,
            'cohort_name' => 'Matched PSM Export',
            'cohort_description' => 'Exported from PSM matched pairs.',
            'target_cohort_id' => $target->id,
            'comparator_cohort_id' => $comparator->id,
            'matched_pair_count' => 2,
            'model_metrics' => [
                'auc' => 0.78,
                'caliper' => 0.2,
            ],
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.patient_count', 3)
        ->assertJsonPath('data.cohort_name', 'Matched PSM Export');

    $cohortId = (int) $response->json('data.cohort_definition_id');
    $this->exportedCohortIds[] = $cohortId;

    $cohort = CohortDefinition::findOrFail($cohortId);
    expect($cohort->description)->toBe('Exported from PSM matched pairs.');
    expect($cohort->expression_json)->toMatchArray([
        'type' => 'patient_similarity_matched_export',
        'source_id' => $source->id,
        'requested_person_count' => 4,
        'patient_count' => 3,
        'duplicates_removed' => 1,
        'target_cohort_id' => $target->id,
        'comparator_cohort_id' => $comparator->id,
        'matched_pair_count' => 2,
    ]);
    expect($cohort->expression_json)->toHaveKey('person_ids_sha256');
    expect($cohort->expression_json)->not->toHaveKey('person_ids');

    $subjects = DB::connection('pgsql_testing')
        ->table('results.cohort')
        ->where('cohort_definition_id', $cohortId)
        ->orderBy('subject_id')
        ->pluck('subject_id')
        ->map(fn ($id) => (int) $id)
        ->all();

    expect($subjects)->toBe([1001, 1002, 1003]);
});
