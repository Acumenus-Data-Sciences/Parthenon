<?php

declare(strict_types=1);

use App\Services\PatientSimilarity\Scorers\ConceptSetSimilarity;
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

    // All concepts at level 0 (leaf/exact match) — hierarchical Jaccard
    // with all weights = 1.0 produces the same result as flat Jaccard
    $score = $scorer->score(
        [
            'condition_concepts' => [1 => 0, 2 => 0, 3 => 0],
            'recent_condition_concepts' => [1 => 0, 3 => 0],
        ],
        [
            'condition_concepts' => [1 => 0, 2 => 0, 4 => 0],
            'recent_condition_concepts' => [1 => 0, 5 => 0],
        ],
    );

    expect($score)->toEqualWithDelta(0.45, 0.00001);
});

it('falls back to lifetime drug overlap when recent histories are absent', function () {
    $scorer = new DrugScorer;

    $score = $scorer->score(
        ['drug_concepts' => [11 => 0, 12 => 0], 'recent_drug_concepts' => []],
        ['drug_concepts' => [11 => 0, 13 => 0], 'recent_drug_concepts' => []],
    );

    expect($score)->toEqualWithDelta(1 / 3, 0.00001);
});

it('penalizes temporal divergence in procedures even when lifetime history matches', function () {
    $scorer = new ProcedureScorer;

    $score = $scorer->score(
        [
            'procedure_concepts' => [21 => 0, 22 => 0],
            'recent_procedure_concepts' => [21 => 0],
        ],
        [
            'procedure_concepts' => [21 => 0, 22 => 0],
            'recent_procedure_concepts' => [],
        ],
    );

    expect($score)->toEqualWithDelta(0.7, 0.00001);
});

// --- Hierarchical weighted Jaccard tests ---

it('returns 1.0 for identical sets in hierarchicalBlendedJaccard', function () {
    $setA = [100 => 0, 200 => 0, 300 => 0];
    $setB = [100 => 0, 200 => 0, 300 => 0];

    $score = ConceptSetSimilarity::hierarchicalBlendedJaccard($setA, $setB, $setA, $setB);

    expect($score)->toEqualWithDelta(1.0, 0.00001);
});

it('returns 0.0 for completely disjoint sets in hierarchicalBlendedJaccard', function () {
    $setA = [100 => 0, 200 => 0];
    $setB = [300 => 0, 400 => 0];

    $score = ConceptSetSimilarity::hierarchicalBlendedJaccard($setA, $setB, $setA, $setB);

    expect($score)->toEqualWithDelta(0.0, 0.00001);
});

it('returns -1.0 for empty sets in hierarchicalBlendedJaccard', function () {
    $score = ConceptSetSimilarity::hierarchicalBlendedJaccard([], [], [], []);

    expect($score)->toBe(-1.0);
});

it('gives partial credit for ancestor-expanded overlapping concepts', function () {
    // Patient A has concept 100 at level 0 (leaf) and concept 200 at level 2 (ancestor)
    // Patient B has concept 100 at level 0 (leaf) and concept 200 at level 0 (leaf)
    // Concept 100: both level 0 → weight min(1.0, 1.0) = 1.0 for intersection, max = 1.0
    // Concept 200: A level 2 (0.25), B level 0 (1.0) → intersection min(0.25, 1.0) = 0.25, union max = 1.0
    // weighted jaccard = (1.0 + 0.25) / (1.0 + 1.0) = 1.25 / 2.0 = 0.625
    $lifetimeA = [100 => 0, 200 => 2];
    $lifetimeB = [100 => 0, 200 => 0];

    $score = ConceptSetSimilarity::hierarchicalBlendedJaccard($lifetimeA, $lifetimeB, [], []);

    expect($score)->toEqualWithDelta(0.625, 0.00001);
});

it('scores higher for level-1 ancestor match than level-3', function () {
    // Both share concept 100 but at different depths
    $level1A = [100 => 1];
    $level1B = [100 => 0];

    $level3A = [100 => 3];
    $level3B = [100 => 0];

    $scoreLevel1 = ConceptSetSimilarity::hierarchicalBlendedJaccard($level1A, $level1B, [], []);
    $scoreLevel3 = ConceptSetSimilarity::hierarchicalBlendedJaccard($level3A, $level3B, [], []);

    expect($scoreLevel1)->toBeGreaterThan($scoreLevel3);
    expect($scoreLevel1)->toBeGreaterThan(0.0);
    expect($scoreLevel3)->toBeGreaterThan(0.0);
});

it('preserves existing blendedJaccard behavior unchanged', function () {
    // blendedJaccard still works with flat int arrays (backward compat)
    $score = ConceptSetSimilarity::blendedJaccard(
        [1, 2, 3],
        [1, 2, 4],
        [1, 3],
        [1, 5],
    );

    expect($score)->toEqualWithDelta(0.45, 0.00001);
});

it('gives partial credit via scorer when concepts share ancestors at different depths', function () {
    $scorer = new ConditionScorer;

    // Patient A has concept 100 as leaf (level 0) and concept 200 as ancestor at level 2
    // Patient B has concept 100 as leaf (level 0) and concept 300 as leaf (level 0)
    // Shared: concept 100 (both level 0, weight 1.0)
    // Unique to A: concept 200 at level 2 (weight 0.25)
    // Unique to B: concept 300 at level 0 (weight 1.0)
    // weighted intersection = 1.0, weighted union = 1.0 + 0.25 + 1.0 = 2.25
    // score = 1.0 / 2.25 ≈ 0.4444
    $score = $scorer->score(
        [
            'condition_concepts' => [100 => 0, 200 => 2],
            'recent_condition_concepts' => [],
        ],
        [
            'condition_concepts' => [100 => 0, 300 => 0],
            'recent_condition_concepts' => [],
        ],
    );

    expect($score)->toBeGreaterThan(0.0);
    expect($score)->toBeLessThan(1.0);
    expect($score)->toEqualWithDelta(1.0 / 2.25, 0.00001);
});
