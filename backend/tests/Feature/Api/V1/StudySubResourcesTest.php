<?php

use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyActivityLog;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyCohort;
use App\Models\App\StudyExecution;
use App\Models\App\StudyResult;
use App\Models\App\StudySite;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);

    $this->user = User::factory()->create();
    $this->user->assignRole('researcher');

    $this->study = Study::create([
        'title' => 'Test Study',
        'description' => 'A test study for unit tests',
        'study_type' => 'cohort',
        'status' => 'draft',
        'created_by' => $this->user->id,
    ]);

    $this->cohortDefinition = CohortDefinition::create([
        'name' => 'Test Cohort Definition',
        'description' => 'A test cohort definition',
        'author_id' => $this->user->id,
    ]);
});

// ── StudyCohortController ────────────────────────────────────────────────────

test('unauthenticated user cannot list study cohorts', function () {
    $this->getJson("/api/v1/studies/{$this->study->slug}/cohorts")
        ->assertStatus(401);
});

test('authenticated user can list study cohorts', function () {
    StudyCohort::create([
        'study_id' => $this->study->id,
        'cohort_definition_id' => $this->cohortDefinition->id,
        'role' => 'target',
        'label' => 'Target Cohort',
        'sort_order' => 0,
    ]);

    $this->actingAs($this->user)
        ->getJson("/api/v1/studies/{$this->study->slug}/cohorts")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.role', 'target');
});

test('authenticated user can add cohort to study', function () {
    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/cohorts", [
            'cohort_definition_id' => $this->cohortDefinition->id,
            'role' => 'target',
            'label' => 'Target Cohort',
            'description' => 'Primary target cohort',
            'sort_order' => 0,
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.role', 'target')
        ->assertJsonPath('message', 'Study cohort added.');

    $this->assertDatabaseHas('study_cohorts', [
        'study_id' => $this->study->id,
        'cohort_definition_id' => $this->cohortDefinition->id,
        'role' => 'target',
    ]);
});

test('adding cohort validates required fields', function () {
    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/cohorts", [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['cohort_definition_id', 'role']);
});

test('authenticated user can update study cohort', function () {
    $cohort = StudyCohort::create([
        'study_id' => $this->study->id,
        'cohort_definition_id' => $this->cohortDefinition->id,
        'role' => 'target',
        'label' => 'Original Label',
        'sort_order' => 0,
    ]);

    $this->actingAs($this->user)
        ->putJson("/api/v1/studies/{$this->study->slug}/cohorts/{$cohort->id}", [
            'role' => 'comparator',
            'label' => 'Updated Label',
        ])
        ->assertOk()
        ->assertJsonPath('message', 'Study cohort updated.');

    $this->assertDatabaseHas('study_cohorts', [
        'id' => $cohort->id,
        'role' => 'comparator',
        'label' => 'Updated Label',
    ]);
});

test('authenticated user can delete study cohort', function () {
    $cohort = StudyCohort::create([
        'study_id' => $this->study->id,
        'cohort_definition_id' => $this->cohortDefinition->id,
        'role' => 'target',
        'label' => 'Cohort to Delete',
        'sort_order' => 0,
    ]);

    $this->actingAs($this->user)
        ->deleteJson("/api/v1/studies/{$this->study->slug}/cohorts/{$cohort->id}")
        ->assertOk()
        ->assertJsonPath('message', 'Study cohort removed.');

    $this->assertDatabaseMissing('study_cohorts', ['id' => $cohort->id]);
});

test('cannot update cohort belonging to different study', function () {
    $otherStudy = Study::create([
        'title' => 'Other Study',
        'study_type' => 'cohort',
        'status' => 'draft',
        'created_by' => $this->user->id,
    ]);

    $cohort = StudyCohort::create([
        'study_id' => $otherStudy->id,
        'cohort_definition_id' => $this->cohortDefinition->id,
        'role' => 'target',
        'label' => 'Other Cohort',
        'sort_order' => 0,
    ]);

    // Try to update cohort via wrong study URL — should 404
    $this->actingAs($this->user)
        ->putJson("/api/v1/studies/{$this->study->slug}/cohorts/{$cohort->id}", [
            'role' => 'comparator',
        ])
        ->assertStatus(404);
});

