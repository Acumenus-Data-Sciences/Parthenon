<?php

declare(strict_types=1);

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

it('missing analysis_type → 422', function () {
    Bus::fake();
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/runs', ['source_key' => 'EUNOMIA', 'params' => []])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['analysis_type']);
});

it('missing source_key → 422', function () {
    Bus::fake();
    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/runs', ['analysis_type' => 'co2.codewas', 'params' => []])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['source_key']);
});

it('unknown analysis_type does not create a run', function () {
    Bus::fake();
    // The Registry throws FinnGenUnknownAnalysisTypeException. Whatever status
    // Laravel returns (likely 500 unless handler maps it), the run must NOT exist.
    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/runs', [
            'analysis_type' => 'totally.not.real',
            'source_key' => 'EUNOMIA',
            'params' => [],
        ]);

    expect($response->status())->toBeGreaterThanOrEqual(400);
    expect(Run::count())->toBe(0);
});
