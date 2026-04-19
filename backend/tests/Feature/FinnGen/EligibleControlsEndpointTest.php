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
 * Phase 15 Plan 08 — D-23 eligible-controls picker endpoint.
 *
 * Verifies GET /finngen/endpoints/{name}/eligible-controls?source_key=… :
 *   - source_key is required and regex-validated;
 *   - 100_000_000_000+ ids (FinnGen-offset cohorts) are excluded;
 *   - only cohorts with a succeeded generation on the selected source are
 *     returned;
 *   - response shape matches UI-SPEC (cohort_definition_id, name,
 *     subject_count, last_generated_at).
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

    DB::connection('pgsql')->statement('CREATE SCHEMA IF NOT EXISTS pancreas');
    DB::connection('pgsql')->statement('
        CREATE TABLE IF NOT EXISTS pancreas.cohort (
            cohort_definition_id BIGINT NOT NULL,
            subject_id BIGINT NOT NULL,
            cohort_start_date DATE NULL,
            cohort_end_date DATE NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    ');
    DB::connection('pgsql')->table('pancreas.cohort')->delete();

    // Clear any leftover cohort_definitions from prior tests at the ids we use.
    DB::connection('pgsql')->table('cohort_definitions')
        ->whereIn('id', [777, 778, 100_000_000_221])
        ->delete();
});

afterEach(function () {
    DB::connection('pgsql')->table('cohort_definitions')
        ->whereIn('id', [777, 778, 100_000_000_221])
        ->delete();
    DB::connection('pgsql')->statement('DROP TABLE IF EXISTS pancreas.cohort');
});

it('requires source_key query param', function () {
    $response = $this->actingAs($this->admin)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2/eligible-controls');

    $response->assertStatus(422);
});

it('excludes cohort ids in FinnGen offset range', function () {
    // Eligible cohort.
    DB::connection('pgsql')->table('cohort_definitions')->insert([
        'id' => 777,
        'name' => 'Eligible control',
        'author_id' => $this->admin->id,
        'domain' => 'cohort',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    // FinnGen-offset cohort — MUST be filtered out.
    DB::connection('pgsql')->table('cohort_definitions')->insert([
        'id' => 100_000_000_221,
        'name' => 'FinnGen-endpoint-backed cohort',
        'author_id' => $this->admin->id,
        'domain' => 'cohort',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    // Both have pancreas.cohort rows.
    DB::connection('pgsql')->table('pancreas.cohort')->insert([
        ['cohort_definition_id' => 777, 'subject_id' => 1, 'cohort_start_date' => '2020-01-01', 'cohort_end_date' => '2023-01-01'],
        ['cohort_definition_id' => 100_000_000_221, 'subject_id' => 2, 'cohort_start_date' => '2020-01-01', 'cohort_end_date' => '2023-01-01'],
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2/eligible-controls?source_key=PANCREAS');

    $response->assertStatus(200);
    $data = $response->json('data');
    $ids = array_column($data, 'cohort_definition_id');
    expect($ids)->toContain(777);
    expect($ids)->not->toContain(100_000_000_221);
});

it('only includes cohorts with a succeeded generation on the source', function () {
    // Cohort 777 has generation rows; cohort 778 has none — 778 is filtered out.
    DB::connection('pgsql')->table('cohort_definitions')->insert([
        ['id' => 777, 'name' => 'With gen', 'author_id' => $this->admin->id, 'domain' => 'cohort', 'created_at' => now(), 'updated_at' => now()],
        ['id' => 778, 'name' => 'No gen', 'author_id' => $this->admin->id, 'domain' => 'cohort', 'created_at' => now(), 'updated_at' => now()],
    ]);
    DB::connection('pgsql')->table('pancreas.cohort')->insert([
        ['cohort_definition_id' => 777, 'subject_id' => 1, 'cohort_start_date' => '2020-01-01', 'cohort_end_date' => '2023-01-01'],
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2/eligible-controls?source_key=PANCREAS');

    $response->assertStatus(200);
    $ids = array_column($response->json('data'), 'cohort_definition_id');
    expect($ids)->toContain(777);
    expect($ids)->not->toContain(778);
});

it('returns expected shape for an eligible cohort', function () {
    DB::connection('pgsql')->table('cohort_definitions')->insert([
        'id' => 777,
        'name' => 'Healthy controls PANCREAS',
        'author_id' => $this->admin->id,
        'domain' => 'cohort',
        'is_public' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    DB::connection('pgsql')->table('pancreas.cohort')->insert([
        ['cohort_definition_id' => 777, 'subject_id' => 1, 'cohort_start_date' => '2020-01-01', 'cohort_end_date' => '2023-01-01'],
        ['cohort_definition_id' => 777, 'subject_id' => 2, 'cohort_start_date' => '2020-01-01', 'cohort_end_date' => '2023-01-01'],
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson('/api/v1/finngen/endpoints/E4_DM2/eligible-controls?source_key=PANCREAS');

    $response->assertStatus(200);
    $data = $response->json('data');
    $row = collect($data)->firstWhere('cohort_definition_id', 777);
    expect($row)->not->toBeNull();
    expect($row)->toHaveKeys(['cohort_definition_id', 'name', 'subject_count', 'last_generated_at']);
    expect($row['subject_count'])->toBe(2);
    expect($row['name'])->toBe('Healthy controls PANCREAS');
});
