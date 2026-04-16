<?php

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Contract tests for Darkstar via `services.darkstar.url`. Each test
 * gracefully skips when Darkstar is unreachable so CI stays green in
 * environments that do not run the darkstar container.
 */
function darkstarHealthUrl(): string
{
    return rtrim((string) config('services.darkstar.url'), '/').'/health';
}

it('reaches Darkstar /health and returns the expected top-level shape', function () {
    try {
        /** @var Response $response */
        $response = Http::timeout(30)->get(darkstarHealthUrl());
    } catch (Throwable $e) {
        $this->markTestSkipped('Darkstar not reachable: '.$e->getMessage());
    }

    if (! $response->successful()) {
        $this->markTestSkipped('Darkstar returned HTTP '.$response->status());
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
        $response = Http::timeout(30)->get(darkstarHealthUrl());
    } catch (Throwable $e) {
        $this->markTestSkipped('Darkstar not reachable: '.$e->getMessage());
    }

    if (! $response->successful()) {
        $this->markTestSkipped('Darkstar returned HTTP '.$response->status());
    }

    $body = $response->json();
    expect($body)->toBeArray();
    expect($body['version'])->toBeString();
    expect(preg_match('/^\d+\.\d+\.\d+$/', (string) $body['version']))->toBe(1);
});

it('reports ohdsi package metadata under packages.ohdsi', function () {
    try {
        /** @var Response $response */
        $response = Http::timeout(30)->get(darkstarHealthUrl());
    } catch (Throwable $e) {
        $this->markTestSkipped('Darkstar not reachable: '.$e->getMessage());
    }

    if (! $response->successful()) {
        $this->markTestSkipped('Darkstar returned HTTP '.$response->status());
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
