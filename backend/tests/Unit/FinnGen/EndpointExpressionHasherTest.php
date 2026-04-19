<?php

declare(strict_types=1);

use App\Services\FinnGen\EndpointExpressionHasher;
use Tests\TestCase;

uses(TestCase::class);

/**
 * Phase 18 GENOMICS-09/10/11 — EndpointExpressionHasher (D-10).
 *
 * Flipped GREEN by Plan 18-03 Task 2. Hash must be stable across semantically
 * equivalent inputs (key order, int-vs-float) so D-10 cache invalidation flips
 * only on real expression change — not serialization noise. Pitfall 4: if not
 * deterministic, the cache invalidates on every endpoint re-import, costing
 * ~15 s of Darkstar CPU per drawer open.
 */
it('produces identical SHA-256 hash across semantically equivalent JSON (key order, whitespace)', function (): void {
    $hasher = app(EndpointExpressionHasher::class);
    $a = ['b' => 2, 'a' => 1, 'c' => ['z' => 1, 'y' => 2]];
    $b = ['a' => 1, 'b' => 2, 'c' => ['y' => 2, 'z' => 1]];

    expect($hasher->hash($a))
        ->toBe($hasher->hash($b))
        ->and(strlen($hasher->hash($a)))->toBe(64);
});

it('produces different hash when concept_id list changes', function (): void {
    $hasher = app(EndpointExpressionHasher::class);

    expect($hasher->hash(['conditions' => [100, 200]]))
        ->not->toBe($hasher->hash(['conditions' => [100, 200, 300]]));
});

it('normalizes integer vs float concept_ids (1234 === 1234.0)', function (): void {
    $hasher = app(EndpointExpressionHasher::class);

    expect($hasher->hash(['id' => 1234]))
        ->toBe($hasher->hash(['id' => 1234.0]));
});
