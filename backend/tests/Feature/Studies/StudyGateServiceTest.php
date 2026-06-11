<?php

use App\Enums\GateStage;
use App\Enums\GateStatus;
use App\Exceptions\GateBlockedException;
use App\Models\App\EstimationAnalysis;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\User;
use App\Services\Studies\Gates\StudyGateService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

if (! function_exists('abbyGateStudy')) {
    function abbyGateStudy(User $user): Study
    {
        return Study::create(['title' => 'Gate test study', 'created_by' => $user->id, 'status' => 'draft']);
    }
}

it('evaluates and persists a failed study-diagnostics gate with reasons', function () {
    config(['studies.gating_enabled' => true]);
    $user = User::factory()->create();
    $study = abbyGateStudy($user);

    $gate = app(StudyGateService::class)
        ->evaluate($study, GateStage::StudyDiagnostics, ['ps_auc' => 0.99, 'equipoise' => 0.01]);

    expect($gate->status)->toBe(GateStatus::Failed)
        ->and($gate->metrics_json['reasons'])->not->toBeEmpty();

    $this->assertDatabaseHas('study_gates', [
        'study_id' => $study->id,
        'stage' => 'study_diagnostics',
        'status' => 'failed',
    ]);
});

it('blocks work behind a failed gate and clears it on a justified override', function () {
    config(['studies.gating_enabled' => true]);
    $user = User::factory()->create();
    $study = abbyGateStudy($user);
    $svc = app(StudyGateService::class);

    $gate = $svc->evaluate($study, GateStage::StudyDiagnostics, ['ps_auc' => 0.99, 'equipoise' => 0.01]);

    expect($svc->mayProceed($study, GateStage::StudyDiagnostics))->toBeFalse();
    expect(fn () => $svc->assertMayRun($study, GateStage::StudyDiagnostics))
        ->toThrow(GateBlockedException::class);

    $svc->override($gate, $user, 'Known limitation: synthetic comparator; documented in the protocol limitations.');

    expect($svc->mayProceed($study, GateStage::StudyDiagnostics))->toBeTrue();
    $this->assertDatabaseHas('study_gates', [
        'id' => $gate->id,
        'status' => 'overridden',
        'decided_by' => $user->id,
    ]);
});

it('requires a non-empty rationale to override', function () {
    $user = User::factory()->create();
    $study = abbyGateStudy($user);
    $svc = app(StudyGateService::class);
    $gate = $svc->evaluate($study, GateStage::DataQuality, ['severe_failed_checks' => 2]);

    expect(fn () => $svc->override($gate, $user, '   '))->toThrow(InvalidArgumentException::class);
});

it('is inert when gating is disabled', function () {
    config(['studies.gating_enabled' => false]);
    $user = User::factory()->create();
    $study = abbyGateStudy($user);
    $svc = app(StudyGateService::class);

    $svc->evaluate($study, GateStage::StudyDiagnostics, ['ps_auc' => 0.99, 'equipoise' => 0.01]);

    expect($svc->mayProceed($study, GateStage::StudyDiagnostics))->toBeTrue();
});

it('evaluates S5 and S6 from a study-114-like estimation result', function () {
    config(['studies.gating_enabled' => true]);
    $user = User::factory()->create();
    $study = abbyGateStudy($user);

    $gates = app(StudyGateService::class)->evaluateEstimationGates($study, [
        'propensity_score' => ['auc' => 0.99, 'max_smd_after' => 0.45, 'equipoise' => 0.01],
        'calibration' => ['status' => 'insufficient_controls', 'informative_negative_controls' => 0],
    ]);

    expect($gates)->toHaveCount(2)
        ->and($gates[0]->status)->toBe(GateStatus::Failed)   // S5 separation
        ->and($gates[1]->status)->toBe(GateStatus::Failed);  // S6 insufficient controls
});

