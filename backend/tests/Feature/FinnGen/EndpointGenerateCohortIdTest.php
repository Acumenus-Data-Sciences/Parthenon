<?php

declare(strict_types=1);

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\App\Source;
use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;

/**
 * Phase 13.2 D-09 — asserts `EndpointBrowserController::generate()` passes
 * `finngen_endpoint_generation_id` in the Run's params JSONB AND in the
 * 202 response body, and that `cohort_definition_id` remains null (the
 * R worker derives cohort_def_id = generation_id + OMOP_COHORT_ID_OFFSET).
 *
 * Single-contract test — legacy `cohort_definition_id`-backed dispatch is
 * out of scope per RESEARCH §Open Question 4. Non-FinnGen cohort
 * materialization is covered by its own controller tests (unrelated).
 */
uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FinnGenTestingSeeder::class);

    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();

    // Seed one endpoint with resolvable concepts so the generate controller
    // passes the "empty resolved_concepts" guard and a Run gets dispatched.
    // Use ::factory() pattern to stay consistent with EndpointBrowserFinngenSchemaTest.
    EndpointDefinition::factory()->create([
        'name' => 'TEST_ENDPOINT',
        'longname' => 'Test endpoint (Phase 13.2 D-09 fixture)',
        'description' => 'factory-built',
        'release' => 'df14',
        'coverage_profile' => CoverageProfile::UNIVERSAL,
        'coverage_bucket' => CoverageBucket::FULLY_MAPPED,
        'universal_pct' => 80.00,
        'total_tokens' => 10,
        'resolved_tokens' => 8,
        'tags' => ['finngen:df14'],
        'qualifying_event_spec' => [
            'resolved_concepts' => [
                'conditions_standard' => [201826],
                'drugs_standard' => [],
                'source_concept_ids' => [],
            ],
        ],
    ]);

    // PANCREAS source is seeded by FinnGenTestingSeeder; confirm presence.
    Source::query()->where('source_key', 'PANCREAS')->firstOrFail();
});

it('POST /endpoints/{name}/generate populates finngen_endpoint_generation_id in run params', function (): void {
    Bus::fake();

    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/TEST_ENDPOINT/generate', [
            'source_key' => 'PANCREAS',
        ]);

    $response->assertStatus(202);

    $generation = FinnGenEndpointGeneration::where('endpoint_name', 'TEST_ENDPOINT')
        ->where('source_key', 'PANCREAS')
        ->firstOrFail();
    expect($generation->id)->toBeGreaterThan(0);

    $run = Run::latest('id')->first();
    expect($run)->not->toBeNull();
    expect($run->params)->toHaveKey('finngen_endpoint_generation_id');
    expect($run->params)->toHaveKey('cohort_definition_id');
    expect($run->params['finngen_endpoint_generation_id'])->toBe($generation->id);
    expect($run->params['cohort_definition_id'])->toBeNull();
});

it('response payload exposes finngen_endpoint_generation_id and null cohort_definition_id', function (): void {
    Bus::fake();

    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/TEST_ENDPOINT/generate', [
            'source_key' => 'PANCREAS',
        ]);

    $response->assertStatus(202);
    $response->assertJsonPath('data.cohort_definition_id', null);
    $response->assertJsonPath('data.finngen_endpoint_generation_id', fn ($id) => is_int($id) && $id > 0);
});

it('generation row carries run_id backfill after dispatch', function (): void {
    Bus::fake();

    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/endpoints/TEST_ENDPOINT/generate', [
            'source_key' => 'PANCREAS',
        ]);

    $response->assertStatus(202);
    $generation = FinnGenEndpointGeneration::where('endpoint_name', 'TEST_ENDPOINT')
        ->where('source_key', 'PANCREAS')
        ->firstOrFail();
    expect($generation->run_id)->not->toBeNull();
    expect($generation->last_status)->not->toBeNull();
});
