<?php

use App\Models\Cdm\ConditionOccurrence;
use App\Models\Cdm\DrugExposure;
use App\Models\Cdm\Measurement;
use App\Models\Cdm\Observation;
use App\Models\Cdm\Person;
use App\Models\Cdm\ProcedureOccurrence;
use App\Models\Cdm\VisitOccurrence;
use Illuminate\Support\Facades\DB;

// The omop connection is read-only in production but NOT transaction-wrapped in
// tests (it is absent from the PDO-sibling/transacted connection sets), so a
// minimal CDM fixture must seed and clean up explicitly under a high sentinel id
// that can never collide with real data. If the omop schema is unwritable/absent
// (a read-only CI environment) the seed is skipped and the ->skip(count===0)
// guards below skip the two read tests gracefully.
const CDM_FIXTURE_ID = 999000001;

beforeEach(function () {
    try {
        $omop = DB::connection('omop');
        $omop->table('condition_occurrence')->where('condition_occurrence_id', CDM_FIXTURE_ID)->delete();
        $omop->table('person')->where('person_id', CDM_FIXTURE_ID)->delete();
        $omop->table('person')->insert([
            'person_id' => CDM_FIXTURE_ID,
            'gender_concept_id' => 8507,
            'year_of_birth' => 1990,
            'race_concept_id' => 0,
            'ethnicity_concept_id' => 0,
            'gender_source_concept_id' => 0,
            'race_source_concept_id' => 0,
            'ethnicity_source_concept_id' => 0,
        ]);
        $omop->table('condition_occurrence')->insert([
            'condition_occurrence_id' => CDM_FIXTURE_ID,
            'person_id' => CDM_FIXTURE_ID,
            'condition_concept_id' => 201826,
            'condition_start_date' => '2020-01-01',
            'condition_type_concept_id' => 32020,
            'condition_status_concept_id' => 0,
            'condition_source_concept_id' => 0,
        ]);
    } catch (Throwable) {
        // omop schema unwritable/absent — the read tests will skip on count===0.
    }
});

afterEach(function () {
    try {
        $omop = DB::connection('omop');
        $omop->table('condition_occurrence')->where('condition_occurrence_id', CDM_FIXTURE_ID)->delete();
        $omop->table('person')->where('person_id', CDM_FIXTURE_ID)->delete();
    } catch (Throwable) {
        // best-effort cleanup
    }
});

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

it('uses the omop database connection', function () {
    expect((new Person)->getConnectionName())->toBe('omop');
    expect((new ConditionOccurrence)->getConnectionName())->toBe('omop');
    expect((new DrugExposure)->getConnectionName())->toBe('omop');
    expect((new Measurement)->getConnectionName())->toBe('omop');
    expect((new Observation)->getConnectionName())->toBe('omop');
    expect((new ProcedureOccurrence)->getConnectionName())->toBe('omop');
    expect((new VisitOccurrence)->getConnectionName())->toBe('omop');
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