if (! function_exists('abbyGateContrast')) {
    function abbyGateContrast(Study $study, User $user, Source $source, string $name, float $smd): void
    {
        $analysis = EstimationAnalysis::create(['name' => $name, 'author_id' => $user->id, 'design_json' => []]);
        StudyAnalysis::create([
            'study_id' => $study->id,
            'analysis_type' => EstimationAnalysis::class,
            'analysis_id' => $analysis->id,
        ]);
        $analysis->executions()->create([
            'source_id' => $source->id,
            'status' => 'completed',
            'result_json' => [
                'propensity_score' => ['auc' => 0.6, 'equipoise' => 0.9, 'max_smd_after' => $smd],
                'calibration' => ['status' => 'completed', 'informative_negative_controls' => 8],
            ],
        ]);
    }
}

it('passes the study-diagnostics gate when one contrast clears, recording the blinded ones', function () {
    config(['studies.gating_enabled' => true]);
    $user = User::factory()->create();
    $study = abbyGateStudy($user);
    $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST']);

    abbyGateContrast($study, $user, $source, 'Normotensive comparator', 0.02); // clears
    abbyGateContrast($study, $user, $source, 'Delay-strata contrast', 0.30);    // unbalanceable

    $gates = app(StudyGateService::class)->evaluateStudyEstimationGates($study);
    $s5 = collect($gates)->firstWhere(fn ($g) => $g->stage->value === 'study_diagnostics');

    expect($gates)->toHaveCount(2)
        ->and($s5->status)->toBe(GateStatus::Passed)
        ->and($s5->metrics_json['contrasts_total'])->toBe(2)
        ->and($s5->metrics_json['contrasts_cleared'])->toBe(1)
        ->and($s5->metrics_json['cleared_contrast'])->toBe('Normotensive comparator')
        ->and($s5->metrics_json['blinded_contrasts'])->toBe(['Delay-strata contrast']);
});

it('fails the study-diagnostics gate only when no contrast clears', function () {
    config(['studies.gating_enabled' => true]);
    $user = User::factory()->create();
    $study = abbyGateStudy($user);
    $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST2']);

    abbyGateContrast($study, $user, $source, 'Unbalanceable A', 0.30);
    abbyGateContrast($study, $user, $source, 'Unbalanceable B', 0.45);

    $gates = app(StudyGateService::class)->evaluateStudyEstimationGates($study);
    $s5 = collect($gates)->firstWhere(fn ($g) => $g->stage->value === 'study_diagnostics');

    expect($s5->status)->toBe(GateStatus::Failed)
        ->and($s5->metrics_json['contrasts_cleared'])->toBe(0);
});

it('blinds estimation results for a gated study whose S5 gate has not cleared', function () {
    config(['studies.gating_enabled' => true]);
    $user = User::factory()->create();
    $study = abbyGateStudy($user);
    $svc = app(StudyGateService::class);

    $analysis = EstimationAnalysis::create(['name' => 'Est', 'author_id' => $user->id, 'design_json' => []]);
    StudyAnalysis::create([
        'study_id' => $study->id,
        'analysis_type' => EstimationAnalysis::class,
        'analysis_id' => $analysis->id,
    ]);
    $svc->evaluate($study, GateStage::StudyDiagnostics, ['ps_auc' => 0.99, 'equipoise' => 0.01]);

    $result = [
        'estimates' => [['outcome_id' => 1, 'hazard_ratio' => 1.6]],
        'propensity_score' => ['auc' => 0.99],
    ];
    $blinded = $svc->blindEstimationIfGated($result, EstimationAnalysis::class, $analysis->id);

    expect($blinded['blinded'])->toBeTrue()
        ->and($blinded['estimates'])->toBe([])
        ->and($blinded['propensity_score'])->toBe(['auc' => 0.99]); // diagnostics retained
});

it('does not blind when gating is disabled', function () {
    config(['studies.gating_enabled' => false]);
    $user = User::factory()->create();
    $analysis = EstimationAnalysis::create(['name' => 'Est', 'author_id' => $user->id, 'design_json' => []]);

    $result = ['estimates' => [['outcome_id' => 1, 'hazard_ratio' => 1.6]]];
    $out = app(StudyGateService::class)->blindEstimationIfGated($result, EstimationAnalysis::class, $analysis->id);

    expect($out)->toBe($result);
});
