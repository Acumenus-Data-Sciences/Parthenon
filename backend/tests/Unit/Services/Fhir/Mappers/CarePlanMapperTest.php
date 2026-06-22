<?php

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\CarePlanMapper;
use App\Services\Fhir\VocabularyLookupService;

it('maps a CarePlan to an OMOP care_plan row', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'pat1')->andReturn(42);
    $crosswalk->shouldReceive('lookupVisitId')->with('site', 'enc1')->andReturn(7);

    $mapper = new CarePlanMapper($vocab, $crosswalk);

    $resource = [
        'resourceType' => 'CarePlan',
        'subject' => ['reference' => 'Patient/pat1'],
        'encounter' => ['reference' => 'Encounter/enc1'],
        'period' => ['start' => '2024-01-01', 'end' => '2024-06-30'],
        'status' => 'active',
        'intent' => 'plan',
    ];

    $rows = $mapper->map($resource, 'site');

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['cdm_table'])->toBe('care_plan');

    $data = $rows[0]['data'];
    expect($data['person_id'])->toBe(42)
        ->and($data['care_plan_start_date'])->toBe('2024-01-01')
        ->and($data['care_plan_end_date'])->toBe('2024-06-30')
        ->and($data['visit_occurrence_id'])->toBe(7)
        ->and($data['care_plan_source_value'])->toBe('active|plan')
        ->and($data['status_concept_id'])->toBe(0)
        ->and($data['intent_concept_id'])->toBe(0)
        ->and($data['category_concept_id'])->toBe(0)
        ->and($data['care_plan_source_concept_id'])->toBe(0);
});

it('returns [] when the CarePlan subject has not been ingested', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'patX')->andReturn(null);

    $mapper = new CarePlanMapper($vocab, $crosswalk);

    $rows = $mapper->map([
        'resourceType' => 'CarePlan',
        'subject' => ['reference' => 'Patient/patX'],
    ], 'site');

    expect($rows)->toBe([]);
});

it('leaves visit_occurrence_id null when the CarePlan has no encounter', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'pat1')->andReturn(42);

    $mapper = new CarePlanMapper($vocab, $crosswalk);

    $rows = $mapper->map([
        'resourceType' => 'CarePlan',
        'subject' => ['reference' => 'Patient/pat1'],
        'status' => 'completed',
        'intent' => 'order',
    ], 'site');

    expect($rows[0]['data']['visit_occurrence_id'])->toBeNull()
        ->and($rows[0]['data']['care_plan_source_value'])->toBe('completed|order')
        ->and($rows[0]['data']['care_plan_start_date'])->toBeNull();
});

it('resourceType is CarePlan', function () {
    $mapper = new CarePlanMapper(
        Mockery::mock(VocabularyLookupService::class),
        Mockery::mock(CrosswalkService::class),
    );
    expect($mapper->resourceType())->toBe('CarePlan');
});
