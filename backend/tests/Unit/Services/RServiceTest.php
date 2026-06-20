<?php

use App\Services\RService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Hermetic contract tests for the Darkstar/R analysis sidecar boundary.
 *
 * Unlike DarkstarContractTest (which hits a live darkstar and skips when it is
 * unreachable), these fake the HTTP layer so they run deterministically in CI
 * without the darkstar container. They pin the contract every analysis runner
 * must honour for the four sidecar response states: success, sidecar-reported
 * error / invalid input, legacy not_implemented, and empty/non-JSON bodies —
 * plus connection failure. The key regression they guard: a non-JSON error
 * body must never make a runner return null (which would TypeError when the
 * calling service passes it to isNotImplemented(array)).
 */
beforeEach(function () {
    config([
        'services.darkstar.url' => 'http://darkstar.test:8787',
        'services.darkstar.timeout' => 30,
    ]);
});

dataset('analysisRunners', [
    'estimation' => ['runEstimation', 'estimation/run'],
    'prediction' => ['runPrediction', 'prediction/run'],
    'sccs' => ['runSccs', 'sccs/run'],
    'self-controlled-cohort' => ['runSelfControlledCohort', 'self-controlled-cohort/run'],
    'phenotype-validation' => ['runPhenotypeValidation', 'phenotype-validation/run'],
    'evidence-synthesis' => ['runEvidenceSynthesis', 'evidence-synthesis/run'],
]);

it('returns the sidecar JSON on a successful (200) response', function (string $method, string $path) {
    Http::fake(["*/analysis/{$path}" => Http::response([
        'status' => 'completed',
        'pooled' => ['hr' => 1.15],
    ], 200)]);

    $result = app(RService::class)->{$method}(['source' => [], 'cohorts' => []]);

    expect($result)->toBeArray()
        ->and($result['status'])->toBe('completed');
})->with('analysisRunners');

it('returns the sidecar error JSON on an invalid-input (400) response', function (string $method, string $path) {
    Http::fake(["*/analysis/{$path}" => Http::response([
        'status' => 'error',
        'message' => 'Missing required fields',
    ], 400)]);

    $result = app(RService::class)->{$method}([]);

    expect($result)->toBeArray()
        ->and($result['status'])->toBe('error');
})->with('analysisRunners');

it('surfaces a legacy not_implemented (501) response without crashing', function (string $method, string $path) {
    Http::fake(["*/analysis/{$path}" => Http::response([
        'status' => 'not_implemented',
        'message' => 'Not yet implemented',
    ], 501)]);

    $result = app(RService::class)->{$method}([]);

    expect($result)->toBeArray()
        ->and($result['status'])->toBe('not_implemented');
})->with('analysisRunners');

it('never returns null on an empty/non-JSON sidecar response', function (string $method, string $path) {
    // Regression: estimation/sccs/evidence-synthesis previously returned
    // $response->json() (null on a non-JSON body), which TypeError'd in the
    // calling service. All runners must coalesce to an error array.
    Http::fake(["*/analysis/{$path}" => Http::response('<html>502 Bad Gateway</html>', 502)]);

    $result = app(RService::class)->{$method}([]);

    expect($result)->toBeArray()
        ->and($result['status'])->toBe('error')
        ->and($result['message'])->toContain('HTTP 502');
})->with('analysisRunners');

it('propagates a connection failure so the calling service can mark the execution failed', function (string $method) {
    Http::fake(function () {
        throw new ConnectionException('Connection refused');
    });

    expect(fn () => app(RService::class)->{$method}([]))
        ->toThrow(ConnectionException::class);
})->with('analysisRunners');
