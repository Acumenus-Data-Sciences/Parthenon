<?php

use App\Support\EstimationResultNormalizer;

it('blinds effect estimates while retaining diagnostics', function () {
    $result = [
        'summary' => ['target_count' => 100],
        'estimates' => [['outcome_id' => 1, 'hazard_ratio' => 1.6, 'p_value' => 0.01]],
        'propensity_score' => ['auc' => 0.72, 'equipoise' => 0.5],
        'covariate_balance' => [['covariate_name' => 'age', 'smd_after' => 0.02]],
        'calibration' => [
            'status' => 'completed',
            'ease' => 0.14,
            'calibrated_estimates' => [['outcome_id' => 1, 'calibrated_hr' => 1.4]],
        ],
    ];

    $blinded = EstimationResultNormalizer::blind($result);

    expect($blinded['blinded'])->toBeTrue()
        ->and($blinded['estimates'])->toBe([])
        ->and($blinded['calibration']['calibrated_estimates'])->toBe([])
        // diagnostics retained
        ->and($blinded['propensity_score'])->toBe(['auc' => 0.72, 'equipoise' => 0.5])
        ->and($blinded['covariate_balance'])->toBe([['covariate_name' => 'age', 'smd_after' => 0.02]])
        ->and($blinded['calibration']['ease'])->toBe(0.14);
});
