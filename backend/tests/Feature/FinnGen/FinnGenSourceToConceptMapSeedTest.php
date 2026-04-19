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
    DB::connection('vocab')->table('vocab.source_to_concept_map')
        ->where('source_code', 'CI_IRSF_NHS_SENTINEL')
        ->where('source_vocabulary_id', 'IRSF-NHS')
        ->delete();

    DB::connection('vocab')->table('vocab.source_to_concept_map')->insert([
        'source_code' => 'CI_IRSF_NHS_SENTINEL',
        'source_concept_id' => 9_900_001,
        'source_vocabulary_id' => 'IRSF-NHS',
        'source_code_description' => 'CI sentinel for non-FinnGen STCM rows',
        'target_concept_id' => 9_900_002,
        'target_vocabulary_id' => 'SNOMED',
        'valid_start_date' => '1970-01-01',
        'valid_end_date' => '2099-12-31',
        'invalid_reason' => null,
    ]);

    $before = DB::connection('vocab')->table('vocab.source_to_concept_map')
        ->where('source_vocabulary_id', 'IRSF-NHS')
        ->count();

    Artisan::call('migrate', ['--force' => true]);

    $irsfCount = DB::connection('vocab')->table('vocab.source_to_concept_map')
        ->where('source_vocabulary_id', 'IRSF-NHS')->count();
    expect($irsfCount)->toBe($before);
})->skip(fn () => ! DB::connection('vocab')->getSchemaBuilder()->hasTable('source_to_concept_map'),
    'vocab.source_to_concept_map not present in this test environment');
