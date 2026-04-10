<?php

use Illuminate\Support\Facades\DB;

beforeEach(function () {
    // Clean up any prior test data
    DB::table('lab_reference_range_population')->where('source_id', 99999)->delete();
    DB::table('source_daimons')->where('source_id', 99999)->delete();
    DB::table('sources')->where('id', 99999)->delete();

    // Seed a source with a CDM daimon pointing at testcdm schema
    DB::table('sources')->insert([
        'id' => 99999,
        'source_key' => 'testsource_refrange',
        'source_name' => 'Test Source RefRange',
        'source_dialect' => 'postgresql',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('source_daimons')->insert([
        'source_id' => 99999,
        'daimon_type' => 'cdm',
        'table_qualifier' => 'testcdm',
        'priority' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    // Create test schema + measurement table
    DB::statement('CREATE SCHEMA IF NOT EXISTS testcdm');
    DB::statement('CREATE TABLE IF NOT EXISTS testcdm.measurement (
        measurement_id BIGSERIAL PRIMARY KEY,
        measurement_concept_id INTEGER,
        unit_concept_id INTEGER,
        value_as_number NUMERIC
    )');
    DB::statement('TRUNCATE testcdm.measurement');

    // Insert 1000 Hgb values linearly from 10.0 to 18.0
    $rows = [];
    for ($i = 0; $i < 1000; $i++) {
        $rows[] = [
            'measurement_concept_id' => 3000963,
            'unit_concept_id' => 8713,
            'value_as_number' => round(10.0 + ($i / 999.0) * 8.0, 4),
        ];
    }
    foreach (array_chunk($rows, 500) as $chunk) {
        DB::table('testcdm.measurement')->insert($chunk);
    }
});

afterEach(function () {
    DB::table('lab_reference_range_population')->where('source_id', 99999)->delete();
    DB::table('source_daimons')->where('source_id', 99999)->delete();
    DB::table('sources')->where('id', 99999)->delete();
    DB::statement('DROP SCHEMA IF EXISTS testcdm CASCADE');
});

test('computes percentiles and writes to population table', function () {
    $this->artisan('labs:compute-reference-ranges', [
        '--source' => 'testsource_refrange',
        '--min-n' => 100,
    ])->assertExitCode(0);

    $row = DB::table('lab_reference_range_population')
        ->where('source_id', 99999)
        ->where('measurement_concept_id', 3000963)
        ->where('unit_concept_id', 8713)
        ->first();

    expect($row)->not->toBeNull();
    expect((float) $row->range_low)->toBeGreaterThanOrEqual(10.0)->toBeLessThanOrEqual(10.3);
    expect((float) $row->range_high)->toBeGreaterThanOrEqual(17.7)->toBeLessThanOrEqual(18.0);
    expect((float) $row->median)->toBeGreaterThanOrEqual(13.8)->toBeLessThanOrEqual(14.2);
    expect((int) $row->n_observations)->toBe(1000);
});

test('--min-n skips under-populated concepts', function () {
    $this->artisan('labs:compute-reference-ranges', [
        '--source' => 'testsource_refrange',
        '--min-n' => 5000,
    ])->assertExitCode(0);

    $count = DB::table('lab_reference_range_population')
        ->where('source_id', 99999)
        ->count();

    expect($count)->toBe(0);
});

test('--dry-run reports without writing', function () {
    $this->artisan('labs:compute-reference-ranges', [
        '--source' => 'testsource_refrange',
        '--dry-run' => true,
    ])->assertExitCode(0);

    $count = DB::table('lab_reference_range_population')
        ->where('source_id', 99999)
        ->count();

    expect($count)->toBe(0);
});

test('re-run overwrites computed_at', function () {
    $this->artisan('labs:compute-reference-ranges', [
        '--source' => 'testsource_refrange',
        '--min-n' => 100,
    ])->assertExitCode(0);

    $first = DB::table('lab_reference_range_population')
        ->where('source_id', 99999)
        ->where('measurement_concept_id', 3000963)
        ->first();

    sleep(1);

    $this->artisan('labs:compute-reference-ranges', [
        '--source' => 'testsource_refrange',
        '--min-n' => 100,
    ])->assertExitCode(0);

    $second = DB::table('lab_reference_range_population')
        ->where('source_id', 99999)
        ->where('measurement_concept_id', 3000963)
        ->first();

    // computed_at should have changed
    expect($second->computed_at)->not->toBe($first->computed_at);

    // Still only one row
    $count = DB::table('lab_reference_range_population')
        ->where('source_id', 99999)
        ->count();

    expect($count)->toBe(1);
});
