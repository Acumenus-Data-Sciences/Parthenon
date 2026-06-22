<?php

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Mappers\CareTeamMapper;
use App\Services\Fhir\VocabularyLookupService;

it('maps a CareTeam to one care_team row plus a linked member row per participant', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'pat1')->andReturn(42);
    // Surrogate care_team_id allocated by the crosswalk (Option B: single-pass id resolution).
    $crosswalk->shouldReceive('resolveCareTeamId')->with('site', 'ct1')->andReturn(900);
    $crosswalk->shouldReceive('resolveProviderId')->with('site', 'prac9')->andReturn(55);
    $crosswalk->shouldReceive('resolveCareSiteId')->with('site', 'org3')->andReturn(77);

    $mapper = new CareTeamMapper($vocab, $crosswalk);

    $resource = [
        'resourceType' => 'CareTeam',
        'id' => 'ct1',
        'subject' => ['reference' => 'Patient/pat1'],
        'status' => 'active',
        'period' => ['start' => '2024-01-01', 'end' => '2024-12-31'],
        'participant' => [
            [
                'member' => ['reference' => 'Practitioner/prac9'],
                'role' => [['coding' => [['code' => 'doctor', 'display' => 'Primary Physician']]]],
            ],
            [
                'member' => ['reference' => 'Organization/org3'],
                'role' => [['coding' => [['code' => 'org', 'display' => 'Managing Org']]]],
            ],
        ],
    ];

    $rows = $mapper->map($resource, 'site');

    // 1 care_team row + 2 member rows.
    expect($rows)->toHaveCount(3);

    $teamRows = array_values(array_filter($rows, fn ($r) => $r['cdm_table'] === 'care_team'));
    $memberRows = array_values(array_filter($rows, fn ($r) => $r['cdm_table'] === 'care_team_member'));

    expect($teamRows)->toHaveCount(1)
        ->and($memberRows)->toHaveCount(2);

    // The care_team identity carries the resolved surrogate id and subject person.
    $team = $teamRows[0]['data'];
    expect($team['care_team_id'])->toBe(900)
        ->and($team['person_id'])->toBe(42)
        ->and($team['care_team_start_date'])->toBe('2024-01-01')
        ->and($team['care_team_end_date'])->toBe('2024-12-31')
        ->and($team['status'])->toBe('active');

    // Both members are linked to the care_team (never null).
    foreach ($memberRows as $m) {
        expect($m['data']['care_team_id'])->toBe(900)
            ->and($m['data']['role_concept_id'])->toBe(0);
    }

    // Practitioner participant → provider_id set, care_site_id null.
    $providerMember = $memberRows[0]['data'];
    expect($providerMember['provider_id'])->toBe(55)
        ->and($providerMember['care_site_id'])->toBeNull()
        ->and($providerMember['role_source_value'])->toBe('Primary Physician');

    // Organization participant → care_site_id set, provider_id null.
    $orgMember = $memberRows[1]['data'];
    expect($orgMember['care_site_id'])->toBe(77)
        ->and($orgMember['provider_id'])->toBeNull()
        ->and($orgMember['role_source_value'])->toBe('Managing Org');
});

it('returns [] when the CareTeam subject has not been ingested', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'patX')->andReturn(null);

    $mapper = new CareTeamMapper($vocab, $crosswalk);

    $rows = $mapper->map([
        'resourceType' => 'CareTeam',
        'id' => 'ctX',
        'subject' => ['reference' => 'Patient/patX'],
    ], 'site');

    expect($rows)->toBe([]);
});

it('emits only the care_team row when there are no participants', function () {
    $vocab = Mockery::mock(VocabularyLookupService::class);
    $crosswalk = Mockery::mock(CrosswalkService::class);
    $crosswalk->shouldReceive('lookupPersonId')->with('site', 'pat1')->andReturn(42);
    $crosswalk->shouldReceive('resolveCareTeamId')->with('site', 'ct2')->andReturn(901);

    $mapper = new CareTeamMapper($vocab, $crosswalk);

    $rows = $mapper->map([
        'resourceType' => 'CareTeam',
        'id' => 'ct2',
        'subject' => ['reference' => 'Patient/pat1'],
        'status' => 'active',
    ], 'site');

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['cdm_table'])->toBe('care_team')
        ->and($rows[0]['data']['care_team_id'])->toBe(901);
});

it('resourceType is CareTeam', function () {
    $mapper = new CareTeamMapper(
        Mockery::mock(VocabularyLookupService::class),
        Mockery::mock(CrosswalkService::class),
    );
    expect($mapper->resourceType())->toBe('CareTeam');
});
