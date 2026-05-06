<?php

declare(strict_types=1);

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Services\GIS\CohortGeographyService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

function cohortGeographyTestSource(): Source
{
    $source = new Source([
        'source_name' => 'OHDSI Acumenus CDM',
        'source_key' => 'ACUMENUS',
        'source_connection' => 'omop',
    ]);
    $source->id = 47;
    $source->setRelation('daimons', new Collection([
        new SourceDaimon(['daimon_type' => DaimonType::CDM->value, 'table_qualifier' => 'omop']),
        new SourceDaimon(['daimon_type' => DaimonType::Vocabulary->value, 'table_qualifier' => 'vocab']),
        new SourceDaimon(['daimon_type' => DaimonType::Results->value, 'table_qualifier' => 'results']),
    ]));

    return $source;
}

it('returns suppressed aggregate geography without patient identifiers', function (): void {
    $connection = Mockery::mock();
    DB::shouldReceive('connection')->with('gis')->andReturn($connection);
    $connection
        ->shouldReceive('select')
        ->once()
        ->with(
            Mockery::on(fn (string $sql): bool => str_contains($sql, 'results.cohort')
                && str_contains($sql, 'gis.patient_geography')
                && str_contains($sql, 'gis.geographic_location')),
            Mockery::on(fn (array $bindings): bool => $bindings[0] === 77 && $bindings[1] === 47),
        )
        ->andReturn([
            (object) [
                'geographic_location_id' => 101,
                'location_name' => 'Philadelphia, Pennsylvania',
                'fips' => '42101',
                'latitude' => 39.9526,
                'longitude' => -75.1652,
                'population' => 1600000,
                'area_sq_km' => 369.0,
                'geometry' => '{"type":"MultiPolygon","coordinates":[]}',
                'denominator' => 1000,
                'member_count' => null,
                'rate_per_1000' => null,
                'suppressed' => true,
                'total_selected' => 12,
                'geocoded_selected' => 9,
            ],
        ]);

    $result = (new CohortGeographyService)->aggregate(
        cohortGeographyTestSource(),
        'generated',
        77,
        'county',
    );

    expect($result['summary']['unknown_members'])->toBe(3);
    expect($result['features'][0])->not->toHaveKey('person_id');
    expect($result['features'][0]['member_count'])->toBeNull();
    expect($result['features'][0]['suppressed'])->toBeTrue();
});

it('rejects unsafe source schema identifiers', function (): void {
    $source = cohortGeographyTestSource();
    $source->setRelation('daimons', new Collection([
        new SourceDaimon(['daimon_type' => DaimonType::Results->value, 'table_qualifier' => 'results;drop']),
    ]));

    expect(fn () => (new CohortGeographyService)->aggregate($source, 'generated', 77))
        ->toThrow(RuntimeException::class);
});
