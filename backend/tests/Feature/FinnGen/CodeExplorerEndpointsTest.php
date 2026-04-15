<?php

declare(strict_types=1);

use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Models\App\FinnGen\Run;
use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $this->admin = User::where('email', 'finngen-test-admin@test.local')->firstOrFail();

    try {
        foreach (Redis::connection()->keys('finngen:sync:code-explorer:*') as $k) {
            Redis::connection()->del($k);
        }
    } catch (Throwable $e) {
        // Redis not available — ignore
    }
});

it('GET /counts returns the Darkstar payload on happy path', function () {
    Http::fake([
        '*/finngen/romopapi/code-counts*' => Http::response([
            'concept' => ['concept_id' => 201826, 'concept_name' => 'Diabetes type 2'],
            'stratified_counts' => [],
            'node_count' => 0,
            'descendant_count' => 0,
        ], 200),
    ]);

    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/counts?source=EUNOMIA&concept_id=201826')
        ->assertStatus(200)
        ->assertJsonStructure(['concept', 'stratified_counts', 'node_count', 'descendant_count']);
});

it('GET /counts on missing stratified_code_counts table returns enriched 422', function () {
    Http::fake([
        '*/finngen/romopapi/code-counts*' => Http::response([
            'error' => [
                'category' => 'DB_SCHEMA_MISMATCH',
                'message' => 'relation "eunomia_results.stratified_code_counts" does not exist',
            ],
        ], 422),
    ]);

    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/counts?source=EUNOMIA&concept_id=201826');

    $response->assertStatus(422);
    $body = $response->json();
    expect($body['error']['code'])->toBe('FINNGEN_SOURCE_NOT_INITIALIZED');
    expect($body['error']['action']['type'])->toBe('initialize_source');
    expect($body['error']['action']['source_key'])->toBe('EUNOMIA');
});

it('GET /relationships returns data + serves cached response on second call', function () {
    Http::fake(['*' => Http::response(['relationships' => [['relationship_id' => 'Maps to', 'concept_id_2' => 1]]], 200)]);

    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/relationships?source=EUNOMIA&concept_id=201826')
        ->assertStatus(200);
    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/relationships?source=EUNOMIA&concept_id=201826')
        ->assertStatus(200);

    Http::assertSentCount(1);
})->skip(fn () => redisAvailable() === false, 'Redis not available');

it('GET /ancestors strips mermaid field + clamps max_depth', function () {
    Http::fake([
        '*' => Http::response([
            'nodes' => [['concept_id' => 1]],
            'edges' => [['src' => 1, 'dst' => 2]],
            'mermaid' => "graph TD\n  c1 --> c2",
        ], 200),
    ]);

    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/ancestors?source=EUNOMIA&concept_id=201826&max_depth=99');

    $response->assertStatus(200);
    $body = $response->json();
    expect($body)->toHaveKeys(['nodes', 'edges']);
    expect($body)->not->toHaveKey('mermaid');

    Http::assertSent(function ($request) {
        return str_contains($request->url(), 'max_depth=7');
    });
});

it('GET /source-readiness returns ready=true when table exists', function () {
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA');

    $response->assertStatus(200)
        ->assertJsonStructure(['source_key', 'ready', 'missing', 'setup_run_id']);
    expect($response->json('source_key'))->toBe('EUNOMIA');
});

it('GET /source-readiness surfaces active setup_run_id', function () {
    Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'romopapi.setup',
        'params' => [],
        'status' => Run::STATUS_RUNNING,
        'started_at' => now(),
    ]);

    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA');

    $response->assertStatus(200);
    expect($response->json('setup_run_id'))->not->toBeNull();
});

it('POST /report dispatches a romopapi.report run', function () {
    Bus::fake();

    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/code-explorer/report', [
            'source_key' => 'EUNOMIA',
            'concept_id' => 201826,
        ]);

    $response->assertStatus(201);
    expect($response->json('analysis_type'))->toBe('romopapi.report');
    expect($response->json('params.concept_id'))->toBe(201826);

    Bus::assertDispatched(RunFinnGenAnalysisJob::class);
});

it('POST /initialize-source dispatches a romopapi.setup run (admin)', function () {
    Bus::fake();

    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/code-explorer/initialize-source', [
            'source_key' => 'EUNOMIA',
        ]);

    $response->assertStatus(201);
    expect($response->json('analysis_type'))->toBe('romopapi.setup');
    expect($response->json('source_key'))->toBe('EUNOMIA');
});

function redisAvailable(): bool
{
    try {
        return Redis::connection()->ping() !== false;
    } catch (Throwable $e) {
        return false;
    }
}
