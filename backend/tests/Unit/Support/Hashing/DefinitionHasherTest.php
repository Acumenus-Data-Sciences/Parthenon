<?php

use App\Support\Hashing\DefinitionHasher;

// Pure unit test — Unit/Support/Hashing is not bound to TestCase (see tests/Pest.php),
// so this runs without booting Laravel. DefinitionHasher has no framework deps.

it('produces a 64-char hex sha256 and is deterministic', function () {
    $hasher = new DefinitionHasher;
    $expr = ['items' => [['concept' => ['CONCEPT_ID' => 201826], 'isExcluded' => false]]];

    $a = $hasher->hashExpression($expr);
    $b = $hasher->hashExpression($expr);

    expect($a)->toBe($b)
        ->and($a)->toMatch('/^[0-9a-f]{64}$/');
});

it('is insensitive to associative key ordering', function () {
    $hasher = new DefinitionHasher;

    $ordered = ['name' => 'x', 'domain' => 'Condition', 'flags' => ['a' => 1, 'b' => 2]];
    $shuffled = ['flags' => ['b' => 2, 'a' => 1], 'domain' => 'Condition', 'name' => 'x'];

    expect($hasher->hashExpression($ordered))->toBe($hasher->hashExpression($shuffled));
});

it('is sensitive to list ordering (OHDSI criteria order is meaningful)', function () {
    $hasher = new DefinitionHasher;

    expect($hasher->hashExpression(['list' => [1, 2, 3]]))
        ->not->toBe($hasher->hashExpression(['list' => [3, 2, 1]]));
});

it('is sensitive to content changes', function () {
    $hasher = new DefinitionHasher;

    expect($hasher->hashExpression(['CONCEPT_ID' => 1]))
        ->not->toBe($hasher->hashExpression(['CONCEPT_ID' => 2]));
});

it('handles null and empty deterministically', function () {
    $hasher = new DefinitionHasher;

    expect($hasher->hashExpression(null))->toBe($hasher->hashExpression([]));
});
