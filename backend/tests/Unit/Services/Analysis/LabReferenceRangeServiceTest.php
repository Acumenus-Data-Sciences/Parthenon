<?php

declare(strict_types=1);

use App\DataTransferObjects\LabRangeDto;
use App\Services\Analysis\LabReferenceRangeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

// Concept ids — arbitrary values; no FK to vocab tables needed in unit tests.
const HGB_CONCEPT = 3000963;
const GDL_UNIT = 8713;
const SOURCE_ID = 1;

beforeEach(function () {
    // Seed a source row for tests that need it.
    // Uses the default connection (pgsql_testing in Pest).
    DB::table('sources')->insert([
        'id' => SOURCE_ID,
        'source_key' => 'test_source',
        'source_name' => 'Test Source',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
});

test('returns null when no curated or population rows exist', function () {
    $service = app(LabReferenceRangeService::class);

    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 40);

    expect($result)->toBeNull();
});

test('returns curated row when sex and age match', function () {
    DB::table('lab_reference_range_curated')->insert([
        'measurement_concept_id' => HGB_CONCEPT,
        'unit_concept_id' => GDL_UNIT,
        'sex' => 'F',
        'age_low' => 18,
        'age_high' => null,
        'range_low' => 12.0,
        'range_high' => 15.5,
        'source_ref' => 'Mayo',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $service = app(LabReferenceRangeService::class);

    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'F', 32);

    expect($result)->toBeInstanceOf(LabRangeDto::class);
    expect($result->low)->toBe(12.0);
    expect($result->high)->toBe(15.5);
    expect($result->source)->toBe('curated');
    expect($result->sourceRef)->toBe('Mayo');
});

test('prefers the narrowest matching curated band', function () {
    DB::table('lab_reference_range_curated')->insert([
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'M', 'age_low' => 18, 'age_high' => null,
            'range_low' => 13.0, 'range_high' => 18.0,
            'source_ref' => 'adult-unbounded', 'created_at' => now(), 'updated_at' => now(),
        ],
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'M', 'age_low' => 18, 'age_high' => 49,
            'range_low' => 13.5, 'range_high' => 17.5,
            'source_ref' => 'adult-18-49', 'created_at' => now(), 'updated_at' => now(),
        ],
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 40);

    expect($result->sourceRef)->toBe('adult-18-49');
    expect($result->low)->toBe(13.5);
});

test('sex-specific curated row beats sex=A row', function () {
    DB::table('lab_reference_range_curated')->insert([
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'A', 'age_low' => 18, 'age_high' => null,
            'range_low' => 12.0, 'range_high' => 18.0,
            'source_ref' => 'any', 'created_at' => now(), 'updated_at' => now(),
        ],
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'F', 'age_low' => 18, 'age_high' => null,
            'range_low' => 12.0, 'range_high' => 15.5,
            'source_ref' => 'female', 'created_at' => now(), 'updated_at' => now(),
        ],
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'F', 32);

    expect($result->sourceRef)->toBe('female');
});

