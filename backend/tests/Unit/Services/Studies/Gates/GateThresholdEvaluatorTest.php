<?php

use App\Enums\GateStage;
use App\Enums\GateStatus;
use App\Services\Studies\Gates\GateThresholdEvaluator;

$thresholds = [
    'data_quality' => ['max_severe_failed_checks' => 0],
    'cohort_diagnostics' => ['min_subjects' => 1],
    'study_diagnostics' => ['max_ps_auc' => 0.80, 'max_smd_after' => 0.10, 'min_equipoise' => 0.30],
    'estimation_calibration' => ['min_informative_negative_controls' => 5],
];

it('FAILS study diagnostics on propensity-score separation (study-114 case)', function () use ($thresholds) {
    // PS separation: AUC ~1.0, equipoise ~0 — the exec-258 failure mode.
    $result = GateThresholdEvaluator::evaluate(
        GateStage::StudyDiagnostics,
        ['ps_auc' => 0.99, 'max_smd_after' => 0.45, 'equipoise' => 0.01],
        $thresholds['study_diagnostics'],
    );

    expect($result['status'])->toBe(GateStatus::Failed)
        ->and($result['reasons'])->toHaveCount(3); // AUC, SMD, equipoise all violated
});

it('PASSES study diagnostics on a well-balanced design', function () use ($thresholds) {
    $result = GateThresholdEvaluator::evaluate(
        GateStage::StudyDiagnostics,
        ['ps_auc' => 0.68, 'max_smd_after' => 0.04, 'equipoise' => 0.55],
        $thresholds['study_diagnostics'],
    );

    expect($result['status'])->toBe(GateStatus::Passed)
        ->and($result['reasons'])->toBe([]);
});

it('FAILS calibration with too few informative negative controls (study-114 case)', function () use ($thresholds) {
    $result = GateThresholdEvaluator::evaluate(
        GateStage::EstimationCalibration,
        ['status' => 'insufficient_controls', 'informative_negative_controls' => 0],
        $thresholds['estimation_calibration'],
    );

    expect($result['status'])->toBe(GateStatus::Failed)
        ->and($result['reasons'][0])->toContain('negative control');
});

it('PASSES calibration with enough informative controls', function () use ($thresholds) {
    $result = GateThresholdEvaluator::evaluate(
        GateStage::EstimationCalibration,
        ['status' => 'completed', 'informative_negative_controls' => 8],
        $thresholds['estimation_calibration'],
    );

    expect($result['status'])->toBe(GateStatus::Passed);
});

it('FAILS data quality on severe DQD failures and PASSES when clean', function () use ($thresholds) {
    expect(GateThresholdEvaluator::evaluate(GateStage::DataQuality, ['severe_failed_checks' => 3], $thresholds['data_quality'])['status'])
        ->toBe(GateStatus::Failed)
        ->and(GateThresholdEvaluator::evaluate(GateStage::DataQuality, ['severe_failed_checks' => 0], $thresholds['data_quality'])['status'])
        ->toBe(GateStatus::Passed);
});

it('FAILS cohort diagnostics on an empty cohort', function () use ($thresholds) {
    expect(GateThresholdEvaluator::evaluate(GateStage::CohortDiagnostics, ['distinct_persons' => 0], $thresholds['cohort_diagnostics'])['status'])
        ->toBe(GateStatus::Failed);
});

it('treats missing diagnostic metrics as non-blocking (only present metrics are judged)', function () use ($thresholds) {
    // No PS metrics at all → cannot judge separation → passes (diagnostics not yet available).
    expect(GateThresholdEvaluator::evaluate(GateStage::StudyDiagnostics, [], $thresholds['study_diagnostics'])['status'])
        ->toBe(GateStatus::Passed);
});
