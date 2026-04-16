<?php

declare(strict_types=1);

use App\Services\FinnGen\Dto\EndpointRow;
use App\Services\FinnGen\FinnGenXlsxReader;

function finngenSampleFixturePath(): string
{
    return realpath(__DIR__.'/../../../database/fixtures/finngen/sample_endpoints.xlsx') ?: '';
}

it('opens the sample fixture without error', function () {
    $reader = new FinnGenXlsxReader(finngenSampleFixturePath());
    expect($reader->estimateTotal())->toBeGreaterThan(0);
});

it('skips the banner row (row 2, NAME starting with #)', function () {
    $reader = new FinnGenXlsxReader(finngenSampleFixturePath());
    $rows = iterator_to_array($reader->rows(), false);
    foreach ($rows as $row) {
        expect($row->name)->not->toStartWith('#');
    }
});

it('yields EndpointRow DTOs for each real endpoint', function () {
    $reader = new FinnGenXlsxReader(finngenSampleFixturePath());
    $rows = iterator_to_array($reader->rows(), false);
    expect(count($rows))->toBeGreaterThanOrEqual(5)->toBeLessThanOrEqual(12);
    foreach ($rows as $row) {
        expect($row)->toBeInstanceOf(EndpointRow::class);
        expect($row->name)->not->toBe('');
    }
});

it('includes DEATH as a real endpoint (row 3, COD_ICD_10="ANY")', function () {
    $reader = new FinnGenXlsxReader(finngenSampleFixturePath());
    $deaths = array_values(array_filter(
        iterator_to_array($reader->rows(), false),
        fn (EndpointRow $r) => $r->name === 'DEATH',
    ));
    expect($deaths)->toHaveCount(1);
    expect($deaths[0]->cod_icd_10)->toBe('ANY');
});

it('every yielded row has non-empty name', function () {
    $reader = new FinnGenXlsxReader(finngenSampleFixturePath());
    foreach ($reader->rows() as $row) {
        expect($row->name)->not->toBe('')->not->toBeNull();
    }
});

it('parses tags as a list of strings from the TAGS column', function () {
    $reader = new FinnGenXlsxReader(finngenSampleFixturePath());
    $found = false;
    foreach ($reader->rows() as $row) {
        if ($row->tags !== []) {
            $found = true;
            foreach ($row->tags as $t) {
                expect($t)->toBeString();
            }
            break;
        }
    }
    expect($found)->toBeTrue('at least one sample row should have tags populated');
});
