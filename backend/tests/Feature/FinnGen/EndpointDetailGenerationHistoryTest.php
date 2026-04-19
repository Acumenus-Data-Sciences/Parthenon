<?php

declare(strict_types=1);

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

/**
 * Phase 15 Plan 08 — D-18 generation-history: filtered finngen.runs query in
 * the endpoint detail response. Verifies the controller returns multiple
 * generation runs per (endpoint, source), caps at 100 rows, and excludes
 * non-endpoint-generate analysis types (so GWAS runs don't leak into the
 * "Generation history" section).
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);

    $this->admin = User::where('email', 'finngen-test-admin@test.local')->firstOrFail();

    FinnGenEndpointGeneration::query()->where('endpoint_name', 'E4_DM2')->delete();
    EndpointDefinition::query()->where('name', 'E4_DM2')->delete();
    EndpointDefinition::factory()->create([
        'name' => 'E4_DM2',
        'longname' => 'Type 2 diabetes',
        'release' => 'df14',
        'coverage_profile' => CoverageProfile::UNIVERSAL,
        'coverage_bucket' => CoverageBucket::FULLY_MAPPED,
    ]);

    // Clean out any pre-existing finngen.runs rows carrying our fixture endpoint.
    DB::connection('finngen')->table('runs')
        ->whereRaw("params->>'endpoint_name' = ?", ['E4_DM2'])
        ->delete();
});

function seedGenerationRun(int $adminId, string $endpoint, string $source, string $analysisType, string $status, int $i): void
{
    DB::connection('finngen')->table('runs')->insert([
        'id' => '01GENHIS'.str_pad((string) $i, 18, '0', STR_PAD_LEFT),
        'user_id' => $adminId,
        'source_key' => $source,
        'analysis_type' => $analysisType,
        'params' => json_encode(['endpoint_name' => $endpoint]),
        'status' => $status,
        'summary' => json_encode(['subject_count' => 100 + $i]),
        'finished_at' => in_array($status, ['succeeded', 'failed', 'canceled'], true) ? now() : null,
        'created_at' => now()->subSeconds(1000 - $i),
        'updated_at' => now(),
    ]);
}

it('returns multiple runs per source', function () {
    for ($i = 0; $i < 3; $i++) {
        seedGenerationRun($this->admin->id, 'E4_DM2', 'PANCREAS', 'endpoint.generate', 'succeeded', $i);
    }

    $response = $this->actingAs($this->admin)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2');

    $response->assertStatus(200);
    $genRuns = $response->json('data.generation_runs');
    expect(is_array($genRuns))->toBeTrue();
    $pancreasOnly = array_filter($genRuns, fn ($r) => $r['source_key'] === 'PANCREAS');
    expect(count($pancreasOnly))->toBe(3);
});

it('caps generation_runs at 100 rows', function () {
    for ($i = 0; $i < 105; $i++) {
        seedGenerationRun($this->admin->id, 'E4_DM2', 'PANCREAS', 'endpoint.generate', 'succeeded', $i);
    }

    $response = $this->actingAs($this->admin)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2');

    $response->assertStatus(200);
    $genRuns = $response->json('data.generation_runs');
    expect(count($genRuns))->toBe(100);
});

it('excludes non-endpoint-generate analysis types from generation_runs', function () {
    // Two endpoint.generate + two gwas.regenie.step1 — only the generate ones should surface.
    seedGenerationRun($this->admin->id, 'E4_DM2', 'PANCREAS', 'endpoint.generate', 'succeeded', 0);
    seedGenerationRun($this->admin->id, 'E4_DM2', 'PANCREAS', 'endpoint.generate', 'succeeded', 1);
    seedGenerationRun($this->admin->id, 'E4_DM2', 'PANCREAS', 'gwas.regenie.step1', 'succeeded', 2);
    seedGenerationRun($this->admin->id, 'E4_DM2', 'PANCREAS', 'gwas.regenie.step2', 'succeeded', 3);

    $response = $this->actingAs($this->admin)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2');

    $response->assertStatus(200);
    $genRuns = $response->json('data.generation_runs');
    expect(count($genRuns))->toBe(2);
});
