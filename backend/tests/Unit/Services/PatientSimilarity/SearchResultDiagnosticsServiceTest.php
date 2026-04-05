<?php

declare(strict_types=1);

use App\Services\PatientSimilarity\SearchResultDiagnosticsService;

it('builds cohort balance diagnostics and warnings for imbalanced results', function () {
    $service = new SearchResultDiagnosticsService;

    $reference = [
        [
            'age_bucket' => 10,
            'gender_concept_id' => 8532,
            'race_concept_id' => 8527,
            'anchor_date' => '2026-01-01',
            'condition_concepts' => [1],
            'lab_vector' => [100 => 0.2],
            'drug_concepts' => [11],
            'procedure_concepts' => [21],
            'variant_genes' => [],
        ],
        [
            'age_bucket' => 11,
            'gender_concept_id' => 8532,
            'race_concept_id' => 8527,
            'anchor_date' => '2026-01-15',
            'condition_concepts' => [2],
            'lab_vector' => [100 => 0.1],
            'drug_concepts' => [12],
            'procedure_concepts' => [22],
            'variant_genes' => [],
        ],
        [
            'age_bucket' => 10,
            'gender_concept_id' => 8507,
            'race_concept_id' => 8516,
            'anchor_date' => '2026-02-01',
            'condition_concepts' => [3],
            'lab_vector' => [101 => -0.2],
            'drug_concepts' => [13],
            'procedure_concepts' => [23],
            'variant_genes' => [],
        ],
    ];

    $results = [
        [
            'age_bucket' => 16,
            'gender_concept_id' => 8507,
            'race_concept_id' => 8516,
            'anchor_date' => '2023-01-01',
            'condition_concepts' => [1],
            'lab_vector' => [],
            'drug_concepts' => [],
            'procedure_concepts' => [],
            'variant_genes' => [],
        ],
        [
            'age_bucket' => 17,
            'gender_concept_id' => 8507,
            'race_concept_id' => 8516,
            'anchor_date' => null,
            'condition_concepts' => [],
            'lab_vector' => [],
            'drug_concepts' => [],
            'procedure_concepts' => [],
            'variant_genes' => [],
        ],
        [
            'age_bucket' => 17,
            'gender_concept_id' => 8507,
            'race_concept_id' => 8516,
            'anchor_date' => null,
            'condition_concepts' => [],
            'lab_vector' => [],
            'drug_concepts' => [],
            'procedure_concepts' => [],
            'variant_genes' => [],
        ],
    ];

    $diagnostics = $service->build(
        ['feature_vector_version' => 2],
        $results,
        $reference,
    );

    expect($diagnostics['result_profile']['result_count'])->toBe(3)
        ->and($diagnostics['result_profile']['dimension_coverage']['conditions'])->toBe(0.3333)
        ->and($diagnostics['balance']['applicable'])->toBeTrue()
        ->and($diagnostics['balance']['verdict'])->toBe('significant_imbalance')
        ->and($diagnostics['balance']['mean_abs_smd'])->toBeGreaterThan(0.1)
        ->and($diagnostics['warnings'])->toContain('Low result count limits stability and subgroup assessment.')
        ->and($diagnostics['warnings'])->toContain('Measurements coverage is below 50% in the returned cohort.')
        ->and($diagnostics['warnings'])->toContain('Anchor-date completeness is below 90%, which weakens temporal comparability.')
        ->and($diagnostics['warnings'])->toContain('Returned cohort is demographically imbalanced versus the seed cohort (mean |SMD| >= 0.1).');
});

it('marks balance as not applicable for single-patient reference searches', function () {
    $service = new SearchResultDiagnosticsService;

    $diagnostics = $service->build(
        ['feature_vector_version' => 2],
        [[
            'age_bucket' => 10,
            'gender_concept_id' => 8532,
            'race_concept_id' => 8527,
            'anchor_date' => '2026-01-01',
            'condition_concepts' => [1],
            'lab_vector' => [100 => 0.2],
            'drug_concepts' => [11],
            'procedure_concepts' => [21],
            'variant_genes' => [],
        ]],
        null,
    );

    expect($diagnostics['balance']['applicable'])->toBeFalse()
        ->and($diagnostics['balance']['verdict'])->toBe('not_applicable');
});
