<?php

use App\Enums\GateStatus;
use App\Models\App\EstimationAnalysis;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyGate;
use App\Models\App\StudySynthesis;
use App\Models\User;
use App\Services\Publication\ManuscriptComposer;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

if (! function_exists('abbyManuscriptStudy')) {
    function abbyManuscriptStudy(User $user, string $gateStatus): Study
    {
        $study = Study::create([
            'title' => 'Hypertension MACE study',
            'created_by' => $user->id,
            'principal_investigator_id' => $user->id,
            'status' => 'draft',
            'primary_objective' => 'Estimate MACE risk in treated hypertension.',
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
                'propensity_score' => ['auc' => 0.7, 'equipoise' => 0.5, 'max_smd_after' => 0.05],
                'estimates' => [[
                    'outcome_id' => 1, 'outcome_name' => 'MACE',
                    'hazard_ratio' => 1.6, 'ci_95_lower' => 1.3, 'ci_95_upper' => 2.0, 'p_value' => 0.001,
                ]],
                'calibration' => [
                    'status' => 'completed',
                    'informative_negative_controls' => 8,
                    'ease' => 0.14,
                    'calibrated_estimates' => [[
                        'outcome_id' => 1, 'outcome_name' => 'MACE', 'calibrated' => true,
                        'calibrated_hr' => 1.47, 'cal_ci_lower' => 1.06, 'cal_ci_upper' => 2.04, 'calibrated_p' => 0.02,
                    ]],
                ],
            ],
        ]);

        StudyGate::create([
            'study_id' => $study->id,
            'stage' => 'study_diagnostics',
            'gate_key' => 'default',
            'status' => $gateStatus,
            'metrics_json' => ['reasons' => ['Max post-adjustment SMD 0.312 exceeds 0.10.']],
            'decision' => 'human',
            'override_rationale' => $gateStatus === GateStatus::Overridden->value
                ? 'Active comparator unavailable in this CDM; documented limitation.'
                : null,
        ]);

        return $study->fresh();
    }
}

it('composes a gate-aware manuscript with calibrated results and an override limitation', function () {
    $user = User::factory()->create();
    $study = abbyManuscriptStudy($user, GateStatus::Overridden->value);

    $doc = app(ManuscriptComposer::class)->compose($study);
    $byKey = collect($doc['sections'])->keyBy('key');

    expect($doc['title'])->toBe('Hypertension MACE study')
        ->and($doc['template'])->toBe('strobe-record')
        ->and($doc['manuscript_meta']['effect_estimates_included'])->toBeTrue()
        ->and($byKey['results']['content'])->toContain('calibrated HR 1.47')
        ->and($byKey['results']['content'])->toContain('EASE 0.14')
        ->and($byKey['limitations']['content'])->toContain('Active comparator unavailable')
        ->and($byKey['provenance']['content'])->toContain('study_diagnostics=overridden');
});

it('withholds effect estimates when the study-diagnostics gate has not cleared', function () {
    $user = User::factory()->create();
    $study = abbyManuscriptStudy($user, GateStatus::Failed->value);

    $doc = app(ManuscriptComposer::class)->compose($study);
    $results = collect($doc['sections'])->firstWhere('key', 'results')['content'];

    expect($results)->toContain('withheld')
        ->and($results)->not->toContain('1.47')
        ->and($doc['manuscript_meta']['effect_estimates_included'])->toBeFalse();
});

