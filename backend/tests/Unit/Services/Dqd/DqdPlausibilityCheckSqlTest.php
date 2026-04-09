<?php

use App\Services\Dqd\Checks\Plausibility\AgeRangeCheck;
use App\Services\Dqd\Checks\Plausibility\EventAfterBirthCheck;
use App\Services\Dqd\Checks\Plausibility\EventAfterDeathCheck;
use App\Services\Dqd\Checks\Plausibility\GenderSpecificCheck;
use App\Services\Dqd\Checks\Plausibility\ObservationPeriodBoundsCheck;
use App\Services\Dqd\Checks\Plausibility\PlausibilityCheckFactory;
use App\Services\Dqd\Checks\Plausibility\PositiveValueCheck;

describe('DQD plausibility check SQL contracts', function () {

    it('flags person rows with implausible age via the age range check', function () {
        $check = new AgeRangeCheck;

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        expect($violated)->toContain('FROM cdm.person')
            ->and($violated)->toContain('year_of_birth IS NOT NULL')
            ->and($violated)->toContain('EXTRACT(YEAR FROM CURRENT_DATE) - year_of_birth > 130')
            ->and($violated)->toContain('year_of_birth > EXTRACT(YEAR FROM CURRENT_DATE)');

        expect($total)->toContain('FROM cdm.person')
            ->and($total)->toContain('year_of_birth IS NOT NULL');

        expect($check->checkId())->toBe('plausibility_ageRange_person_year_of_birth')
            ->and($check->severity())->toBe('error')
            ->and($check->threshold())->toBe(0.0)
            ->and($check->subcategory())->toBe('plausibleValueRange');
    });

    it('compares event date to year_of_birth via EXTRACT in the EventAfterBirthCheck', function () {
        $check = new EventAfterBirthCheck(
            'condition_occurrence',
            'condition_start_date',
            'Conditions should not occur before person birth year',
        );

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        expect($violated)->toContain('cdm.condition_occurrence e')
            ->and($violated)->toContain('JOIN cdm.person p ON e.person_id = p.person_id')
            ->and($violated)->toContain('EXTRACT(YEAR FROM e.condition_start_date) < p.year_of_birth')
            ->and($violated)->toContain('p.year_of_birth IS NOT NULL');

        expect($total)->toContain('FROM cdm.condition_occurrence')
            ->and($total)->toContain('condition_start_date IS NOT NULL');

        expect($check->checkId())->toBe('plausibility_afterBirth_condition_occurrence_condition_start_date')
            ->and($check->subcategory())->toBe('temporalPlausibility');
    });

    it('joins death and event tables in the EventAfterDeathCheck', function () {
        $check = new EventAfterDeathCheck(
            'drug_exposure',
            'drug_exposure_start_date',
            'Drug exposures should not occur after person death date',
        );

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        expect($violated)->toContain('cdm.drug_exposure e')
            ->and($violated)->toContain('JOIN cdm.death d ON e.person_id = d.person_id')
            ->and($violated)->toContain('e.drug_exposure_start_date > d.death_date');

        // Total denominator restricts to persons with a death record
        expect($total)->toContain('JOIN cdm.death d')
            ->and($total)->toContain('drug_exposure_start_date IS NOT NULL');

        expect($check->cdmTable())->toBe('drug_exposure')
            ->and($check->cdmColumn())->toBe('drug_exposure_start_date');
    });

    it('uses concept class metadata to detect gender-specific concepts in the wrong gender', function () {
        $check = new GenderSpecificCheck(
            'condition_occurrence',
            'condition_concept_id',
            8507,                    // 8507 = Male
            'male',
            'Female Disease',
            'Female-specific conditions should not appear in male patients',
        );

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        expect($violated)->toContain('cdm.condition_occurrence e')
            ->and($violated)->toContain('JOIN cdm.person p ON e.person_id = p.person_id')
            ->and($violated)->toContain('JOIN vocab.concept c')
            ->and($violated)->toContain("c.concept_class_id = 'Female Disease'")
            ->and($violated)->toContain('p.gender_concept_id = 8507');

        expect($total)->toContain("c.concept_class_id = 'Female Disease'")
            ->and($total)->toContain('JOIN vocab.concept c');

        expect($check->checkId())->toBe('plausibility_genderSpecific_condition_occurrence_male')
            ->and($check->severity())->toBe('warning')
            ->and($check->threshold())->toBe(1.0)
            ->and($check->subcategory())->toBe('plausibleGender');
    });

    it('uses LEFT JOIN to observation_period to find out-of-window events', function () {
        $check = new ObservationPeriodBoundsCheck(
            'measurement',
            'measurement_date',
            'Measurements should fall within an observation period',
        );

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        expect($violated)->toContain('cdm.measurement e')
            ->and($violated)->toContain('LEFT JOIN cdm.observation_period op')
            ->and($violated)->toContain('e.measurement_date >= op.observation_period_start_date')
            ->and($violated)->toContain('e.measurement_date <= op.observation_period_end_date')
            ->and($violated)->toContain('op.person_id IS NULL');

        expect($total)->toContain('FROM cdm.measurement');

        expect($check->severity())->toBe('warning')
            ->and($check->threshold())->toBe(5.0)
            ->and($check->subcategory())->toBe('observationPeriodBounds');
    });

    it('flags non-positive numeric values via PositiveValueCheck and honors a custom threshold', function () {
        $check = new PositiveValueCheck(
            'drug_exposure',
            'days_supply',
            'Drug days_supply should be positive when present',
            2.5,
        );

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        expect($violated)->toContain('FROM cdm.drug_exposure')
            ->and($violated)->toContain('days_supply IS NOT NULL')
            ->and($violated)->toContain('days_supply <= 0');

        expect($total)->toContain('FROM cdm.drug_exposure')
            ->and($total)->toContain('days_supply IS NOT NULL');

        expect($check->threshold())->toBe(2.5)
            ->and($check->severity())->toBe('warning')
            ->and($check->subcategory())->toBe('plausibleValueRange');
    });

    it('factory produces every plausibility subcategory and unique check ids', function () {
        $checks = PlausibilityCheckFactory::create();

        $subcategories = array_unique(array_map(fn ($c) => $c->subcategory(), $checks));
        sort($subcategories);

        expect($subcategories)->toBe([
            'observationPeriodBounds',
            'plausibleGender',
            'plausibleValueRange',
            'temporalPlausibility',
        ]);

        $ids = array_map(fn ($c) => $c->checkId(), $checks);
        expect(count($ids))->toBe(count(array_unique($ids)));

        // Sanity: factory must include the AgeRangeCheck and at least one of every gender concept
        expect(count($checks))->toBeGreaterThanOrEqual(20);
    });
});
