<?php

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\CoverageMapper;
use App\Services\Fhir\VocabularyLookupService;

it('maps a Coverage to an OMOP payer_plan_period row', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'pat1')->andReturn(42);

    $mapper = new CoverageMapper($vocab, $crosswalk);

    $resource = [
        'resourceType' => 'Coverage',
        'beneficiary' => ['reference' => 'Patient/pat1'],
        'period' => ['start' => '2024-01-01', 'end' => '2024-12-31'],
        'payor' => [['display' => 'Acme Health']],
        'class' => [['type' => ['coding' => [['code' => 'plan']]], 'value' => 'Gold PPO']],
    ];

    $rows = $mapper->map($resource, 'site');

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['cdm_table'])->toBe('payer_plan_period');

    $data = $rows[0]['data'];
    expect($data['person_id'])->toBe(42)
        ->and($data['payer_plan_period_start_date'])->toBe('2024-01-01')
        ->and($data['payer_plan_period_end_date'])->toBe('2024-12-31')
        ->and($data['payer_source_value'])->toBe('Acme Health')
        ->and($data['plan_source_value'])->toBe('Gold PPO');
});

it('returns [] when the beneficiary has not been ingested', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'patX')->andReturn(null);

    $mapper = new CoverageMapper($vocab, $crosswalk);

    $rows = $mapper->map([
        'resourceType' => 'Coverage',
        'beneficiary' => ['reference' => 'Patient/patX'],
    ], 'site');

    expect($rows)->toBe([]);
});

it('resourceType is Coverage', function () {
    $mapper = new CoverageMapper(
        Mockery::mock(VocabularyLookupService::class),
        Mockery::mock(CrosswalkService::class),
    );
    expect($mapper->resourceType())->toBe('Coverage');
});
