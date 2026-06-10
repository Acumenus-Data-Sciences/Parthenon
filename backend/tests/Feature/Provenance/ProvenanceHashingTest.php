<?php

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\User;
use App\Support\Hashing\DefinitionHasher;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('computes expression_sha256 when a concept set is saved', function () {
    $user = User::factory()->create();
    $expression = ['items' => [['concept' => ['CONCEPT_ID' => 201826], 'isExcluded' => false]]];

    $conceptSet = ConceptSet::create([
        'name' => 'T2DM',
        'author_id' => $user->id,
        'expression_json' => $expression,
        'is_public' => false,
    ]);

    expect($conceptSet->expression_sha256)
        ->not->toBeNull()
        ->toBe(app(DefinitionHasher::class)->hashExpression($expression));
});

it('keeps the hash stable on no-op save and changes it when the expression changes', function () {
    $user = User::factory()->create();
    $conceptSet = ConceptSet::create([
        'name' => 'Hash stability',
        'author_id' => $user->id,
        'expression_json' => ['items' => [['concept' => ['CONCEPT_ID' => 1]]]],
        'is_public' => false,
    ]);

    $original = $conceptSet->expression_sha256;
    expect($original)->not->toBeNull();

    $conceptSet->update(['description' => 'touched, expression unchanged']);
    expect($conceptSet->fresh()->expression_sha256)->toBe($original);

    $conceptSet->update(['expression_json' => ['items' => [['concept' => ['CONCEPT_ID' => 2]]]]]);
    expect($conceptSet->fresh()->expression_sha256)->not->toBe($original);
});

it('computes expression_sha256 for cohort definitions', function () {
    $user = User::factory()->create();

    $cohort = CohortDefinition::create([
        'name' => 'Incident HTN',
        'author_id' => $user->id,
        'version' => 1,
        'expression_json' => ['PrimaryCriteria' => ['CriteriaList' => []]],
        'is_public' => false,
    ]);

    expect($cohort->expression_sha256)
        ->not->toBeNull()
        ->toBe(app(DefinitionHasher::class)->hashExpression(['PrimaryCriteria' => ['CriteriaList' => []]]));
});
