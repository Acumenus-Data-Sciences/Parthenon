<?php

declare(strict_types=1);

use App\Models\App\FinnGen\EndpointDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;

uses(RefreshDatabase::class);

/**
 * Phase 13.2-06 update: FinnGen endpoints moved from
 * app.cohort_definitions to finngen.endpoint_definitions in Plan 13.1-02.
 * The D-07 invariant (no UNMAPPED-universal rows) now reads from the
 * EndpointDefinition model directly. coverage_bucket and coverage_profile
 * are first-class typed columns on the new schema.
 */
it('enforces D-07 invariant: zero rows with coverage_bucket=UNMAPPED AND coverage_profile=universal', function () {
    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 50, '--overwrite' => true, '--no-solr-reindex' => true]);

    $violations = EndpointDefinition::query()
        ->where('coverage_bucket', 'UNMAPPED')
        ->where('coverage_profile', 'universal')
        ->count();

    expect($violations)->toBe(0);
});
