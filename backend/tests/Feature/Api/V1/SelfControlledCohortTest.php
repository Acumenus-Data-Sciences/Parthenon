<?php

declare(strict_types=1);

use App\Enums\ExecutionStatus;
use App\Jobs\Analysis\RunSelfControlledCohortJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\SelfControlledCohortAnalysis;
use App\Models\App\Source;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function selfControlledCohortPayload(): array
{
    return [
        'name' => 'Drug exposure and acute outcome SCC',
        'description' => 'SelfControlledCohort package analysis',
        'design_json' => [
            'exposureCohortId' => 223,
            'outcomeCohortId' => 225,
            'exposedWindow' => [
                'start' => 1,
                'end' => 30,
                'addLengthOfExposure' => true,
            ],
            'unexposedWindow' => [
                'start' => -30,
                'end' => -1,
                'addLengthOfExposure' => true,
            ],
            'studyPopulation' => [
                'naivePeriod' => 0,
                'firstOutcomeOnly' => true,
            ],
            'firstExposureOnly' => true,
            'hasFullTimeAtRisk' => false,
            'washoutPeriod' => 0,
            'followupPeriod' => 0,
            'computeTarDistribution' => false,
        ],
    ];
}

it('requires authentication to list self-controlled cohort analyses', function () {
    $this->getJson('/api/v1/self-controlled-cohorts')
        ->assertStatus(401);
});

it('allows viewer access to list self-controlled cohort analyses', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->getJson('/api/v1/self-controlled-cohorts')
        ->assertStatus(200);
});

it('creates a self-controlled cohort analysis with valid data', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user)
        ->postJson('/api/v1/self-controlled-cohorts', selfControlledCohortPayload())
        ->assertStatus(201);

    $response->assertJsonPath('data.name', 'Drug exposure and acute outcome SCC');
    $response->assertJsonPath('data.design_json.exposureCohortId', 223);
    $response->assertJsonPath('message', 'Self-Controlled Cohort analysis created.');

    $this->assertDatabaseHas('self_controlled_cohort_analyses', [
        'name' => 'Drug exposure and acute outcome SCC',
        'author_id' => $user->id,
    ]);
});

it('validates required self-controlled cohort fields', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->postJson('/api/v1/self-controlled-cohorts', [
            'name' => 'Invalid SCC',
            'design_json' => [
                'exposureCohortId' => 223,
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('design_json.outcomeCohortId');
});

it('shows a self-controlled cohort analysis with executions', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $analysis = SelfControlledCohortAnalysis::create([
        ...selfControlledCohortPayload(),
        'author_id' => $user->id,
    ]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/self-controlled-cohorts/{$analysis->id}")
        ->assertStatus(200);

    $response->assertJsonPath('data.id', $analysis->id);
    $response->assertJsonStructure(['data' => ['id', 'name', 'design_json', 'author', 'executions']]);
});

it('queues a self-controlled cohort execution', function () {
    Queue::fake();

    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $analysis = SelfControlledCohortAnalysis::create([
        ...selfControlledCohortPayload(),
        'author_id' => $user->id,
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/self-controlled-cohorts/{$analysis->id}/execute", [
            'source_id' => $source->id,
        ])
        ->assertStatus(202)
        ->assertJsonPath('data.status', ExecutionStatus::Queued->value)
        ->assertJsonPath('message', 'Self-Controlled Cohort execution queued.');

    $this->assertDatabaseHas('analysis_executions', [
        'analysis_type' => SelfControlledCohortAnalysis::class,
        'analysis_id' => $analysis->id,
        'source_id' => $source->id,
        'status' => ExecutionStatus::Queued->value,
    ]);

    Queue::assertPushed(RunSelfControlledCohortJob::class);
});

it('normalizes self-controlled cohort execution results', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $analysis = SelfControlledCohortAnalysis::create([
        ...selfControlledCohortPayload(),
        'author_id' => $user->id,
    ]);
    $execution = AnalysisExecution::factory()->completed()->create([
        'analysis_type' => SelfControlledCohortAnalysis::class,
        'analysis_id' => $analysis->id,
        'source_id' => $source->id,
        'status' => ExecutionStatus::Completed,
        'result_json' => [
            'status' => 'completed',
            'summary' => ['cases' => '10', 'outcomes' => '4'],
            'estimates' => [
                [
                    'name' => 'Exposure 223 / Outcome 225',
                    'irr' => '1.25',
                    'ci_lower' => '0.50',
                    'ci_upper' => '2.25',
                ],
            ],
        ],
    ]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/self-controlled-cohorts/{$analysis->id}/executions/{$execution->id}")
        ->assertStatus(200);

    $response->assertJsonPath('data.result_json.population.cases', 10);
    $response->assertJsonPath('data.result_json.population.outcomes', 4);
    $response->assertJsonPath('data.result_json.estimates.0.covariate', 'Exposure 223 / Outcome 225');
});
