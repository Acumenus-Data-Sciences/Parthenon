<?php

declare(strict_types=1);

use App\Enums\CohortDomain;
use App\Models\App\CohortDefinition;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

it('preserves cohort_definitions row count when --overwrite is run twice', function () {
    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 10, '--no-solr-reindex' => true]);
    $countBefore = CohortDefinition::where('domain', CohortDomain::FINNGEN_ENDPOINT->value)->count();

    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 10, '--overwrite' => true, '--no-solr-reindex' => true]);
    $countAfter = CohortDefinition::where('domain', CohortDomain::FINNGEN_ENDPOINT->value)->count();

    expect($countAfter)->toBe($countBefore);
});

it('populates app.finngen_endpoint_expressions_pre_phase13 with one row per endpoint before overwrite', function () {
    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 5, '--no-solr-reindex' => true]);
    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 5, '--overwrite' => true, '--no-solr-reindex' => true]);

    $snapshotCount = DB::table('app.finngen_endpoint_expressions_pre_phase13')->count();
    expect($snapshotCount)->toBeGreaterThanOrEqual(5);
});
