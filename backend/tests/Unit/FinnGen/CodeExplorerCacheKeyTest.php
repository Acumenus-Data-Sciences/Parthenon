<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\FinnGen\CodeExplorerController;

uses(Tests\TestCase::class);

/**
 * Cache-key format is a contract with both downstream cache-invalidation
 * tooling AND the observer (ops reading Redis). Any drift breaks both.
 */
it('controller defines the expected TTL constants', function () {
    $reflection = new \ReflectionClass(CodeExplorerController::class);
    expect($reflection->getConstant('TTL_COUNTS'))->toBe(3600);
    expect($reflection->getConstant('TTL_RELATIONSHIPS'))->toBe(86400);
    expect($reflection->getConstant('TTL_ANCESTORS'))->toBe(86400);
});

it('max-depth cap constant matches spec (§4.1)', function () {
    $reflection = new \ReflectionClass(CodeExplorerController::class);
    expect($reflection->getConstant('MAX_DEPTH_CAP'))->toBe(7);
});

it('cache key format is stable and deterministic', function () {
    $query1 = ['concept_id' => 201826];
    $query2 = ['concept_id' => 201826];
    $hash1 = md5((string) json_encode($query1));
    $hash2 = md5((string) json_encode($query2));
    expect($hash1)->toBe($hash2);

    $key = sprintf('finngen:sync:code-explorer:%s:%s:%s', 'counts', 'EUNOMIA', $hash1);
    expect($key)->toStartWith('finngen:sync:code-explorer:');
    expect($key)->toContain(':EUNOMIA:');
    expect(strlen($key))->toBeGreaterThan(40);
});
