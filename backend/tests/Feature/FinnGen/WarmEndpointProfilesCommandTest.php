<?php

declare(strict_types=1);

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Services\FinnGen\Co2SchemaProvisioner;
use App\Services\FinnGen\EndpointExpressionHasher;
use App\Services\FinnGen\EndpointProfileDispatchService;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Support\Facades\DB;
use Mockery\MockInterface;
use Spatie\Permission\PermissionRegistrar;

/**
 * Phase 18 GENOMICS-09/10/11 — Feature test for finngen:warm-endpoint-profiles.
 *
 * Flipped GREEN by Plan 18-07 Task 1. Covers D-08 hybrid dispatch + D-11
 * 14-day warm signal + D-10 expression-hash invalidation. Follows the
 * Phase 14/17 test isolation precedent (NO RefreshDatabase — collides with
 * Phase 13.1 isolate_finngen_schema migration on replay).
 *
 * Scenarios:
 *   T1: 3 access-log rows → dispatches only the 2 stale ones (fresh cached row
 *       skipped).
 *   T2: --since=14d filters access-log rows older than the window.
 *   T3: --source=PANCREAS filters access-log rows from other sources.
 */
beforeEach(function (): void {
    $this->seed(FinnGenTestingSeeder::class);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    // Clean any leftover rows from prior runs — these tests share the
    // shared finngen.endpoint_profile_access table across the file.
    DB::connection('finngen')->table('endpoint_profile_access')->delete();

    // Provision the pancreas_co2_results schema so the warmer's cached-hash
    // lookup has real tables to query. Idempotent per D-09.
    app(Co2SchemaProvisioner::class)->provision('PANCREAS');
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_summary')->delete();
});

afterEach(function (): void {
    DB::connection('finngen')->table('endpoint_profile_access')->delete();
    DB::connection('pgsql')->table('pancreas_co2_results.endpoint_profile_summary')->delete();
    EndpointDefinition::query()
        ->whereIn('name', ['E4_FRESH', 'E4_STALE', 'E4_MISSING', 'E4_RECENT', 'E4_OLD', 'E4_DUAL'])
        ->delete();
});

/**
 * Helper — seeds a FULLY_MAPPED EndpointDefinition row with the given
 * qualifying_event_spec. The factory's default spec is `source_codes=[]` —
 * we override so the expression hash changes per endpoint.
 *
 * @param  array<string, mixed>  $expression
 */
function seedEndpointDefinition(string $name, array $expression): EndpointDefinition
{
    EndpointDefinition::query()->where('name', $name)->delete();

    return EndpointDefinition::factory()->create([
        'name' => $name,
        'longname' => $name,
        'description' => 'Plan 18-07 warmer fixture',
        'release' => 'df14',
        'coverage_profile' => CoverageProfile::UNIVERSAL,
        'coverage_bucket' => CoverageBucket::FULLY_MAPPED,
        'qualifying_event_spec' => $expression,
    ]);
}

/**
 * Helper — inserts a row into finngen.endpoint_profile_access with a
 * last_accessed_at N days ago. Access-log table PK is (endpoint_name,
 * source_key) so we allow repeat sources by varying endpoint_name.
 */