// ── StudyResultController ────────────────────────────────────────────────────

test('unauthenticated user cannot list study results', function () {
    $this->getJson("/api/v1/studies/{$this->study->slug}/results")
        ->assertStatus(401);
});

test('authenticated user can list study results', function () {
    // Create prerequisite chain: source -> site, analysis -> execution -> result
    $source = Source::create([
        'source_name' => 'Test Source',
        'source_key' => 'test_source',
        'source_dialect' => 'postgresql',
        'source_connection' => 'jdbc:postgresql://localhost:5432/test',
    ]);

    $site = StudySite::create([
        'study_id' => $this->study->id,
        'source_id' => $source->id,
        'site_role' => 'data_partner',
        'status' => 'irb_approved',
    ]);

    $analysis = StudyAnalysis::create([
        'study_id' => $this->study->id,
        'analysis_type' => 'characterization',
        'analysis_id' => 1,
    ]);

    $execution = StudyExecution::create([
        'study_id' => $this->study->id,
        'study_analysis_id' => $analysis->id,
        'site_id' => $site->id,
        'status' => 'completed',
        'submitted_by' => $this->user->id,
        'execution_engine' => 'hades_r',
    ]);

    StudyResult::create([
        'execution_id' => $execution->id,
        'study_id' => $this->study->id,
        'study_analysis_id' => $analysis->id,
        'site_id' => $site->id,
        'result_type' => 'characterization',
        'summary_data' => ['count' => 500],
        'is_primary' => true,
        'is_publishable' => false,
    ]);

    $this->actingAs($this->user)
        ->getJson("/api/v1/studies/{$this->study->slug}/results")
        ->assertOk()
        ->assertJsonPath('data.0.result_type', 'characterization');
});

test('authenticated user can view single study result', function () {
    $source = Source::create([
        'source_name' => 'Test Source 2',
        'source_key' => 'test_source_2',
        'source_dialect' => 'postgresql',
        'source_connection' => 'jdbc:postgresql://localhost:5432/test',
    ]);

    $site = StudySite::create([
        'study_id' => $this->study->id,
        'source_id' => $source->id,
    ]);

    $analysis = StudyAnalysis::create([
        'study_id' => $this->study->id,
        'analysis_type' => 'incidence_rate',
        'analysis_id' => 2,
    ]);

    $execution = StudyExecution::create([
        'study_id' => $this->study->id,
        'study_analysis_id' => $analysis->id,
        'status' => 'completed',
        'submitted_by' => $this->user->id,
    ]);

    $result = StudyResult::create([
        'execution_id' => $execution->id,
        'study_id' => $this->study->id,
        'study_analysis_id' => $analysis->id,
        'site_id' => $site->id,
        'result_type' => 'incidence_rate',
        'summary_data' => ['rate' => 0.05],
    ]);

    $this->actingAs($this->user)
        ->getJson("/api/v1/studies/{$this->study->slug}/results/{$result->id}")
        ->assertOk()
        ->assertJsonPath('data.result_type', 'incidence_rate');
});

test('authenticated user can update result publishability', function () {
    $source = Source::create([
        'source_name' => 'Test Source 3',
        'source_key' => 'test_source_3',
        'source_dialect' => 'postgresql',
        'source_connection' => 'jdbc:postgresql://localhost:5432/test',
    ]);

    $analysis = StudyAnalysis::create([
        'study_id' => $this->study->id,
        'analysis_type' => 'cohort_count',
        'analysis_id' => 3,
    ]);

    $execution = StudyExecution::create([
        'study_id' => $this->study->id,
        'study_analysis_id' => $analysis->id,
        'status' => 'completed',
        'submitted_by' => $this->user->id,
    ]);

    $result = StudyResult::create([
        'execution_id' => $execution->id,
        'study_id' => $this->study->id,
        'study_analysis_id' => $analysis->id,
        'result_type' => 'cohort_count',
        'summary_data' => ['count' => 100],
        'is_publishable' => false,
    ]);

    $this->actingAs($this->user)
        ->putJson("/api/v1/studies/{$this->study->slug}/results/{$result->id}", [
            'is_publishable' => true,
        ])
        ->assertOk()
        ->assertJsonPath('message', 'Result updated.');

    $result->refresh();
    expect($result->is_publishable)->toBeTrue();
    expect($result->reviewed_by)->toBe($this->user->id);
    expect($result->reviewed_at)->not->toBeNull();
});

