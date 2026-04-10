<?php

declare(strict_types=1);

use App\DataTransferObjects\LabRangeDto;
use App\Enums\LabStatus;
use App\Services\Analysis\LabStatusClassifier;

dataset('classification_cases', [
    // [value, low, high, expected]
    'value in range' => [10.0, 8.0, 12.0, LabStatus::Normal],
    'value at lower bound' => [8.0,  8.0, 12.0, LabStatus::Normal],
    'value at upper bound' => [12.0, 8.0, 12.0, LabStatus::Normal],
    'value just below low' => [7.99, 8.0, 12.0, LabStatus::Low],
    'value just above high' => [12.01, 8.0, 12.0, LabStatus::High],
    'value far below low' => [5.0,  8.0, 12.0, LabStatus::Low],
    'value far above high' => [20.0, 8.0, 12.0, LabStatus::High],
    'value critical low' => [-1.0, 8.0, 12.0, LabStatus::Critical],   // 8 - 2*(12-8) = 0; -1 < 0
    'value critical high' => [25.0, 8.0, 12.0, LabStatus::Critical],   // 12 + 2*(12-8) = 20; 25 > 20
    'value at critical low boundary' => [0.0,  8.0, 12.0, LabStatus::Low],       // exactly 0, not < 0 → Low
    'value at critical high boundary' => [20.0, 8.0, 12.0, LabStatus::High],     // exactly 20, not > 20 → High
    'negative range, not critical' => [-5.0, -10.0, 0.0, LabStatus::Normal],
]);

test('classifies value against range', function (float $value, float $low, float $high, LabStatus $expected) {
    $range = new LabRangeDto(
        low: $low,
        high: $high,
        source: 'curated',
        sourceLabel: 'test',
    );

    expect(LabStatusClassifier::classify($value, $range))->toBe($expected);
})->with('classification_cases');

test('returns Unknown when range is null', function () {
    expect(LabStatusClassifier::classify(10.0, null))->toBe(LabStatus::Unknown);
});
