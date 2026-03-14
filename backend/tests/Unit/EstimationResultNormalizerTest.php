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
