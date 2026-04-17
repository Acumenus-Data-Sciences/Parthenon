<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

it('enforces D-07 invariant: zero rows with coverage_bucket=UNMAPPED AND coverage_profile=universal', function () {
    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 50, '--overwrite' => true, '--no-solr-reindex' => true]);

    $violations = DB::selectOne("
        SELECT COUNT(*) AS n
        FROM app.cohort_definitions
        WHERE expression_json->>'coverage_bucket' = 'UNMAPPED'
          AND coverage_profile = 'universal'
    ");

    expect((int) $violations->n)->toBe(0);
});
