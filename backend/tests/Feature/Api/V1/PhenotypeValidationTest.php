<?php

declare(strict_types=1);

use App\Enums\ExecutionStatus;
use App\Jobs\Analysis\RunPhenotypeValidationJob;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortPhenotypeAdjudication;
use App\Models\App\CohortPhenotypeAdjudicationReview;
use App\Models\App\CohortPhenotypePromotion;
use App\Models\App\CohortPhenotypeValidation;
use App\Models\App\Source;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function phenotypeValidationPayload(Source $source): array
{
    return [
        'source_id' => $source->id,
        'mode' => 'counts',
        'counts' => [
            'true_positives' => 80,
            'false_positives' => 20,
            'true_negatives' => 900,
            'false_negatives' => 40,
        ],
        'notes' => 'Reviewer adjudicated sample',
    ];
}

it('requires authentication to list phenotype validations', function () {
    $cohort = CohortDefinition::factory()->create();

    $this->getJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations")
        ->assertStatus(401);
});

it('lists phenotype validations for a cohort definition', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);
    CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Completed,
        'mode' => 'counts',
        'settings_json' => ['counts' => phenotypeValidationPayload($source)['counts']],
        'result_json' => ['status' => 'completed'],
        'started_at' => now(),
        'completed_at' => now(),
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations")
        ->assertStatus(200)
        ->assertJsonPath('data.0.status', ExecutionStatus::Completed->value)
        ->assertJsonPath('data.0.source.id', $source->id);
});

it('queues a phenotype validation from adjudicated counts', function () {
    Queue::fake();

    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $this->actingAs($user)
        ->postJson(
            "/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations",
            phenotypeValidationPayload($source),
        )
        ->assertStatus(202)
        ->assertJsonPath('data.status', ExecutionStatus::Queued->value)
        ->assertJsonPath('data.settings_json.counts.true_positives', 80)
        ->assertJsonPath('message', 'Phenotype validation queued.');

    $this->assertDatabaseHas('cohort_phenotype_validations', [
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Queued->value,
        'mode' => 'counts',
    ]);

    Queue::assertPushed(RunPhenotypeValidationJob::class);
});

it('creates a native adjudication review session without queueing metrics', function () {
    Queue::fake();

    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations", [
            'source_id' => $source->id,
            'mode' => 'adjudication',
            'notes' => 'Native review',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', ExecutionStatus::Pending->value)
        ->assertJsonPath('data.mode', 'adjudication')
        ->assertJsonPath('data.settings_json.review_state', 'draft')
        ->assertJsonPath('message', 'Phenotype review session created.');

    $this->assertDatabaseHas('cohort_phenotype_validations', [
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'status' => ExecutionStatus::Pending->value,
        'mode' => 'adjudication',
    ]);

    Queue::assertNotPushed(RunPhenotypeValidationJob::class);
});

it('requires complete adjudication before completing a review session', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Pending,
        'mode' => 'adjudication',
        'settings_json' => ['review_state' => 'in_review'],
    ]);
    CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 123,
        'sample_group' => 'cohort_member',
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/review-state", [
            'review_state' => 'completed',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['review_state']);
});

it('locks completed reviews and blocks further adjudication edits', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Pending,
        'mode' => 'adjudication',
        'settings_json' => ['review_state' => 'completed'],
    ]);
    $adjudication = CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 123,
        'sample_group' => 'cohort_member',
        'label' => 'case',
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/review-state", [
            'review_state' => 'locked',
        ])
        ->assertStatus(200)
        ->assertJsonPath('data.settings_json.review_state', 'locked');

    $this->actingAs($user)
        ->patchJson(
            "/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/adjudications/{$adjudication->id}",
            ['label' => 'non_case'],
        )
        ->assertStatus(422)
        ->assertJsonValidationErrors(['review_state']);
});

