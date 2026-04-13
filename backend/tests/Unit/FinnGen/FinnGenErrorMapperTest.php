<?php

declare(strict_types=1);

use App\Services\FinnGen\FinnGenErrorMapper;
use Tests\TestCase;

uses(TestCase::class);

it('maps every known category to a non-empty user message', function (string $category) {
    $message = app(FinnGenErrorMapper::class)->userMessage($category);

    expect($message)->toBeString();
    expect(strlen($message))->toBeGreaterThan(10);
    // The fallback key itself ("finngen.errors.xxx") must not leak back
    expect($message)->not->toStartWith('finngen.errors.');
})->with(array_keys(FinnGenErrorMapper::DARKSTAR_R_CATEGORIES));

it('falls back to the unknown message for an unrecognized category', function () {
    $message = app(FinnGenErrorMapper::class)->userMessage('MADE_UP_THING');

    expect($message)->toBeString();
    expect(strlen($message))->toBeGreaterThan(10);
    // The unknown-fallback copy should mention "unknown"
    expect(strtolower($message))->toContain('unknown');
});

it('wrapperCode prefixes with DARKSTAR_R_', function () {
    $code = app(FinnGenErrorMapper::class)->wrapperCode('DB_CONNECTION_FAILED');

    expect($code)->toBe('DARKSTAR_R_DB_CONNECTION_FAILED');
});

it('wrapperCode passes through an unknown category (does not validate)', function () {
    // The mapper doesn't guard against unknown categories here — callers decide
    // whether to reject up-front or just pass the diagnostic through. This test
    // pins that contract.
    $code = app(FinnGenErrorMapper::class)->wrapperCode('ANYTHING_ELSE');

    expect($code)->toBe('DARKSTAR_R_ANYTHING_ELSE');
});

it('knownCategories returns all 9 categories in insertion order', function () {
    $categories = app(FinnGenErrorMapper::class)->knownCategories();

    expect($categories)->toHaveCount(9);
    expect($categories)->toBe([
        'DB_CONNECTION_FAILED',
        'DB_SCHEMA_MISMATCH',
        'OUT_OF_MEMORY',
        'PACKAGE_NOT_LOADED',
        'ANALYSIS_EXCEPTION',
        'MIRAI_TASK_CRASHED',
        'TIMEOUT',
        'DISK_FULL',
        'CANCELED',
    ]);
});

it('every R-side category in common.R is mapped here', function () {
    // Cross-check against darkstar/api/finngen/common.R to ensure no category
    // drifts. The R side can emit these strings via finngen_error(category=...):
    $expectedRSideCategories = [
        'DB_CONNECTION_FAILED',     // DatabaseConnectorError handler
        'DB_SCHEMA_MISMATCH',       // SqlRenderError handler
        'OUT_OF_MEMORY',            // OutOfMemoryError + Java heap text match
        'DISK_FULL',                // simpleError disk-full text match
        'ANALYSIS_EXCEPTION',       // fall-through default
        // The following are emitted elsewhere (jobs.R mirai crash, cancellation path,
        // timeout wrapper) — not by common.R itself, but still part of the taxonomy:
        'PACKAGE_NOT_LOADED',
        'MIRAI_TASK_CRASHED',
        'TIMEOUT',
        'CANCELED',
    ];

    foreach ($expectedRSideCategories as $cat) {
        expect(FinnGenErrorMapper::DARKSTAR_R_CATEGORIES)->toHaveKey($cat);
    }
});
