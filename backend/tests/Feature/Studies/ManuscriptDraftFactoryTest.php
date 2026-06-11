<?php

use App\Enums\GateStatus;
use App\Models\App\EstimationAnalysis;
use App\Models\App\PublicationDraft;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyGate;
use App\Models\User;
use App\Services\Publication\ManuscriptDraftFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

if (! function_exists('manuscriptDraftStudy')) {
    function manuscriptDraftStudy(User $user): Study
    {
        $study = Study::create([
            'title' => 'HTN draft study',
            'created_by' => $user->id,
            'principal_investigator_id' => $user->id,
            'status' => 'running',
            'primary_objective' => 'Estimate outcomes in elevated-BP patients.',
        ]);
        $analysis = EstimationAnalysis::create(['name' => 'PLE', 'author_id' => $user->id, 'design_json' => []]);
        StudyAnalysis::create([
            'study_id' => $study->id,
            'analysis_type' => EstimationAnalysis::class,
            'analysis_id' => $analysis->id,
        ]);
        $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST']);
        $analysis->executions()->create([
            'source_id' => $source->id,
            'status' => 'completed',
            'result_json' => [
                'propensity_score' => ['auc' => 0.6, 'equipoise' => 0.9, 'max_smd_after' => 0.02],
                'estimates' => [['outcome_id' => 1, 'outcome_name' => 'MACE', 'hazard_ratio' => 1.4, 'ci_95_lower' => 1.1, 'ci_95_upper' => 1.8, 'p_value' => 0.01]],
                'calibration' => [
                    'status' => 'completed', 'informative_negative_controls' => 8, 'ease' => 0.02,
                    'calibrated_estimates' => [['outcome_id' => 1, 'outcome_name' => 'MACE', 'calibrated' => true, 'calibrated_hr' => 1.37, 'cal_ci_lower' => 1.05, 'cal_ci_upper' => 1.8, 'calibrated_p' => 0.02]],
                ],
            ],
        ]);
        StudyGate::create([
            'study_id' => $study->id, 'stage' => 'study_diagnostics', 'gate_key' => 'default',
            'status' => GateStatus::Passed->value, 'metrics_json' => ['reasons' => []], 'decision' => 'auto',
        ]);

        return $study->fresh();
    }
}

it('seeds a study-linked publication draft from the composed manuscript', function () {
    $user = User::factory()->create();
    $study = manuscriptDraftStudy($user);

    $draft = app(ManuscriptDraftFactory::class)->findOrCreate($study, $user->id);

    expect($draft->study_id)->toBe($study->id)
        ->and($draft->source)->toBe('study_manuscript')
        ->and($draft->visibility)->toBe('study')
        ->and($draft->document_json['version'])->toBe(1)
        ->and($draft->document_json['sections'])->not->toBeEmpty();

    $types = array_column($draft->document_json['sections'], 'type');
    expect($types)->toContain('results')->toContain('methods')->toContain('introduction');

    // Every persisted section type must be a valid publish DraftSection type.
    foreach ($types as $type) {
        expect($type)->toBeIn(['introduction', 'methods', 'results', 'discussion', 'diagram']);
    }
});

it('is idempotent: reuses the existing seeded draft instead of duplicating', function () {
    $user = User::factory()->create();
    $study = manuscriptDraftStudy($user);
    $factory = app(ManuscriptDraftFactory::class);

    $first = $factory->findOrCreate($study, $user->id);
    $second = $factory->findOrCreate($study, $user->id);

    expect($second->id)->toBe($first->id)
        ->and(PublicationDraft::where('study_id', $study->id)->count())->toBe(1);
});
