<?php

declare(strict_types=1);

use App\Services\FinnGen\GwasCacheKeyHasher;

it('produces deterministic hash for identical inputs', function () {
    $a = GwasCacheKeyHasher::hash(221, 1, 'v1hash', 'PANCREAS');
    $b = GwasCacheKeyHasher::hash(221, 1, 'v1hash', 'PANCREAS');
    expect($a)->toBe($b);
})->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03');

it('produces different hashes when cohort_definition_id changes', function () {
    $a = GwasCacheKeyHasher::hash(221, 1, 'v1hash', 'PANCREAS');
    $b = GwasCacheKeyHasher::hash(222, 1, 'v1hash', 'PANCREAS');
    expect($a)->not->toBe($b);
})->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03');

it('emits lowercase SHA-256 hex (64 chars)', function () {
    $hash = GwasCacheKeyHasher::hash(221, 1, 'v1hash', 'PANCREAS');
    expect($hash)->toMatch('/^[a-f0-9]{64}$/');
})->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03');

it('case-normalizes source_key so PANCREAS and pancreas map to same hash', function () {
    $upper = GwasCacheKeyHasher::hash(221, 1, 'v1hash', 'PANCREAS');
    $lower = GwasCacheKeyHasher::hash(221, 1, 'v1hash', 'pancreas');
    expect($upper)->toBe($lower);
})->skip('Wave 0 skeleton — implementation lands in Wave 2 Plan 14-03');
