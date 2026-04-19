<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

it('seeds at least 4000 FinnGen cross-walk rows in vocab.source_to_concept_map', function () {
    Artisan::call('migrate', ['--force' => true]);

    $count = DB::connection('vocab')->table('vocab.source_to_concept_map')
        ->whereIn('source_vocabulary_id', ['ICD8', 'ICDO3', 'NOMESCO', 'KELA_REIMB', 'ICD10_FIN', 'ICD9_FIN'])
        ->count();

    expect($count)->toBeGreaterThanOrEqual(4000);
})->skip(fn () => ! DB::connection('vocab')->getSchemaBuilder()->hasTable('source_to_concept_map'),
    'vocab.source_to_concept_map not present in this test environment');

it('grants SELECT on vocab.source_to_concept_map to parthenon_app per HIGHSEC §4.1', function () {
    $hasSelect = DB::connection('vocab')->selectOne(
        "SELECT has_table_privilege('parthenon_app', 'vocab.source_to_concept_map', 'SELECT') AS has_select"
    );
    expect($hasSelect->has_select)->toBeTrue();
})->skip(fn () => DB::connection('vocab')->selectOne("SELECT 1 AS r FROM pg_roles WHERE rolname='parthenon_app'") === null,
    'parthenon_app role not present in this test environment');

it('does not delete IRSF-NHS rows', function () {
    Artisan::call('migrate', ['--force' => true]);
    $irsfCount = DB::connection('vocab')->table('vocab.source_to_concept_map')
        ->where('source_vocabulary_id', 'IRSF-NHS')->count();
    expect($irsfCount)->toBe(121);
})->skip(fn () => ! DB::connection('vocab')->getSchemaBuilder()->hasTable('source_to_concept_map'),
    'vocab.source_to_concept_map not present in this test environment');
