<?php

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\DocumentReferenceMapper;
use App\Services\Fhir\VocabularyLookupService;

it('maps a DocumentReference to an OMOP note row', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'pat1')->andReturn(42);
    $crosswalk->shouldReceive('lookupVisitId')->with('site', 'enc1')->andReturn(7);

    $mapper = new DocumentReferenceMapper($vocab, $crosswalk);

    $resource = [
        'resourceType' => 'DocumentReference',
        'subject' => ['reference' => 'Patient/pat1'],
        'context' => ['encounter' => [['reference' => 'Encounter/enc1']]],
        'date' => '2024-03-01T10:00:00Z',
        'type' => ['coding' => [['code' => '11506-3', 'display' => 'Progress note']]],
        'content' => [['attachment' => ['data' => base64_encode('Patient stable.')]]],
    ];

    $rows = $mapper->map($resource, 'site');

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['cdm_table'])->toBe('note');

    $data = $rows[0]['data'];
    expect($data['person_id'])->toBe(42)
        ->and($data['note_text'])->toBe('Patient stable.')
        ->and($data['note_date'])->toBe('2024-03-01')
        ->and($data['visit_occurrence_id'])->toBe(7)
        ->and($data['note_source_value'])->toBe('11506-3')
        ->and($data['note_title'])->toBe('Progress note');
});

it('returns [] when the patient has not been ingested', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'patX')->andReturn(null);

    $mapper = new DocumentReferenceMapper($vocab, $crosswalk);

    $rows = $mapper->map([
        'resourceType' => 'DocumentReference',
        'subject' => ['reference' => 'Patient/patX'],
    ], 'site');

    expect($rows)->toBe([]);
});

it('resourceType is DocumentReference', function () {
    $mapper = new DocumentReferenceMapper(
        Mockery::mock(VocabularyLookupService::class),
        Mockery::mock(CrosswalkService::class),
    );
    expect($mapper->resourceType())->toBe('DocumentReference');
});
