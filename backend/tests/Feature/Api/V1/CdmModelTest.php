<?php

use App\Models\Cdm\ConditionOccurrence;
use App\Models\Cdm\DrugExposure;
use App\Models\Cdm\Measurement;
use App\Models\Cdm\Observation;
use App\Models\Cdm\Person;
use App\Models\Cdm\ProcedureOccurrence;
use App\Models\Cdm\VisitOccurrence;

it('throws RuntimeException on create attempt', function () {
    $person = new Person;
    $person->person_id = 999999999;
    $person->gender_concept_id = 8507;
    $person->year_of_birth = 1990;
    $person->race_concept_id = 0;
    $person->ethnicity_concept_id = 0;
    $person->save();
})->throws(RuntimeException::class, 'CDM models are read-only');

it('throws RuntimeException on update attempt', function () {
    $person = new Person;
    $person->exists = true;
    $person->person_id = 1;
    $person->year_of_birth = 2000;
    $person->save();
})->throws(RuntimeException::class, 'CDM models are read-only');

it('throws RuntimeException on delete attempt', function () {
    $person = new Person;
    $person->exists = true;
    $person->person_id = 1;
    $person->delete();
})->throws(RuntimeException::class, 'CDM models are read-only');

it('uses the cdm database connection', function () {
    expect((new Person)->getConnectionName())->toBe('cdm');
    expect((new ConditionOccurrence)->getConnectionName())->toBe('cdm');
    expect((new DrugExposure)->getConnectionName())->toBe('cdm');
    expect((new Measurement)->getConnectionName())->toBe('cdm');
    expect((new Observation)->getConnectionName())->toBe('cdm');
    expect((new ProcedureOccurrence)->getConnectionName())->toBe('cdm');
    expect((new VisitOccurrence)->getConnectionName())->toBe('cdm');
});

it('has timestamps disabled', function () {
    expect((new Person)->usesTimestamps())->toBeFalse();
    expect((new ConditionOccurrence)->usesTimestamps())->toBeFalse();
});

it('can read persons from CDM', function () {
    $count = Person::count();
    expect($count)->toBeGreaterThan(0);
})->skip(fn () => Person::count() === 0, 'No CDM data available in test database');

it('can read conditions from CDM', function () {
    $condition = ConditionOccurrence::first();
    expect($condition)->not->toBeNull();
    expect($condition->condition_concept_id)->toBeInt();
})->skip(fn () => ConditionOccurrence::count() === 0, 'No CDM data available in test database');
