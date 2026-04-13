<?php

declare(strict_types=1);

use App\Services\FinnGen\Exceptions\FinnGenDarkstarMalformedResponseException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarRejectedException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarUnreachableException;
use App\Services\FinnGen\FinnGenClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

function finngenClient(): FinnGenClient
{
    return new FinnGenClient(
        baseUrl: 'http://darkstar:8787',
        timeoutSyncMs: 30_000,
        timeoutDispatchMs: 10_000,
        timeoutPollMs: 120_000,
    );
}

it('getSync returns decoded JSON on 200', function () {
    Http::fake([
        'darkstar:8787/finngen/romopapi/code-counts*' => Http::response(
            ['concept' => ['concept_id' => 1], 'stratified_counts' => [], 'node_count' => 0, 'descendant_count' => 0],
            200,
        ),
    ]);

    $result = finngenClient()->getSync('/finngen/romopapi/code-counts', ['source' => '{}', 'concept_id' => 1]);

    expect($result)->toHaveKeys(['concept', 'stratified_counts']);
});

it('postAsyncDispatch returns job_id on 202', function () {
    Http::fake([
        'darkstar:8787/finngen/co2/codewas' => Http::response(
            ['job_id' => 'job_abc', 'status' => 'running', 'run_id' => 'run_1'],
            202,
        ),
    ]);

    $result = finngenClient()->postAsyncDispatch('/finngen/co2/codewas', [
        'source' => ['source_key' => 'EUNOMIA'],
        'run_id' => 'run_1',
        'params' => [],
    ]);

    expect($result['job_id'])->toBe('job_abc');
    expect($result['status'])->toBe('running');
});

it('pollJob hits /jobs/status/{id}', function () {
    Http::fake([
        'darkstar:8787/jobs/status/job_abc' => Http::response(
            ['status' => 'running', 'job_id' => 'job_abc'],
            200,
        ),
    ]);

    $result = finngenClient()->pollJob('job_abc');

    Http::assertSent(fn ($req) => str_contains($req->url(), '/jobs/status/job_abc'));
    expect($result['status'])->toBe('running');
});

it('cancelJob POSTs to /jobs/cancel/{id}', function () {
    Http::fake([
        'darkstar:8787/jobs/cancel/job_abc' => Http::response(
            ['status' => 'cancelled', 'job_id' => 'job_abc'],
            200,
        ),
    ]);

    $result = finngenClient()->cancelJob('job_abc');

    Http::assertSent(fn ($req) => $req->method() === 'POST' && str_contains($req->url(), '/jobs/cancel/job_abc'));
    expect($result['status'])->toBe('cancelled');
});

it('maps 503 to FinnGenDarkstarUnreachableException', function () {
    Http::fake(['darkstar:8787/*' => Http::response('oops', 503)]);
    finngenClient()->getSync('/finngen/romopapi/code-counts', []);
})->throws(FinnGenDarkstarUnreachableException::class);

it('maps 500 to FinnGenDarkstarUnreachableException', function () {
    Http::fake(['darkstar:8787/*' => Http::response('boom', 500)]);
    finngenClient()->pollJob('job_abc');
})->throws(FinnGenDarkstarUnreachableException::class);

it('maps 422 to FinnGenDarkstarRejectedException with darkstar error body', function () {
    Http::fake([
        'darkstar:8787/*' => Http::response(
            ['error' => ['category' => 'DB_CONNECTION_FAILED', 'message' => 'refused']],
            422,
        ),
    ]);

    try {
        finngenClient()->postAsyncDispatch('/finngen/co2/codewas', []);
        expect(false)->toBeTrue('expected exception');
    } catch (FinnGenDarkstarRejectedException $e) {
        expect($e->status)->toBe(422);
        expect($e->darkstarError)->toBe(['category' => 'DB_CONNECTION_FAILED', 'message' => 'refused']);
    }
});

it('maps 400 to FinnGenDarkstarRejectedException', function () {
    Http::fake(['darkstar:8787/*' => Http::response(['error' => 'bad'], 400)]);
    finngenClient()->postAsyncDispatch('/finngen/co2/codewas', []);
})->throws(FinnGenDarkstarRejectedException::class);

it('maps non-JSON 2xx body to FinnGenDarkstarMalformedResponseException', function () {
    Http::fake(['darkstar:8787/*' => Http::response('<html>not json</html>', 200)]);

    try {
        finngenClient()->health();
        expect(false)->toBeTrue('expected exception');
    } catch (FinnGenDarkstarMalformedResponseException $e) {
        expect($e->rawBody)->toContain('not json');
    }
});

it('maps ConnectionException to FinnGenDarkstarUnreachableException', function () {
    // Simulate connection failure — Http::fake with a callable that throws
    Http::fake(function () {
        throw new ConnectionException('Connection refused');
    });

    finngenClient()->getSync('/finngen/romopapi/code-counts', []);
})->throws(FinnGenDarkstarUnreachableException::class);

it('health returns decoded finngen block', function () {
    Http::fake([
        'darkstar:8787/health' => Http::response([
            'status' => 'ok',
            'finngen' => ['packages_loaded' => ['ROMOPAPI', 'HadesExtras', 'CO2AnalysisModules'], 'load_errors' => []],
        ]),
    ]);

    $result = finngenClient()->health();

    expect($result['finngen']['packages_loaded'])->toContain('ROMOPAPI');
});

it('forContainer reads config', function () {
    config([
        'finngen.darkstar_url' => 'http://test-darkstar:8787/',
        'finngen.darkstar_timeout_sync_ms' => 15000,
        'finngen.darkstar_timeout_dispatch_ms' => 5000,
        'finngen.darkstar_timeout_poll_ms' => 60000,
    ]);

    Http::fake(['test-darkstar:8787/health' => Http::response(['status' => 'ok'])]);
    $client = FinnGenClient::forContainer();
    $result = $client->health();

    Http::assertSent(fn ($req) => str_contains($req->url(), 'test-darkstar:8787/health'));
    expect($result['status'])->toBe('ok');
});
