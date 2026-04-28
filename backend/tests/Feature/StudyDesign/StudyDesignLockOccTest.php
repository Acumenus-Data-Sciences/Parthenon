<?php

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortGeneration;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Models\App\SourceRelease;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignVersion;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

/**
 * Optimistic Concurrency Control coverage for the design version lock endpoint.
 *
 * Quick task 260428-gu8 — backend OCC plumbing.
 *
 * The endpoint accepts an OPTIONAL `if_unmodified_since` ISO8601 precondition.
 * Future hardening can flip this to required; for now we preserve back-compat.
 */
beforeEach(function () {
    DB::statement('CREATE SCHEMA IF NOT EXISTS vocab');
    DB::statement('CREATE TABLE IF NOT EXISTS vocab.concept (
        concept_id INTEGER PRIMARY KEY,
        concept_name VARCHAR(255),
        domain_id VARCHAR(20),
        vocabulary_id VARCHAR(20),
        concept_class_id VARCHAR(20),
        standard_concept CHAR(1),
        concept_code VARCHAR(50),
        valid_start_date DATE,
        valid_end_date DATE,
        invalid_reason VARCHAR(1)
    )');
    DB::statement('TRUNCATE TABLE vocab.concept');

    $this->seed(RolePermissionSeeder::class);

    $this->user = User::factory()->create();
    $this->user->assignRole('researcher');

    $this->study = Study::factory()->create([
        'title' => 'OCC Lock Test',
        'description' => 'A study to validate lock OCC handling.',
        'primary_objective' => 'Validate lock precondition handling.',
        'study_type' => 'characterization',
        'created_by' => $this->user->id,
    ]);
});

/**
 * Build a fully ready, accepted design version for the lock endpoint.
 *
 * Mirrors the "ready imported design" setup in StudyDesignTest::it('locks a ready ...')
 * but stops one step earlier — it returns the unlocked, ready-to-lock version.
 *
 * @return array{0: int, 1: int, 2: StudyDesignVersion}
 */
function createReadyToLockDesignVersion(object $test): array
{
    Storage::fake('local');

    $cohort = CohortDefinition::create([
        'name' => 'Ready Target Cohort (OCC)',
        'description' => 'A ready target cohort.',
        'expression_json' => ['ConceptSets' => [1]],
        'author_id' => $test->user->id,
        'is_public' => false,
    ]);
    StudyCohort::create([
        'study_id' => $test->study->id,
        'cohort_definition_id' => $cohort->id,
        'role' => 'target',
        'label' => 'Target cohort',
        'sort_order' => 0,
    ]);

    $source = createOccFeasibilitySource([$cohort->id]);

    $analysis = Characterization::create([
        'name' => 'Ready Characterization (OCC)',
        'description' => 'Ready analysis.',
        'design_json' => ['source' => 'test'],
        'author_id' => $test->user->id,
    ]);
    StudyAnalysis::create([
        'study_id' => $test->study->id,
        'analysis_type' => Characterization::class,
        'analysis_id' => $analysis->id,
    ]);

    $sessionId = $test->actingAs($test->user)
        ->postJson("/api/v1/studies/{$test->study->slug}/design-sessions")
        ->assertCreated()
        ->json('data.id');

    $versionId = $test->actingAs($test->user)
        ->postJson("/api/v1/studies/{$test->study->slug}/design-sessions/{$sessionId}/import-existing")
        ->assertCreated()
        ->json('data.id');

    $test->actingAs($test->user)
        ->postJson("/api/v1/studies/{$test->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run", [
            'source_ids' => [$source->id],
        ])
        ->assertCreated()
        ->assertJsonPath('data.verification_status', 'verified');

    $test->actingAs($test->user)
        ->postJson("/api/v1/studies/{$test->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/accept")
        ->assertOk()
        ->assertJsonPath('data.status', 'accepted');

    /** @var StudyDesignVersion $version */
    $version = StudyDesignVersion::query()->findOrFail($versionId);

    return [$sessionId, $versionId, $version];
}

/**
 * @param  list<int>  $completedCohortDefinitionIds
 */
