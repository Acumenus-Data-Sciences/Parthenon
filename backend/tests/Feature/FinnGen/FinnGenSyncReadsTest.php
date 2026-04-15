<?php

declare(strict_types=1);

use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    Cache::flush();
});

it('sync romopapi code-counts proxies to Darkstar', function () {
    Http::fake([
        '*/finngen/romopapi/code-counts*' => Http::response([
            'concept' => ['concept_id' => 201826],
            'stratified_counts' => [],
            'node_count' => 0,
            'descendant_count' => 0,
        ], 200),
    ]);

    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/sync/romopapi/code-counts?source=EUNOMIA&concept_id=201826')
        ->assertStatus(200)
        ->assertJsonStructure(['concept', 'stratified_counts']);
});

it('second sync read hits cache without re-calling Darkstar', function () {
    Http::fake(['*' => Http::response(['relationships' => []], 200)]);

    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/sync/romopapi/relationships?source=EUNOMIA&concept_id=201826');
    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/sync/romopapi/relationships?source=EUNOMIA&concept_id=201826');

    Http::assertSentCount(1);
});

it('?refresh=true bypasses cache', function () {
    Http::fake(['*' => Http::response(['relationships' => []], 200)]);

    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/sync/romopapi/relationships?source=EUNOMIA&concept_id=201826');
    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/sync/romopapi/relationships?source=EUNOMIA&concept_id=201826&refresh=true');

    Http::assertSentCount(2);
});

it('missing source param → 422', function () {
    Http::fake();
    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/sync/romopapi/code-counts?concept_id=201826')
        ->assertStatus(422);
});
