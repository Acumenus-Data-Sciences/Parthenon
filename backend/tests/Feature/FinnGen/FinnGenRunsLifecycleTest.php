<?php

declare(strict_types=1);

use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Models\App\FinnGen\Run;
use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
});

it('POST /runs creates a run and dispatches the job', function () {
    Bus::fake();

    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/runs', [
            'analysis_type' => 'co2.codewas',
            'source_key' => 'EUNOMIA',
            'params' => ['cohortIdCases' => 1, 'cohortIdControls' => 2],
        ]);

    $response->assertStatus(201);
    $response->assertJsonStructure(['id', 'status', 'analysis_type', 'source_key']);
    Bus::assertDispatched(RunFinnGenAnalysisJob::class);
});

it('GET /runs/{id} returns the run as its owner', function () {
    Bus::fake();
    $run = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas',
        'params' => [],
        'status' => Run::STATUS_QUEUED,
    ]);

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$run->id}")
        ->assertStatus(200)
        ->assertJson(['id' => $run->id]);
});

it('GET /runs lists runs with pagination meta', function () {
    Bus::fake();
    foreach (range(1, 3) as $_) {
        Run::create([
            'user_id' => $this->researcher->id,
            'source_key' => 'EUNOMIA',
            'analysis_type' => 'co2.codewas',
            'params' => [],
            'status' => Run::STATUS_QUEUED,
        ]);
    }

    $response = $this->actingAs($this->researcher)->getJson('/api/v1/finngen/runs');
    $response->assertStatus(200);
    $response->assertJsonStructure(['data', 'meta' => ['page', 'per_page', 'total']]);
});

it('POST /runs/{id}/cancel flips to canceling', function () {
    Bus::fake();
    $run = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas',
        'params' => [],
        'status' => Run::STATUS_RUNNING,
        'started_at' => now(),
    ]);

    $response = $this->actingAs($this->researcher)
        ->postJson("/api/v1/finngen/runs/{$run->id}/cancel");

    $response->assertStatus(202);
    expect($run->fresh()->status)->toBe(Run::STATUS_CANCELING);
});

it('POST + DELETE /runs/{id}/pin toggles pinned', function () {
    Bus::fake();
    $run = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas',
        'params' => [],
        'status' => Run::STATUS_SUCCEEDED,
        'started_at' => now(),
        'finished_at' => now(),
    ]);

    $this->actingAs($this->researcher)->postJson("/api/v1/finngen/runs/{$run->id}/pin")->assertStatus(200);
    expect($run->fresh()->pinned)->toBeTrue();

    $this->actingAs($this->researcher)->deleteJson("/api/v1/finngen/runs/{$run->id}/pin")->assertStatus(200);
    expect($run->fresh()->pinned)->toBeFalse();
});
