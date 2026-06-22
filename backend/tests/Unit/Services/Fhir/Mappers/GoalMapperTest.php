<?php

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\GoalMapper;
use App\Services\Fhir\VocabularyLookupService;

it('maps a Goal to an OMOP care_goal row', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'pat1')->andReturn(42);

    $mapper = new GoalMapper($vocab, $crosswalk);

    $resource = [
        'resourceType' => 'Goal',
        'subject' => ['reference' => 'Patient/pat1'],
        'lifecycleStatus' => 'active',
        'description' => ['text' => 'Lower A1c below 7'],
        'startDate' => '2024-02-01',
    ];

    $rows = $mapper->map($resource, 'site');

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['cdm_table'])->toBe('care_goal');

    $data = $rows[0]['data'];
    expect($data['person_id'])->toBe(42)
        ->and($data['care_plan_id'])->toBeNull()
        ->and($data['lifecycle_status'])->toBe('active')
        ->and($data['goal_start_date'])->toBe('2024-02-01')
        ->and($data['goal_source_value'])->toBe('Lower A1c below 7')
        ->and($data['achievement_status_concept_id'])->toBe(0)
        ->and($data['goal_source_concept_id'])->toBe(0);
});

it('falls back to the coding display and target dueDate when description.text and startDate are absent', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'pat1')->andReturn(42);

    $mapper = new GoalMapper($vocab, $crosswalk);

    $rows = $mapper->map([
        'resourceType' => 'Goal',
        'subject' => ['reference' => 'Patient/pat1'],
        'lifecycleStatus' => 'completed',
        'description' => ['coding' => [['display' => 'Smoking cessation']]],
        'target' => [['dueDate' => '2024-03-15']],
    ], 'site');

    $data = $rows[0]['data'];
    expect($data['goal_source_value'])->toBe('Smoking cessation')
        ->and($data['goal_start_date'])->toBe('2024-03-15')
        ->and($data['lifecycle_status'])->toBe('completed');
});

it('returns [] when the Goal subject has not been ingested', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'patX')->andReturn(null);

    $mapper = new GoalMapper($vocab, $crosswalk);

    $rows = $mapper->map([
        'resourceType' => 'Goal',
        'subject' => ['reference' => 'Patient/patX'],
    ], 'site');

    expect($rows)->toBe([]);
});

it('resourceType is Goal', function () {
    $mapper = new GoalMapper(
        Mockery::mock(VocabularyLookupService::class),
        Mockery::mock(CrosswalkService::class),
    );
    expect($mapper->resourceType())->toBe('Goal');
});
