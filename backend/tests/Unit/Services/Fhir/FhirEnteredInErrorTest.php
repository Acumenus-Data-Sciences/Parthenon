<?php

declare(strict_types=1);

use App\Services\Fhir\FhirDedupService;

it('detects top-level entered-in-error status', function () {
    expect(FhirDedupService::isEnteredInError([
        'resourceType' => 'Observation',
        'id' => 'obs-1',
        'status' => 'entered-in-error',
    ]))->toBeTrue();
});

it('detects Condition.verificationStatus entered-in-error coding', function () {
    expect(FhirDedupService::isEnteredInError([
        'resourceType' => 'Condition',
        'id' => 'cond-1',
        'verificationStatus' => [
            'coding' => [
                ['system' => 'http://terminology.hl7.org/CodeSystem/condition-ver-status', 'code' => 'entered-in-error'],
            ],
        ],
    ]))->toBeTrue();
});

it('detects AllergyIntolerance.verificationStatus entered-in-error coding', function () {
    expect(FhirDedupService::isEnteredInError([
        'resourceType' => 'AllergyIntolerance',
        'id' => 'allergy-1',
        'verificationStatus' => [
            'coding' => [
                ['system' => 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', 'code' => 'entered-in-error'],
            ],
        ],
    ]))->toBeTrue();
});

it('returns false for an active/normal resource', function () {
    expect(FhirDedupService::isEnteredInError([
        'resourceType' => 'Observation',
        'id' => 'obs-2',
        'status' => 'final',
    ]))->toBeFalse();

    expect(FhirDedupService::isEnteredInError([
        'resourceType' => 'Condition',
        'id' => 'cond-2',
        'verificationStatus' => [
            'coding' => [['code' => 'confirmed']],
        ],
    ]))->toBeFalse();

    // No status / no verificationStatus at all.
    expect(FhirDedupService::isEnteredInError([
        'resourceType' => 'Patient',
        'id' => 'pat-1',
    ]))->toBeFalse();
});
