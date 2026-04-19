<?php

declare(strict_types=1);

use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    User::factory()->create([
        'email' => 'admin@acumenus.net',
        'name' => 'Test Admin',
    ]);
    EndpointDefinition::query()->delete();
    DB::connection('finngen')->table('endpoint_expressions_pre_phase13')->delete();
});

/**
 * Phase 13 `--overwrite` semantics (preserved through 13.1): a second
 * `finngen:import-endpoints --overwrite` run does NOT change the endpoint
 * row count; it replaces in place and snapshots the prior expression_json
 * into the rollback snapshot table.
 *
 * Rewritten for Phase 13.1 per Plan 13.1-04 Task 1:
 *   - Row-count assertion now targets `finngen.endpoint_definitions` via
 *     EndpointDefinition::count() (CONTEXT.md D-04 / D-10); Phase 13
 *     previously counted app.cohort_definitions WHERE domain='finngen-endpoint'.
 *   - Snapshot-table assertion targets finngen.endpoint_expressions_pre_phase13
 *     via the finngen connection (Plan 13.1-02 ALTER TABLE SET SCHEMA per
 *     CONTEXT.md D-01 / key_decisions §"Snapshot disposition").
 */
it('preserves endpoint_definitions row count when --overwrite is run twice', function () {
    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 10, '--no-solr-reindex' => true]);
    $countBefore = EndpointDefinition::count();

    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 10, '--overwrite' => true, '--no-solr-reindex' => true]);
    $countAfter = EndpointDefinition::count();

    expect($countAfter)->toBe($countBefore);
});

it('populates finngen.endpoint_expressions_pre_phase13 with one row per endpoint before overwrite', function () {
    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 5, '--no-solr-reindex' => true]);
    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 5, '--overwrite' => true, '--no-solr-reindex' => true]);

    $snapshotCount = DB::connection('finngen')->table('endpoint_expressions_pre_phase13')->count();
    expect($snapshotCount)->toBeGreaterThanOrEqual(5);
});