test('falls through to population when no curated row matches', function () {
    DB::table('lab_reference_range_population')->insert([
        'source_id' => SOURCE_ID,
        'measurement_concept_id' => HGB_CONCEPT,
        'unit_concept_id' => GDL_UNIT,
        'range_low' => 10.5,
        'range_high' => 16.0,
        'median' => 13.2,
        'n_observations' => 5000,
        'computed_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 40);

    expect($result->source)->toBe('population');
    expect($result->low)->toBe(10.5);
    expect($result->nObservations)->toBe(5000);
});

test('age out of band falls through to next candidate', function () {
    DB::table('lab_reference_range_curated')->insert([
        'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
        'sex' => 'M', 'age_low' => 18, 'age_high' => 49,
        'range_low' => 13.5, 'range_high' => 17.5,
        'source_ref' => 'adult-18-49', 'created_at' => now(), 'updated_at' => now(),
    ]);
    DB::table('lab_reference_range_population')->insert([
        'source_id' => SOURCE_ID,
        'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
        'range_low' => 11.0, 'range_high' => 16.5,
        'median' => 13.0, 'n_observations' => 1000,
        'computed_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 70);

    expect($result->source)->toBe('population');
});

test('null unit_concept_id always returns null', function () {
    DB::table('lab_reference_range_curated')->insert([
        'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
        'sex' => 'M', 'age_low' => 18, 'age_high' => null,
        'range_low' => 13.5, 'range_high' => 17.5,
        'source_ref' => 'Mayo', 'created_at' => now(), 'updated_at' => now(),
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, null, 'M', 40);

    expect($result)->toBeNull();
});

test('null sex skips sex-specific curated rows', function () {
    DB::table('lab_reference_range_curated')->insert([
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'F', 'age_low' => 18, 'age_high' => null,
            'range_low' => 12.0, 'range_high' => 15.5,
            'source_ref' => 'female', 'created_at' => now(), 'updated_at' => now(),
        ],
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'A', 'age_low' => 18, 'age_high' => null,
            'range_low' => 11.0, 'range_high' => 17.0,
            'source_ref' => 'any', 'created_at' => now(), 'updated_at' => now(),
        ],
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, null, 40);

    expect($result->sourceRef)->toBe('any');
});

test('null age matches only rows with both age bounds null', function () {
    DB::table('lab_reference_range_curated')->insert([
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'M', 'age_low' => null, 'age_high' => null,
            'range_low' => 13.0, 'range_high' => 18.0,
            'source_ref' => 'unbanded', 'created_at' => now(), 'updated_at' => now(),
        ],
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'M', 'age_low' => 18, 'age_high' => 49,
            'range_low' => 13.5, 'range_high' => 17.5,
            'source_ref' => '18-49', 'created_at' => now(), 'updated_at' => now(),
        ],
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', null);

    expect($result->sourceRef)->toBe('unbanded');
});

test('lookupMany resolves multiple groups in one call', function () {
    DB::table('lab_reference_range_curated')->insert([
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'M', 'age_low' => 18, 'age_high' => null,
            'range_low' => 13.5, 'range_high' => 17.5,
            'source_ref' => 'Mayo', 'created_at' => now(), 'updated_at' => now(),
        ],
        [
            'measurement_concept_id' => 3004501, 'unit_concept_id' => 8840,   // Glucose, mg/dL
            'sex' => 'A', 'age_low' => 18, 'age_high' => null,
            'range_low' => 70.0, 'range_high' => 99.0,
            'source_ref' => 'Mayo', 'created_at' => now(), 'updated_at' => now(),
        ],
    ]);

    $service = app(LabReferenceRangeService::class);
    $results = $service->lookupMany(SOURCE_ID, [
        ['concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT],
        ['concept_id' => 3004501, 'unit_concept_id' => 8840],
        ['concept_id' => 99999, 'unit_concept_id' => 8840],  // no match
    ], 'M', 40);

    expect($results)->toHaveCount(3);
    expect($results[HGB_CONCEPT.':'.GDL_UNIT])->toBeInstanceOf(LabRangeDto::class);
    expect($results['3004501:8840'])->toBeInstanceOf(LabRangeDto::class);
    expect($results['99999:8840'])->toBeNull();
});

test('memoization returns cached result on repeat calls', function () {
    DB::table('lab_reference_range_curated')->insert([
        'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
        'sex' => 'M', 'age_low' => 18, 'age_high' => null,
        'range_low' => 13.5, 'range_high' => 17.5,
        'source_ref' => 'Mayo', 'created_at' => now(), 'updated_at' => now(),
    ]);

    $service = app(LabReferenceRangeService::class);

    DB::enableQueryLog();
    $first = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 40);
    $countAfterFirst = count(DB::getQueryLog());

    $second = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 40);
    $countAfterSecond = count(DB::getQueryLog());

    DB::disableQueryLog();

    expect($first)->toEqual($second);
    expect($countAfterSecond)->toBe($countAfterFirst);  // no new queries
});
