<?php

declare(strict_types=1);

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
});

it('enforces D-07 invariant: zero rows with coverage_bucket=UNMAPPED AND coverage_profile=universal', function () {
    Artisan::call('finngen:import-endpoints', ['--release' => 'df14', '--limit' => 50, '--overwrite' => true, '--no-solr-reindex' => true]);

    $violations = DB::selectOne("
        SELECT COUNT(*) AS n
        FROM finngen.endpoint_definitions
        WHERE coverage_bucket = 'UNMAPPED'
          AND coverage_profile = 'universal'
    ");

    expect((int) $violations->n)->toBe(0);
});