function seedAccessRow(string $endpointName, string $sourceKey, int $daysAgo = 1): void
{
    DB::connection('finngen')->table('endpoint_profile_access')->insert([
        'endpoint_name' => $endpointName,
        'source_key' => $sourceKey,
        'last_accessed_at' => now()->subDays($daysAgo),
        'access_count' => 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

/**
 * Helper — inserts a cached row into {source}_co2_results.endpoint_profile_summary
 * with the given expression_hash so the warmer's staleness check has
 * something to compare against. All NOT NULL columns must be populated.
 */
function seedSummaryCache(string $endpointName, string $sourceKey, string $hash): void
{
    $schema = strtolower($sourceKey).'_co2_results';
    DB::connection('pgsql')->table("{$schema}.endpoint_profile_summary")->insert([
        'endpoint_name' => $endpointName,
        'source_key' => $sourceKey,
        'expression_hash' => $hash,
        'subject_count' => 100,
        'death_count' => 10,
        'median_survival_days' => null,
        'age_at_death_mean' => null,
        'age_at_death_median' => null,
        'age_at_death_bins' => '[]',
        'universe_size' => 50,
        'min_subjects' => 20,
        'source_has_death_data' => true,
        'source_has_drug_data' => true,
        'run_id' => 'SMOKE'.str_pad((string) random_int(1, 999999), 21, '0', STR_PAD_LEFT),
        'computed_at' => now(),
    ]);
}

it('dispatches compute only for access-log entries whose cached row is stale or missing', function (): void {
    // D-11 warm-signal + D-10 hash invalidation.
    //
    // Arrange — 3 access-log rows on PANCREAS:
    //   E4_FRESH   — cached hash matches current           → no dispatch (skip)
    //   E4_STALE   — cached hash differs from current      → dispatch
    //   E4_MISSING — no cached row at all                  → dispatch
    $hasher = app(EndpointExpressionHasher::class);

    $freshExpr = ['resolved_concepts' => ['conditions_standard' => [1234]]];
    $staleExpr = ['resolved_concepts' => ['conditions_standard' => [5678]]];
    $missingExpr = ['resolved_concepts' => ['conditions_standard' => [9012]]];

    seedEndpointDefinition('E4_FRESH', $freshExpr);
    seedEndpointDefinition('E4_STALE', $staleExpr);
    seedEndpointDefinition('E4_MISSING', $missingExpr);

    seedAccessRow('E4_FRESH', 'PANCREAS');
    seedAccessRow('E4_STALE', 'PANCREAS');
    seedAccessRow('E4_MISSING', 'PANCREAS');

    seedSummaryCache('E4_FRESH', 'PANCREAS', $hasher->hash($freshExpr));
    seedSummaryCache('E4_STALE', 'PANCREAS', str_repeat('0', 64)); // intentionally wrong
    // E4_MISSING — intentionally no cache row

    $this->mock(EndpointProfileDispatchService::class, function (MockInterface $mock) {
        $mock->shouldReceive('dispatch')
            ->twice()
            ->andReturn(['run' => (object) ['id' => 'fake-run'], 'expression_hash' => 'deadbeef', 'endpoint_name' => 'x', 'source_key' => 'x', 'cohort_definition_id' => null]);
    });

    $this->artisan('finngen:warm-endpoint-profiles', [
        '--source' => 'PANCREAS',
        '--since' => '14d',
    ])
        ->expectsOutputToContain('Dispatched=2 skipped=1 errored=0')
        ->assertExitCode(0);
});

it('respects --since=14d window from finngen.endpoint_profile_access.last_accessed_at', function (): void {
    // Arrange — 2 access-log rows on PANCREAS:
    //   E4_RECENT — touched 7 days ago  (inside 14d window)  → dispatch
    //   E4_OLD    — touched 30 days ago (outside 14d window) → filtered by SQL
    seedEndpointDefinition('E4_RECENT', ['resolved_concepts' => ['conditions_standard' => [100]]]);
    seedEndpointDefinition('E4_OLD', ['resolved_concepts' => ['conditions_standard' => [200]]]);

    seedAccessRow('E4_RECENT', 'PANCREAS', daysAgo: 7);
    seedAccessRow('E4_OLD', 'PANCREAS', daysAgo: 30);
    // Neither has a cache → both would dispatch if both were in-window.

    $this->mock(EndpointProfileDispatchService::class, function (MockInterface $mock) {
        $mock->shouldReceive('dispatch')
            ->once()
            ->withArgs(function (int $userId, string $endpointName, array $input): bool {
                return $endpointName === 'E4_RECENT'
                    && ($input['source_key'] ?? null) === 'PANCREAS';
            })
            ->andReturn(['run' => (object) ['id' => 'fake-run'], 'expression_hash' => 'x', 'endpoint_name' => 'x', 'source_key' => 'x', 'cohort_definition_id' => null]);
    });

    $this->artisan('finngen:warm-endpoint-profiles', [
        '--source' => 'PANCREAS',
        '--since' => '14d',
    ])
        ->expectsOutputToContain('Dispatched=1')
        ->assertExitCode(0);
});

it('filters access-log rows by --source=PANCREAS and skips other sources', function (): void {
    // Arrange — 2 access-log rows for E4_DUAL: one PANCREAS, one ACUMENUS.
    // --source=PANCREAS must filter ACUMENUS out of the dispatch set.
    seedEndpointDefinition('E4_DUAL', ['resolved_concepts' => ['conditions_standard' => [300]]]);

    seedAccessRow('E4_DUAL', 'PANCREAS');
    seedAccessRow('E4_DUAL', 'ACUMENUS');
    // Neither has a cache → both would dispatch if --source were omitted.

    $this->mock(EndpointProfileDispatchService::class, function (MockInterface $mock) {
        $mock->shouldReceive('dispatch')
            ->once()
            ->withArgs(function (int $userId, string $endpointName, array $input): bool {
                return $endpointName === 'E4_DUAL'
                    && ($input['source_key'] ?? null) === 'PANCREAS';
            })
            ->andReturn(['run' => (object) ['id' => 'fake-run'], 'expression_hash' => 'x', 'endpoint_name' => 'x', 'source_key' => 'x', 'cohort_definition_id' => null]);
    });

    $this->artisan('finngen:warm-endpoint-profiles', [
        '--source' => 'PANCREAS',
        '--since' => '14d',
    ])
        ->expectsOutputToContain('Dispatched=1')
        ->assertExitCode(0);
});
