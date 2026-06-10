<?php

use App\Support\Cohort\ConceptIdExtractor;

it('extracts concept ids from Atlas-cased expressions in order', function () {
    $ids = ConceptIdExtractor::fromExpression([
        'ConceptSets' => [
            ['expression' => ['items' => [
                ['concept' => ['CONCEPT_ID' => 201826]],
                ['concept' => ['CONCEPT_ID' => 4329847]],
            ]]],
        ],
    ]);

    expect($ids)->toBe([201826, 4329847]);
});

it('handles lower-case casing and dedupes across sets', function () {
    $ids = ConceptIdExtractor::fromExpression([
        'conceptSets' => [
            ['expression' => ['items' => [
                ['concept' => ['concept_id' => 100]],
                ['concept' => ['concept_id' => 100]],
            ]]],
            ['expression' => ['items' => [
                ['concept' => ['CONCEPT_ID' => 200]],
            ]]],
        ],
    ]);

    expect($ids)->toBe([100, 200]);
});

it('ignores zero, negative, missing ids and malformed shapes', function () {
    $ids = ConceptIdExtractor::fromExpression([
        'ConceptSets' => [
            ['expression' => ['items' => [
                ['concept' => ['CONCEPT_ID' => 0]],
                ['concept' => ['CONCEPT_ID' => -5]],
                ['concept' => []],
                ['notconcept' => true],
                'garbage',
            ]]],
            'garbage-set',
        ],
    ]);

    expect($ids)->toBe([]);
});

it('returns empty when concept sets are missing or malformed', function () {
    expect(ConceptIdExtractor::fromExpression([]))->toBe([])
        ->and(ConceptIdExtractor::fromExpression(['ConceptSets' => 'nope']))->toBe([]);
});