it('blocks metric computation when sampled adjudications are incomplete unless explicitly allowed', function () {
    Queue::fake();

    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Pending,
        'mode' => 'adjudication',
        'settings_json' => ['review_state' => 'in_review'],
    ]);
    CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 101,
        'sample_group' => 'cohort_member',
        'label' => 'case',
    ]);
    CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 102,
        'sample_group' => 'cohort_member',
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/compute")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['adjudications']);

    $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/compute", [
            'allow_partial' => true,
        ])
        ->assertStatus(202)
        ->assertJsonPath('data.status', ExecutionStatus::Queued->value)
        ->assertJsonPath('counts.unreviewed', 1);

    Queue::assertPushed(RunPhenotypeValidationJob::class);
});

it('exports review evidence with counts, sampling metadata, and audit history', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Pending,
        'mode' => 'adjudication',
        'settings_json' => ['review_state' => 'in_review'],
    ]);
    CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 101,
        'sample_group' => 'cohort_member',
        'label' => 'case',
        'sampling_json' => [
            'seed' => 'review-seed',
            'strategy' => 'balanced_demographics',
            'stratum' => 'female|age_60_69',
        ],
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/evidence-export")
        ->assertStatus(200)
        ->assertJsonPath('data.review_state', 'in_review')
        ->assertJsonPath('data.counts.true_positives', 1)
        ->assertJsonPath('data.adjudications.0.sampling_json.seed', 'review-seed')
        ->assertJsonPath('data.adjudications.0.sampling_json.strategy', 'balanced_demographics');
});

it('validates phenotype validation count payloads', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);

    $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations", [
            'source_id' => $source->id,
            'mode' => 'counts',
            'counts' => [
                'true_positives' => 0,
                'false_positives' => 0,
                'true_negatives' => 0,
                'false_negatives' => 0,
            ],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['counts']);
});

it('shows a phenotype validation only under its cohort definition', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);
    $otherCohort = CohortDefinition::factory()->create(['author_id' => $user->id]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Completed,
        'mode' => 'counts',
        'settings_json' => ['counts' => phenotypeValidationPayload($source)['counts']],
        'result_json' => [
            'status' => 'completed',
            'metrics' => [
                'positive_predictive_value' => ['estimate' => 0.8],
            ],
        ],
        'started_at' => now(),
        'completed_at' => now(),
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.result_json.metrics.positive_predictive_value.estimate', 0.8);

    $this->actingAs($user)
        ->getJson("/api/v1/cohort-definitions/{$otherCohort->id}/phenotype-validations/{$validation->id}")
        ->assertStatus(404);
});

it('updates adjudication labels and returns current counts', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Pending,
        'mode' => 'adjudication',
    ]);
    $adjudication = CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 123,
        'sample_group' => 'cohort_member',
    ]);

    $this->actingAs($user)
        ->patchJson(
            "/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/adjudications/{$adjudication->id}",
            [
                'label' => 'case',
                'notes' => 'Confirmed in chart',
            ],
        )
        ->assertStatus(200)
        ->assertJsonPath('data.label', 'case')
        ->assertJsonPath('data.reviewer.id', $user->id)
        ->assertJsonPath('counts.true_positives', 1);

    $this->assertDatabaseHas('cohort_phenotype_adjudications', [
        'id' => $adjudication->id,
        'label' => 'case',
        'reviewer_id' => $user->id,
    ]);
    $this->assertDatabaseHas('cohort_phenotype_adjudication_reviews', [
        'adjudication_id' => $adjudication->id,
        'reviewer_id' => $user->id,
        'label' => 'case',
    ]);

    $this->assertDatabaseHas('cohort_phenotype_adjudication_events', [
        'phenotype_validation_id' => $validation->id,
        'adjudication_id' => $adjudication->id,
        'actor_id' => $user->id,
        'event_type' => 'review_update',
    ]);
});