test('viewing result from different study returns 404', function () {
    $otherStudy = Study::create([
        'title' => 'Other Study for Results',
        'study_type' => 'cohort',
        'status' => 'draft',
        'created_by' => $this->user->id,
    ]);

    $analysis = StudyAnalysis::create([
        'study_id' => $otherStudy->id,
        'analysis_type' => 'characterization',
        'analysis_id' => 10,
    ]);

    $execution = StudyExecution::create([
        'study_id' => $otherStudy->id,
        'study_analysis_id' => $analysis->id,
        'status' => 'completed',
        'submitted_by' => $this->user->id,
    ]);

    $result = StudyResult::create([
        'execution_id' => $execution->id,
        'study_id' => $otherStudy->id,
        'study_analysis_id' => $analysis->id,
        'result_type' => 'characterization',
        'summary_data' => ['count' => 50],
    ]);

    // Accessing via wrong study should return 404
    $this->actingAs($this->user)
        ->getJson("/api/v1/studies/{$this->study->slug}/results/{$result->id}")
        ->assertStatus(404);
});

// ── StudyActivityController ──────────────────────────────────────────────────

test('unauthenticated user cannot list study activity', function () {
    $this->getJson("/api/v1/studies/{$this->study->slug}/activity")
        ->assertStatus(401);
});

test('authenticated user can list study activity', function () {
    StudyActivityLog::create([
        'study_id' => $this->study->id,
        'user_id' => $this->user->id,
        'action' => 'status_changed',
        'entity_type' => 'study',
        'entity_id' => $this->study->id,
        'old_value' => ['status' => 'draft'],
        'new_value' => ['status' => 'design'],
        'occurred_at' => now(),
    ]);

    StudyActivityLog::create([
        'study_id' => $this->study->id,
        'user_id' => $this->user->id,
        'action' => 'cohort_added',
        'entity_type' => 'study_cohort',
        'entity_id' => 1,
        'occurred_at' => now()->subMinutes(5),
    ]);

    $this->actingAs($this->user)
        ->getJson("/api/v1/studies/{$this->study->slug}/activity")
        ->assertOk()
        ->assertJsonPath('data.0.action', 'status_changed')
        ->assertJsonCount(2, 'data');
});

test('activity log supports pagination', function () {
    // Create 30 activity entries
    for ($i = 0; $i < 30; $i++) {
        StudyActivityLog::create([
            'study_id' => $this->study->id,
            'user_id' => $this->user->id,
            'action' => "action_{$i}",
            'occurred_at' => now()->subMinutes($i),
        ]);
    }

    $response = $this->actingAs($this->user)
        ->getJson("/api/v1/studies/{$this->study->slug}/activity?per_page=10")
        ->assertOk();

    // Paginated response should have standard Laravel pagination keys
    $response->assertJsonStructure(['data', 'current_page', 'last_page', 'per_page', 'total']);
    expect($response->json('per_page'))->toBe(10);
    expect($response->json('total'))->toBe(30);
});

test('viewer role can still access study sub-resources (no permission middleware on sub-resources)', function () {
    $viewer = User::factory()->create();
    $viewer->assignRole('viewer');

    StudyCohort::create([
        'study_id' => $this->study->id,
        'cohort_definition_id' => $this->cohortDefinition->id,
        'role' => 'target',
        'label' => 'Test Cohort',
        'sort_order' => 0,
    ]);

    // Sub-resource routes currently have auth:sanctum only, no permission middleware
    $this->actingAs($viewer)
        ->getJson("/api/v1/studies/{$this->study->slug}/cohorts")
        ->assertOk();

    $this->actingAs($viewer)
        ->getJson("/api/v1/studies/{$this->study->slug}/activity")
        ->assertOk();
});
