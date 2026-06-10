<?php

use App\Enums\GateStage;
use App\Enums\GateStatus;
use App\Exceptions\GateBlockedException;
use App\Models\App\EstimationAnalysis;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\User;
use App\Services\Studies\Gates\StudyGateService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

if (! function_exists('clioGateStudy')) {
    function clioGateStudy(User $user): Study
    {
        return Study::create(['title' => 'Gate test study', 'created_by' => $user->id, 'status' => 'draft']);
    }
}

it('evaluates and persists a failed study-diagnostics gate with reasons', function () {
    config(['studies.gating_enabled' => true]);
    $user = User::factory()->create();
    $study = clioGateStudy($user);

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
    $study = clioGateStudy($user);
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
    $study = clioGateStudy($user);
    $svc = app(StudyGateService::class);
    $gate = $svc->evaluate($study, GateStage::DataQuality, ['severe_failed_checks' => 2]);

    expect(fn () => $svc->override($gate, $user, '   '))->toThrow(InvalidArgumentException::class);
});

it('is inert when gating is disabled', function () {
    config(['studies.gating_enabled' => false]);
    $user = User::factory()->create();
    $study = clioGateStudy($user);
    $svc = app(StudyGateService::class);

    $svc->evaluate($study, GateStage::StudyDiagnostics, ['ps_auc' => 0.99, 'equipoise' => 0.01]);

    expect($svc->mayProceed($study, GateStage::StudyDiagnostics))->toBeTrue();
});

it('evaluates S5 and S6 from a study-114-like estimation result', function () {
    config(['studies.gating_enabled' => true]);
    $user = User::factory()->create();
    $study = clioGateStudy($user);

    $gates = app(StudyGateService::class)->evaluateEstimationGates($study, [
        'propensity_score' => ['auc' => 0.99, 'max_smd_after' => 0.45, 'equipoise' => 0.01],
        'calibration' => ['status' => 'insufficient_controls', 'informative_negative_controls' => 0],
    ]);

    expect($gates)->toHaveCount(2)
        ->and($gates[0]->status)->toBe(GateStatus::Failed)   // S5 separation
        ->and($gates[1]->status)->toBe(GateStatus::Failed);  // S6 insufficient controls
});

it('blinds estimation results for a gated study whose S5 gate has not cleared', function () {
    config(['studies.gating_enabled' => true]);
    $user = User::factory()->create();
    $study = clioGateStudy($user);
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