it('detects reviewer conflicts and exposes agreement quality summary', function () {
    $reviewerA = User::factory()->create();
    $reviewerA->assignRole('researcher');
    $reviewerB = User::factory()->create();
    $reviewerB->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $reviewerA->id]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $reviewerA->id,
        'status' => ExecutionStatus::Pending,
        'mode' => 'adjudication',
        'settings_json' => ['review_state' => 'in_review'],
    ]);
    $adjudication = CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 123,
        'sample_group' => 'cohort_member',
    ]);

    $this->actingAs($reviewerA)
        ->patchJson(
            "/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/adjudications/{$adjudication->id}",
            ['label' => 'case'],
        )
        ->assertStatus(200)
        ->assertJsonPath('data.label', 'case');

    $this->actingAs($reviewerB)
        ->patchJson(
            "/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/adjudications/{$adjudication->id}",
            ['label' => 'non_case'],
        )
        ->assertStatus(200)
        ->assertJsonPath('data.label', null)
        ->assertJsonPath('agreement.unresolved_conflict_adjudications', 1);

    $this->actingAs($reviewerA)
        ->getJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/quality-summary")
        ->assertStatus(200)
        ->assertJsonPath('data.agreement.review_records', 2)
        ->assertJsonPath('data.agreement.double_reviewed_adjudications', 1)
        ->assertJsonPath('data.agreement.conflict_adjudications', 1)
        ->assertJsonPath('data.agreement.ready_for_promotion', false);
});

it('resolves reviewer conflicts before computing final metrics', function () {
    Queue::fake();

    $reviewerA = User::factory()->create();
    $reviewerA->assignRole('researcher');
    $reviewerB = User::factory()->create();
    $reviewerB->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $reviewerA->id]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $reviewerA->id,
        'status' => ExecutionStatus::Pending,
        'mode' => 'adjudication',
        'settings_json' => ['review_state' => 'in_review'],
    ]);
    $adjudication = CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 123,
        'sample_group' => 'cohort_member',
    ]);
    CohortPhenotypeAdjudicationReview::create([
        'phenotype_validation_id' => $validation->id,
        'adjudication_id' => $adjudication->id,
        'reviewer_id' => $reviewerA->id,
        'label' => 'case',
        'reviewed_at' => now(),
    ]);
    CohortPhenotypeAdjudicationReview::create([
        'phenotype_validation_id' => $validation->id,
        'adjudication_id' => $adjudication->id,
        'reviewer_id' => $reviewerB->id,
        'label' => 'non_case',
        'reviewed_at' => now(),
    ]);

    $this->actingAs($reviewerA)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/compute", [
            'allow_partial' => true,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['adjudications']);

    $this->actingAs($reviewerA)
        ->postJson(
            "/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/adjudications/{$adjudication->id}/resolve",
            ['label' => 'case', 'notes' => 'Lead reviewer resolved after chart review.'],
        )
        ->assertStatus(200)
        ->assertJsonPath('data.label', 'case')
        ->assertJsonPath('agreement.resolved_conflict_adjudications', 1)
        ->assertJsonPath('agreement.unresolved_conflict_adjudications', 0);

    $this->actingAs($reviewerA)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/compute")
        ->assertStatus(202)
        ->assertJsonPath('counts.true_positives', 1)
        ->assertJsonPath('agreement.ready_for_promotion', true);

    Queue::assertPushed(RunPhenotypeValidationJob::class);
});

it('blocks direct cohort validation tier updates without phenotype promotion evidence', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $cohort = CohortDefinition::factory()->create([
        'author_id' => $user->id,
        'quality_tier' => 'draft',
    ]);

    $this->actingAs($user)
        ->putJson("/api/v1/cohort-definitions/{$cohort->id}", [
            'quality_tier' => 'validated',
        ])
        ->assertStatus(200);

    expect($cohort->fresh()->quality_tier)->not->toBe('validated');
    $this->assertDatabaseMissing('cohort_phenotype_promotions', [
        'cohort_definition_id' => $cohort->id,
    ]);
});

