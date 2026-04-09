<?php

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Contract tests for the R Plumber service (darkstar) via the `services.r_runtime.url`
 * configured URL. Each test gracefully skips when the R runtime is unreachable so CI
 * stays green in environments that do not run the darkstar container.
 */
function rRuntimeHealthUrl(): string
{
    return rtrim((string) config('services.r_runtime.url'), '/').'/health';
}

it('reaches R plumber /health and returns the expected top-level shape', function () {
    try {
        /** @var Response $response */
        $response = Http::timeout(30)->get(rRuntimeHealthUrl());
    } catch (Throwable $e) {
        $this->markTestSkipped('R runtime not reachable: '.$e->getMessage());
    }

    if (! $response->successful()) {
        $this->markTestSkipped('R runtime returned HTTP '.$response->status());
    }

    $body = $response->json();

    expect($body)->toBeArray()
        ->and($body)->toHaveKeys(['status', 'service', 'version', 'checks', 'packages'])
        ->and($body['service'])->toBe('darkstar')
        ->and($body['checks'])->toBeArray()
        ->and($body['checks'])->toHaveKeys(['packages', 'jvm', 'memory_ok', 'jdbc_driver']);
});

it('returns a darkstar version that matches semver', function () {
    try {
        /** @var Response $response */
        $response = Http::timeout(30)->get(rRuntimeHealthUrl());
    } catch (Throwable $e) {
        $this->markTestSkipped('R runtime not reachable: '.$e->getMessage());
    }

    if (! $response->successful()) {
        $this->markTestSkipped('R runtime returned HTTP '.$response->status());
    }

    $body = $response->json();
    expect($body)->toBeArray();
    expect($body['version'])->toBeString();
    expect(preg_match('/^\d+\.\d+\.\d+$/', (string) $body['version']))->toBe(1);
});

it('reports ohdsi package metadata under packages.ohdsi', function () {
    try {
        /** @var Response $response */
        $response = Http::timeout(30)->get(rRuntimeHealthUrl());
    } catch (Throwable $e) {
        $this->markTestSkipped('R runtime not reachable: '.$e->getMessage());
    }

    if (! $response->successful()) {
        $this->markTestSkipped('R runtime returned HTTP '.$response->status());
    }

    $body = $response->json();
    expect($body)->toBeArray();
    expect($body)->toHaveKey('packages');
    expect($body['packages'])->toBeArray();
    expect($body['packages'])->toHaveKey('ohdsi');
    $ohdsi = $body['packages']['ohdsi'];
    expect($ohdsi)->toBeArray();
    // If the darkstar container is up, ohdsi should have at least one package entry.
    expect(count($ohdsi))->toBeGreaterThan(0);
});
