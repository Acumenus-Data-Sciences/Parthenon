<?php

declare(strict_types=1);

use Database\Seeders\LabReferenceRangeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Yaml\Yaml;

uses(RefreshDatabase::class);

beforeEach(function () {
    DB::statement('CREATE SCHEMA IF NOT EXISTS vocab');
    DB::statement('CREATE TABLE IF NOT EXISTS vocab.concept (
        concept_id INTEGER PRIMARY KEY,
        concept_name VARCHAR(255),
        domain_id VARCHAR(20),
        vocabulary_id VARCHAR(20),
        concept_class_id VARCHAR(20),
        standard_concept CHAR(1),
        concept_code VARCHAR(50),
        valid_start_date DATE,
        valid_end_date DATE,
        invalid_reason VARCHAR(1)
    )');
    DB::table('vocab.concept')->insert([
        ['concept_id' => 3000963, 'concept_name' => 'Hemoglobin', 'domain_id' => 'Measurement',
            'vocabulary_id' => 'LOINC', 'concept_class_id' => 'Lab Test', 'standard_concept' => 'S',
            'concept_code' => '718-7', 'valid_start_date' => '2000-01-01', 'valid_end_date' => '2099-12-31', 'invalid_reason' => null],
        ['concept_id' => 8713, 'concept_name' => 'gram per deciliter', 'domain_id' => 'Unit',
            'vocabulary_id' => 'UCUM', 'concept_class_id' => 'Unit', 'standard_concept' => 'S',
            'concept_code' => 'g/dL', 'valid_start_date' => '2000-01-01', 'valid_end_date' => '2099-12-31', 'invalid_reason' => null],
    ]);
});

afterEach(function () {
    DB::statement('DROP SCHEMA IF EXISTS vocab CASCADE');
});

test('seeder loads YAML rows into curated table', function () {
    $yaml = [
        [
            'loinc' => '718-7',
            'unit_ucum' => 'g/dL',
            'ranges' => [
                ['sex' => 'M', 'age_low' => 18, 'age_high' => null, 'low' => 13.5, 'high' => 17.5],
                ['sex' => 'F', 'age_low' => 18, 'age_high' => null, 'low' => 12.0, 'high' => 15.5],
            ],
            'source_ref' => 'Mayo',
        ],
    ];
    $path = tempnam(sys_get_temp_dir(), 'lrr').'.yaml';
    file_put_contents($path, Yaml::dump($yaml));

    $seeder = new LabReferenceRangeSeeder;
    $seeder->setDataPath($path);
    $seeder->run();

    $rows = DB::table('lab_reference_range_curated')->get();

    expect($rows)->toHaveCount(2);
    expect((float) $rows->firstWhere('sex', 'M')->range_low)->toBe(13.5);
    expect((float) $rows->firstWhere('sex', 'F')->range_low)->toBe(12.0);
    expect((int) $rows->first()->measurement_concept_id)->toBe(3000963);
    expect((int) $rows->first()->unit_concept_id)->toBe(8713);

    unlink($path);
});

test('seeder is idempotent on re-run', function () {
    $yaml = [
        [
            'loinc' => '718-7',
            'unit_ucum' => 'g/dL',
            'ranges' => [
                ['sex' => 'M', 'age_low' => 18, 'age_high' => null, 'low' => 13.5, 'high' => 17.5],
            ],
            'source_ref' => 'Mayo',
        ],
    ];
    $path = tempnam(sys_get_temp_dir(), 'lrr').'.yaml';
    file_put_contents($path, Yaml::dump($yaml));

    $seeder = new LabReferenceRangeSeeder;
    $seeder->setDataPath($path);
    $seeder->run();
    $seeder->run();  // Second run — should not duplicate

    expect(DB::table('lab_reference_range_curated')->count())->toBe(1);

    unlink($path);
});

test('seeder fails loudly on unresolvable LOINC', function () {
    $yaml = [
        [
            'loinc' => '99999-9',
            'unit_ucum' => 'g/dL',
            'ranges' => [
                ['sex' => 'M', 'age_low' => 18, 'age_high' => null, 'low' => 13.5, 'high' => 17.5],
            ],
            'source_ref' => 'Mayo',
        ],
    ];
    $path = tempnam(sys_get_temp_dir(), 'lrr').'.yaml';
    file_put_contents($path, Yaml::dump($yaml));

    $seeder = new LabReferenceRangeSeeder;
    $seeder->setDataPath($path);

    expect(fn () => $seeder->run())
        ->toThrow(RuntimeException::class, 'Unresolvable LOINC code: 99999-9');

    unlink($path);
});

test('seeder fails loudly on unresolvable UCUM unit', function () {
    $yaml = [
        [
            'loinc' => '718-7',
            'unit_ucum' => 'bogus/unit',
            'ranges' => [
                ['sex' => 'M', 'age_low' => 18, 'age_high' => null, 'low' => 13.5, 'high' => 17.5],
            ],
            'source_ref' => 'Mayo',
        ],
    ];
    $path = tempnam(sys_get_temp_dir(), 'lrr').'.yaml';
    file_put_contents($path, Yaml::dump($yaml));

    $seeder = new LabReferenceRangeSeeder;
    $seeder->setDataPath($path);

    expect(fn () => $seeder->run())
        ->toThrow(RuntimeException::class, 'Unresolvable UCUM unit: bogus/unit');

    unlink($path);
});
