<?php

declare(strict_types=1);

use App\Enums\CohortDomain;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

it('populates coverage_profile on every finngen-endpoint row after re-import', function () {
    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 20, '--overwrite' => true, '--no-solr-reindex' => true]);

    $nullCount = DB::table('app.cohort_definitions')
        ->where('domain', CohortDomain::FINNGEN_ENDPOINT->value)
        ->whereNull('coverage_profile')
        ->count();

    expect($nullCount)->toBe(0);
});