it('emits descriptive subsections and reports each contrast by its own diagnostics', function () {
    $user = User::factory()->create();
    $study = Study::create([
        'title' => 'Hypertension under-diagnosis study',
        'created_by' => $user->id,
        'principal_investigator_id' => $user->id,
        'status' => 'draft',
        'primary_objective' => 'Quantify under-diagnosis and its outcome consequences.',
    ]);
    $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST']);

    // Descriptive synthesis (prevalence + latency) the composer should surface.
    StudySynthesis::create([
        'study_id' => $study->id,
        'synthesis_type' => 'descriptive_summary',
        'input_result_ids' => [],
        'method_settings' => [],
        'generated_by' => $user->id,
        'output' => [
            'prevalence' => ['target_total' => 1000, 'ever_diagnosed' => 100, 'never_diagnosed' => 900, 'never_dx_pct' => 90.0],
            'delay_strata' => ['G1_timely_le90d' => 10, 'G2_91_180d' => 20, 'G3_181_365d' => 30, 'G4_delayed_gt365d' => 40, 'never_diagnosed' => 900],
            'latency_second_elevated_to_diagnosis_days' => ['n' => 100, 'median' => 1106, 'q1' => 704, 'q3' => 1862],
        ],
    ]);

    // A passing study-diagnostics gate — so blinding defers to each contrast.
    StudyGate::create([
        'study_id' => $study->id, 'stage' => 'study_diagnostics', 'gate_key' => 'default',
        'status' => GateStatus::Passed->value, 'metrics_json' => ['reasons' => []], 'decision' => 'auto',
    ]);

    $mkEstimation = function (string $name, float $smd, User $user, Study $study, Source $source): void {
        $analysis = EstimationAnalysis::create(['name' => $name, 'author_id' => $user->id, 'design_json' => []]);
        StudyAnalysis::create(['study_id' => $study->id, 'analysis_type' => EstimationAnalysis::class, 'analysis_id' => $analysis->id]);
        $analysis->executions()->create([
            'source_id' => $source->id,
            'status' => 'completed',
            'result_json' => [
                'propensity_score' => ['auc' => 0.6, 'equipoise' => 0.9, 'max_smd_after' => $smd],
                'estimates' => [['outcome_id' => 1, 'outcome_name' => 'CKD', 'hazard_ratio' => 2.6, 'ci_95_lower' => 2.0, 'ci_95_upper' => 3.4, 'p_value' => 0.0]],
                'calibration' => [
                    'status' => 'completed', 'informative_negative_controls' => 8, 'ease' => 0.02,
                    'calibrated_estimates' => [['outcome_id' => 1, 'outcome_name' => 'CKD', 'calibrated' => true, 'calibrated_hr' => 2.6, 'cal_ci_lower' => 2.0, 'cal_ci_upper' => 3.4, 'calibrated_p' => 0.0]],
                ],
            ],
        ]);
    };
    $mkEstimation('Recording-comparable contrast', 0.02, $user, $study, $source); // balanced → reported
    $mkEstimation('Within-HTN delay contrast', 0.30, $user, $study, $source);     // unbalanceable → blinded

    $doc = app(ManuscriptComposer::class)->compose($study->fresh());
    $results = collect($doc['sections'])->firstWhere('key', 'results')['content'];

    expect($results)->toContain('### Prevalence of under-diagnosis')
        ->and($results)->toContain('900 (90%)')
        ->and($results)->toContain('### Diagnostic latency')
        ->and($results)->toContain('median of 1,106 days')
        ->and($results)->toContain('### Outcome consequences')
        ->and($results)->toContain('Recording-comparable contrast')
        ->and($results)->toContain('calibrated HR 2.6')   // balanced contrast reported
        ->and($results)->toContain('withheld')             // unbalanceable contrast blinded
        ->and($doc['manuscript_meta']['estimation_contrasts'])->toBe(2)
        ->and($doc['manuscript_meta']['effect_estimates_included'])->toBeTrue();
});

it('reports diagnostics-only when no estimation has completed', function () {
    $user = User::factory()->create();
    $study = Study::create(['title' => 'Empty study', 'created_by' => $user->id, 'status' => 'draft']);

    $doc = app(ManuscriptComposer::class)->compose($study);
    $results = collect($doc['sections'])->firstWhere('key', 'results')['content'];

    expect($results)->toContain('No population-level estimation')
        ->and($doc['manuscript_meta']['effect_estimates_included'])->toBeFalse();
});
