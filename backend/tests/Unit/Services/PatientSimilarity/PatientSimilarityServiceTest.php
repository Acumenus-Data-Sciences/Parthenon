<?php

declare(strict_types=1);

use App\Services\PatientSimilarity\PatientSimilarityService;

it('derives cohort divergence from centroid similarity instead of coverage alone', function () {
    $service = new PatientSimilarityService;

    $comparison = $service->compareProfiles(
        [
            'age_bucket' => 10,
            'gender_concept_id' => 8507,
            'race_concept_id' => 8527,
            'condition_concepts' => [101, 102],
            'recent_condition_concepts' => [101],
        ],
        [
            'age_bucket' => 10,
            'gender_concept_id' => 8507,
            'race_concept_id' => 8527,
            'condition_concepts' => [201, 202],
            'recent_condition_concepts' => [201],
        ],
    );

    expect($comparison['divergence']['demographics'])->toBe([
        'score' => 0.0,
        'label' => 'Similar',
    ]);

    expect($comparison['divergence']['conditions'])->toBe([
        'score' => 1.0,
        'label' => 'Divergent',
    ]);

    expect($comparison['overall_divergence'])->toBe(0.5);
});

it('does not treat mutually unavailable dimensions as divergent', function () {
    $service = new PatientSimilarityService;

    $comparison = $service->compareProfiles(
        [
            'age_bucket' => 8,
            'gender_concept_id' => 8507,
            'race_concept_id' => 8527,
        ],
        [
            'age_bucket' => 8,
            'gender_concept_id' => 8507,
            'race_concept_id' => 8527,
        ],
    );

    expect($comparison['divergence']['conditions'])->toBe([
        'score' => 0.0,
        'label' => 'No data',
    ]);

    expect($comparison['divergence']['measurements'])->toBe([
        'score' => 0.0,
        'label' => 'No data',
    ]);

    expect($comparison['overall_divergence'])->toBe(0.0);
});
