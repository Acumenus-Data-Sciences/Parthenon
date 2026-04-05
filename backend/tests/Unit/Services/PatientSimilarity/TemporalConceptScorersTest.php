<?php

declare(strict_types=1);

use App\Services\PatientSimilarity\Scorers\ConditionScorer;
use App\Services\PatientSimilarity\Scorers\DrugScorer;
use App\Services\PatientSimilarity\Scorers\ProcedureScorer;

it('returns unavailable when condition history is absent in both patients', function () {
    $scorer = new ConditionScorer;

    $score = $scorer->score(
        ['condition_concepts' => [], 'recent_condition_concepts' => []],
        ['condition_concepts' => [], 'recent_condition_concepts' => []],
    );

    expect($score)->toBe(-1.0);
});

it('blends lifetime and recent condition overlap', function () {
    $scorer = new ConditionScorer;

    $score = $scorer->score(
        [
            'condition_concepts' => [1, 2, 3],
            'recent_condition_concepts' => [1, 3],
        ],
        [
            'condition_concepts' => [1, 2, 4],
            'recent_condition_concepts' => [1, 5],
        ],
    );

    expect($score)->toEqualWithDelta(0.45, 0.00001);
});

it('falls back to lifetime drug overlap when recent histories are absent', function () {
    $scorer = new DrugScorer;

    $score = $scorer->score(
        ['drug_concepts' => [11, 12], 'recent_drug_concepts' => []],
        ['drug_concepts' => [11, 13], 'recent_drug_concepts' => []],
    );

    expect($score)->toEqualWithDelta(1 / 3, 0.00001);
});

it('penalizes temporal divergence in procedures even when lifetime history matches', function () {
    $scorer = new ProcedureScorer;

    $score = $scorer->score(
        [
            'procedure_concepts' => [21, 22],
            'recent_procedure_concepts' => [21],
        ],
        [
            'procedure_concepts' => [21, 22],
            'recent_procedure_concepts' => [],
        ],
    );

    expect($score)->toEqualWithDelta(0.7, 0.00001);
});