function createOccFeasibilitySource(array $completedCohortDefinitionIds = []): Source
{
    DB::statement('CREATE SCHEMA IF NOT EXISTS cdm');
    DB::statement('CREATE TABLE IF NOT EXISTS cdm.person (person_id INTEGER PRIMARY KEY)');
    DB::statement('CREATE TABLE IF NOT EXISTS cdm.observation_period (
        observation_period_id INTEGER PRIMARY KEY,
        person_id INTEGER NOT NULL,
        observation_period_start_date DATE NOT NULL,
        observation_period_end_date DATE NOT NULL
    )');
    foreach ([
        'condition_occurrence',
        'drug_exposure',
        'procedure_occurrence',
        'measurement',
        'observation',
        'visit_occurrence',
        'death',
    ] as $tableName) {
        DB::statement("CREATE TABLE IF NOT EXISTS cdm.{$tableName} (id INTEGER PRIMARY KEY)");
    }
    DB::statement('TRUNCATE TABLE cdm.death, cdm.visit_occurrence, cdm.observation, cdm.measurement, cdm.procedure_occurrence, cdm.drug_exposure, cdm.condition_occurrence, cdm.observation_period, cdm.person');
    DB::table('cdm.person')->insert([['person_id' => 1], ['person_id' => 2], ['person_id' => 3], ['person_id' => 4], ['person_id' => 5]]);
    DB::table('cdm.observation_period')->insert([
        ['observation_period_id' => 1, 'person_id' => 1, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2020-12-31'],
        ['observation_period_id' => 2, 'person_id' => 2, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2020-12-31'],
        ['observation_period_id' => 3, 'person_id' => 3, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2020-12-31'],
        ['observation_period_id' => 4, 'person_id' => 4, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2020-12-31'],
        ['observation_period_id' => 5, 'person_id' => 5, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2020-12-31'],
    ]);

    $source = Source::factory()->create([
        'source_connection' => 'pgsql',
    ]);

    SourceDaimon::create([
        'source_id' => $source->id,
        'daimon_type' => DaimonType::CDM->value,
        'table_qualifier' => 'cdm',
        'priority' => 1,
    ]);
    SourceRelease::factory()->create([
        'source_id' => $source->id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    foreach ($completedCohortDefinitionIds as $cohortDefinitionId) {
        CohortGeneration::create([
            'cohort_definition_id' => $cohortDefinitionId,
            'source_id' => $source->id,
            'status' => ExecutionStatus::Completed->value,
            'started_at' => now()->subMinutes(3),
            'completed_at' => now(),
            'person_count' => 50,
        ]);
    }

    return $source;
}

it('locks when if_unmodified_since matches the current updated_at (200)', function () {
    [$sessionId, $versionId, $version] = createReadyToLockDesignVersion($this);

    $precondition = $version->updated_at->toIso8601String();

    $this->actingAs($this->user)
        ->postJson(
            "/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/lock",
            ['if_unmodified_since' => $precondition],
        )
        ->assertOk()
        ->assertJsonPath('data.status', 'locked');

    expect(StudyDesignVersion::query()->find($versionId)->status)->toBe('locked');
});

it('returns 409 when if_unmodified_since is stale and leaves version unlocked', function () {
    [$sessionId, $versionId] = createReadyToLockDesignVersion($this);

    $stale = '2020-01-01T00:00:00Z';

    $response = $this->actingAs($this->user)
        ->postJson(
            "/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/lock",
            ['if_unmodified_since' => $stale],
        );

    $response->assertStatus(409)
        ->assertJsonPath('message', 'Study design version was modified since you loaded it.');

    expect($response->json('current_updated_at'))
        ->toBeString()
        ->not->toBeEmpty();

    expect(StudyDesignVersion::query()->find($versionId)->status)
        ->not->toBe('locked');
});

it('locks with no body (legacy back-compat path)', function () {
    [$sessionId, $versionId] = createReadyToLockDesignVersion($this);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/lock")
        ->assertOk()
        ->assertJsonPath('data.status', 'locked');
});

it('returns 422 with validation error when if_unmodified_since is malformed', function () {
    [$sessionId, $versionId] = createReadyToLockDesignVersion($this);

    $this->actingAs($this->user)
        ->postJson(
            "/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/lock",
            ['if_unmodified_since' => 'not-a-date'],
        )
        ->assertStatus(422)
        ->assertJsonValidationErrors(['if_unmodified_since']);

    expect(StudyDesignVersion::query()->find($versionId)->status)
        ->not->toBe('locked');
});

it('returns 422 with the readiness payload when the design is not ready (regression)', function () {
    // Build an UNready session — skip feasibility + accept.
    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Not-ready session',
        ])
        ->assertCreated()
        ->json('data.id');

    $versionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/intent", [
            'research_question' => 'Among adults with diabetes, does treatment improve outcomes?',
        ])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/lock")
        ->assertStatus(422)
        ->assertJsonPath('message', 'Design package is not ready to lock.');
});
