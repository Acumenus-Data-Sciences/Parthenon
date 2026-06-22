<?php

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\ServiceRequestMapper;
use App\Services\Fhir\VocabularyLookupService;

it('maps an active ordered ServiceRequest to a procedure_occurrence row', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $vocab->shouldReceive('resolve')->andReturn([
        'concept_id' => 4001,
        'source_value' => '1234',
        'source_concept_id' => 0,
    ]);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'pat1')->andReturn(42);

    $mapper = new ServiceRequestMapper($vocab, $crosswalk);

    $resource = [
        'resourceType' => 'ServiceRequest',
        'status' => 'active',
        'intent' => 'order',
        'subject' => ['reference' => 'Patient/pat1'],
        'code' => ['coding' => [['system' => 'http://www.ama-assn.org/go/cpt', 'code' => '1234']]],
        'authoredOn' => '2024-03-01T10:00:00Z',
    ];

    $rows = $mapper->map($resource, 'site');

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['cdm_table'])->toBe('procedure_occurrence');

    $data = $rows[0]['data'];
    expect($data['person_id'])->toBe(42)
        ->and($data['procedure_concept_id'])->toBe(4001)
        ->and($data['procedure_source_value'])->toBe('1234')
        ->and($data['procedure_date'])->toBe('2024-03-01');
});

it('returns [] for a non-actionable status', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);

    $mapper = new ServiceRequestMapper($vocab, $crosswalk);

    $rows = $mapper->map([
        'resourceType' => 'ServiceRequest',
        'status' => 'draft',
        'intent' => 'order',
        'subject' => ['reference' => 'Patient/pat1'],
    ], 'site');

    expect($rows)->toBe([]);
});

it('resourceType is ServiceRequest', function () {
    $mapper = new ServiceRequestMapper(
        Mockery::mock(VocabularyLookupService::class),
        Mockery::mock(CrosswalkService::class),
    );
    expect($mapper->resourceType())->toBe('ServiceRequest');
});
