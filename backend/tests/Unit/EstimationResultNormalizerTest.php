<?php

use App\Support\EstimationResultNormalizer;

it('normalizes missing estimation result arrays', function () {
    $normalized = EstimationResultNormalizer::normalize([
        'status' => 'completed',
        'summary' => [
            'target_count' => 12,
            'comparator_count' => 9,
        ],
    ]);

    expect($normalized['estimates'])->toBeArray()->toBe([])
        ->and($normalized['covariate_balance'])->toBeArray()->toBe([])
        ->and($normalized['attrition'])->toBeArray()->toBe([])
        ->and($normalized['negative_controls'])->toBeArray()->toBe([])
        ->and($normalized['power_analysis'])->toBeArray()->toBe([])
        ->and($normalized['summary']['outcome_counts'])->toBeArray()->toBe([]);
});

it('flattens legacy negative control payloads', function () {
    $normalized = EstimationResultNormalizer::normalize([
        'status' => 'completed',
        'summary' => [],
        'negative_controls' => [
            'estimates' => [
                [
                    'outcome_id' => 1,
                    'log_rr' => 0.1,
                    'se_log_rr' => 0.2,
                ],
            ],
        ],
    ]);

    expect($normalized['negative_controls'])->toBeArray()->toHaveCount(1)
        ->and($normalized['negative_controls'][0]['outcome_id'])->toBe(1);
});

it('annotates outcome estimates with Benjamini-Hochberg adjusted_p', function () {
    $normalized = EstimationResultNormalizer::normalize([
        'status' => 'completed',
        'summary' => [],
        'estimates' => [
            ['outcome_id' => 1, 'hazard_ratio' => 1.5, 'p_value' => 0.01],
            ['outcome_id' => 2, 'hazard_ratio' => 1.1, 'p_value' => 0.04],
            ['outcome_id' => 3, 'hazard_ratio' => 1.0, 'p_value' => 0.20],
        ],
    ]);

    $est = $normalized['estimates'];

    // BH(m=3): 0.01->0.03, 0.04->0.06, 0.20->0.20
    expect($est)->toHaveCount(3)
        ->and(round($est[0]['adjusted_p'], 4))->toBe(0.03)
        ->and(round($est[1]['adjusted_p'], 4))->toBe(0.06)
        ->and(round($est[2]['adjusted_p'], 4))->toBe(0.20)
        ->and($est[0]['adjusted_p'])->toBeGreaterThanOrEqual(0.01);
});

it('normalizes the calibration block and adjusts calibrated p-values', function () {
    $normalized = EstimationResultNormalizer::normalize([
        'status' => 'completed',
        'summary' => [],
        'estimates' => [['outcome_id' => 1, 'p_value' => 0.001]],
        'calibration' => [
            'status' => 'completed',
            'min_negative_controls' => 5,
            'informative_negative_controls' => 8,
            'ease' => 0.1426,
            'systematic_error_model' => ['null_mean' => 0.11, 'null_sd' => 0.13],
            'calibrated_estimates' => [
                ['outcome_id' => 1, 'calibrated_hr' => 1.47, 'calibrated_p' => 0.02],
            ],
            'calibration_plot' => ['negative_controls' => [['log_rr' => 0.3, 'se_log_rr' => 0.12]]],
        ],
    ]);

    expect($normalized['calibration'])->toBeArray()
        ->and($normalized['calibration']['status'])->toBe('completed')
        ->and($normalized['calibration']['informative_negative_controls'])->toBe(8)
        ->and($normalized['calibration']['ease'])->toBe(0.1426)
        ->and($normalized['calibration']['calibrated_estimates'][0])->toHaveKey('calibrated_adjusted_p');
});

it('reports null calibration when the sidecar omits it', function () {
    $normalized = EstimationResultNormalizer::normalize([
        'status' => 'completed',
        'summary' => [],
    ]);

    expect($normalized['calibration'])->toBeNull();
});

it('passes through the insufficient_controls calibration status', function () {
    $normalized = EstimationResultNormalizer::normalize([
        'status' => 'completed',
        'summary' => [],
        'calibration' => [
            'status' => 'insufficient_controls',
            'min_negative_controls' => 5,
            'informative_negative_controls' => 2,
            'message' => 'Only 2 informative negative control(s) (need >= 5)',
            'calibrated_estimates' => [],
        ],
    ]);

    expect($normalized['calibration']['status'])->toBe('insufficient_controls')
        ->and($normalized['calibration']['informative_negative_controls'])->toBe(2)
        ->and($normalized['calibration']['calibrated_estimates'])->toBe([]);
});