it('promotes a cohort to validated only from ready phenotype review evidence', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create([
        'author_id' => $user->id,
        'quality_tier' => 'draft',
    ]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Completed,
        'mode' => 'adjudication',
        'settings_json' => [
            'review_state' => 'completed',
            'counts' => [
                'true_positives' => 1,
                'false_positives' => 0,
                'true_negatives' => 0,
                'false_negatives' => 0,
            ],
        ],
        'result_json' => [
            'status' => 'completed',
            'metrics' => [
                'positive_predictive_value' => ['estimate' => 1.0],
            ],
        ],
        'completed_at' => now(),
    ]);
    $adjudication = CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 123,
        'sample_group' => 'cohort_member',
        'label' => 'case',
        'reviewer_id' => $user->id,
        'reviewed_at' => now(),
    ]);
    CohortPhenotypeAdjudicationReview::create([
        'phenotype_validation_id' => $validation->id,
        'adjudication_id' => $adjudication->id,
        'reviewer_id' => $user->id,
        'label' => 'case',
        'reviewed_at' => now(),
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/promote", [
            'approval_notes' => 'Ready for validated release.',
        ])
        ->assertStatus(200)
        ->assertJsonPath('data.promoted_quality_tier', 'validated')
        ->assertJsonPath('data.quality_summary_json.agreement.ready_for_promotion', true)
        ->assertJsonPath('cohort_definition.quality_tier', 'validated');

    expect($cohort->fresh()->quality_tier)->toBe('validated');
    $this->assertDatabaseHas('cohort_phenotype_promotions', [
        'cohort_definition_id' => $cohort->id,
        'phenotype_validation_id' => $validation->id,
        'approver_id' => $user->id,
        'promoted_quality_tier' => 'validated',
    ]);
});

it('rejects promotion until review quality and PheValuator metrics are complete', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create([
        'author_id' => $user->id,
        'quality_tier' => 'draft',
    ]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Pending,
        'mode' => 'adjudication',
        'settings_json' => ['review_state' => 'in_review'],
    ]);
    CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 123,
        'sample_group' => 'cohort_member',
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/promote")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['review_state']);

    expect($cohort->fresh()->quality_tier)->toBe('draft');
    expect(CohortPhenotypePromotion::query()->where('cohort_definition_id', $cohort->id)->exists())->toBeFalse();
});

it('queues phenotype validation metrics from reviewed adjudications', function () {
    Queue::fake();

    $user = User::factory()->create();
    $user->assignRole('researcher');

    $source = Source::factory()->create();
    $cohort = CohortDefinition::factory()->create(['author_id' => $user->id]);
    $validation = CohortPhenotypeValidation::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'author_id' => $user->id,
        'status' => ExecutionStatus::Pending,
        'mode' => 'adjudication',
    ]);

    CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 101,
        'sample_group' => 'cohort_member',
        'label' => 'case',
    ]);
    CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 102,
        'sample_group' => 'cohort_member',
        'label' => 'non_case',
    ]);
    CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 201,
        'sample_group' => 'non_member',
        'label' => 'non_case',
    ]);
    CohortPhenotypeAdjudication::create([
        'phenotype_validation_id' => $validation->id,
        'person_id' => 202,
        'sample_group' => 'non_member',
        'label' => 'case',
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/cohort-definitions/{$cohort->id}/phenotype-validations/{$validation->id}/compute")
        ->assertStatus(202)
        ->assertJsonPath('data.status', ExecutionStatus::Queued->value)
        ->assertJsonPath('counts.true_positives', 1)
        ->assertJsonPath('counts.false_positives', 1)
        ->assertJsonPath('counts.true_negatives', 1)
        ->assertJsonPath('counts.false_negatives', 1)
        ->assertJsonPath('message', 'Phenotype validation queued from adjudications.');

    $this->assertDatabaseHas('cohort_phenotype_validations', [
        'id' => $validation->id,
        'status' => ExecutionStatus::Queued->value,
    ]);

    expect($validation->fresh()->settings_json['counts'])->toMatchArray([
        'true_positives' => 1,
        'false_positives' => 1,
        'true_negatives' => 1,
        'false_negatives' => 1,
    ]);

    Queue::assertPushed(RunPhenotypeValidationJob::class);
});
