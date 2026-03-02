<?php

use App\Contracts\DqdCheckInterface;
use App\Services\Dqd\Checks\Completeness\CompletenessCheckFactory;
use App\Services\Dqd\Checks\Completeness\RequiredFieldCheck;
use App\Services\Dqd\Checks\Completeness\ValueCompletenessCheck;
use App\Services\Dqd\Checks\Completeness\NonZeroConceptCheck;
use App\Services\Dqd\Checks\Conformance\ConformanceCheckFactory;
use App\Services\Dqd\Checks\Conformance\ConceptIdValidCheck;
use App\Services\Dqd\Checks\Plausibility\PlausibilityCheckFactory;
use App\Services\Dqd\Checks\Plausibility\NoFutureDateCheck;

describe('DQD Check classes', function () {

    // ------------------------------------------------------------------
    // Factory creation tests
    // ------------------------------------------------------------------

    it('creates completeness checks from factory', function () {
        $checks = CompletenessCheckFactory::create();

        expect($checks)->toBeArray()
            ->and($checks)->not->toBeEmpty();

        // Every check must implement DqdCheckInterface
        foreach ($checks as $check) {
            expect($check)->toBeInstanceOf(DqdCheckInterface::class);
        }

        // Should contain RequiredFieldCheck, ValueCompletenessCheck, and NonZeroConceptCheck instances
        $hasRequired = false;
        $hasValue = false;
        $hasNonZero = false;
        foreach ($checks as $check) {
            if ($check instanceof RequiredFieldCheck) {
                $hasRequired = true;
            }
            if ($check instanceof ValueCompletenessCheck) {
                $hasValue = true;
            }
            if ($check instanceof NonZeroConceptCheck) {
                $hasNonZero = true;
            }
        }
        expect($hasRequired)->toBeTrue()
            ->and($hasValue)->toBeTrue()
            ->and($hasNonZero)->toBeTrue();

        // All checks should have 'completeness' category
        foreach ($checks as $check) {
            expect($check->category())->toBe('completeness');
        }
    });

    it('creates conformance checks from factory', function () {
        $checks = ConformanceCheckFactory::create();

        expect($checks)->toBeArray()
            ->and($checks)->not->toBeEmpty();

        foreach ($checks as $check) {
            expect($check)->toBeInstanceOf(DqdCheckInterface::class)
                ->and($check->category())->toBe('conformance');
        }

        // Should have at least concept validity checks
        $hasConceptValid = false;
        foreach ($checks as $check) {
            if ($check instanceof ConceptIdValidCheck) {
                $hasConceptValid = true;
                break;
            }
        }
        expect($hasConceptValid)->toBeTrue();
    });

    it('creates plausibility checks from factory', function () {
        $checks = PlausibilityCheckFactory::create();

        expect($checks)->toBeArray()
            ->and($checks)->not->toBeEmpty();

        foreach ($checks as $check) {
            expect($check)->toBeInstanceOf(DqdCheckInterface::class)
                ->and($check->category())->toBe('plausibility');
        }

        // Should have no-future-date checks
        $hasFutureDate = false;
        foreach ($checks as $check) {
            if ($check instanceof NoFutureDateCheck) {
                $hasFutureDate = true;
                break;
            }
        }
        expect($hasFutureDate)->toBeTrue();
    });

    // ------------------------------------------------------------------
    // SQL generation tests
    // ------------------------------------------------------------------

    it('generates valid SQL for required field check', function () {
        $check = new RequiredFieldCheck('person', 'person_id', 'Person ID must not be null');

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        // Violated query should check IS NULL
        expect($violated)->toContain('cdm.person')
            ->and($violated)->toContain('person_id IS NULL')
            ->and($violated)->toContain('COUNT');

        // Total query should count all rows
        expect($total)->toContain('cdm.person')
            ->and($total)->toContain('COUNT');

        // Check metadata
        expect($check->checkId())->toBe('completeness_required_person_person_id')
            ->and($check->category())->toBe('completeness')
            ->and($check->subcategory())->toBe('isRequired')
            ->and($check->cdmTable())->toBe('person')
            ->and($check->cdmColumn())->toBe('person_id')
            ->and($check->description())->toBe('Person ID must not be null');
    });

    it('generates valid SQL for concept validity check', function () {
        $check = new ConceptIdValidCheck('condition_occurrence', 'condition_concept_id', 'Condition concept_id must exist in vocabulary');

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        // Violated should join to concept table and find missing concept IDs
        expect($violated)->toContain('cdm.condition_occurrence')
            ->and($violated)->toContain('vocab.concept')
            ->and($violated)->toContain('LEFT JOIN')
            ->and($violated)->toContain('condition_concept_id')
            ->and($violated)->toContain('COUNT');

        // Total should count non-zero concept IDs
        expect($total)->toContain('cdm.condition_occurrence')
            ->and($total)->toContain('condition_concept_id != 0')
            ->and($total)->toContain('COUNT');

        // Check metadata
        expect($check->checkId())->toBe('conformance_conceptValid_condition_occurrence_condition_concept_id')
            ->and($check->category())->toBe('conformance')
            ->and($check->subcategory())->toBe('conceptIdValid')
            ->and($check->cdmTable())->toBe('condition_occurrence')
            ->and($check->cdmColumn())->toBe('condition_concept_id');
    });

    it('generates valid SQL for no future date check', function () {
        $check = new NoFutureDateCheck('measurement', 'measurement_date', 'Measurement date should not be in the future');

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        // Violated should check for dates after CURRENT_DATE
        expect($violated)->toContain('cdm.measurement')
            ->and($violated)->toContain('measurement_date')
            ->and($violated)->toContain('CURRENT_DATE')
            ->and($violated)->toContain('COUNT');

        // Total should count rows with non-null dates
        expect($total)->toContain('cdm.measurement')
            ->and($total)->toContain('measurement_date IS NOT NULL')
            ->and($total)->toContain('COUNT');

        // Check metadata
        expect($check->checkId())->toBe('plausibility_noFutureDate_measurement_measurement_date')
            ->and($check->category())->toBe('plausibility')
            ->and($check->subcategory())->toBe('temporalPlausibility')
            ->and($check->cdmTable())->toBe('measurement')
            ->and($check->cdmColumn())->toBe('measurement_date');
    });

    // ------------------------------------------------------------------
    // Severity levels
    // ------------------------------------------------------------------

    it('has correct severity levels', function () {
        // RequiredFieldCheck defaults to 'error' (from AbstractDqdCheck)
        $required = new RequiredFieldCheck('person', 'person_id', 'test');
        expect($required->severity())->toBe('error');

        // ValueCompletenessCheck overrides to 'warning'
        $value = new ValueCompletenessCheck('person', 'person_source_value', 'test', 5.0);
        expect($value->severity())->toBe('warning');

        // NonZeroConceptCheck overrides to 'warning'
        $nonZero = new NonZeroConceptCheck('condition_occurrence', 'condition_concept_id', 'test', 5.0);
        expect($nonZero->severity())->toBe('warning');

        // ConceptIdValidCheck is 'error'
        $conceptValid = new ConceptIdValidCheck('person', 'gender_concept_id', 'test');
        expect($conceptValid->severity())->toBe('error');

        // NoFutureDateCheck overrides to 'warning'
        $noFuture = new NoFutureDateCheck('visit_occurrence', 'visit_start_date', 'test');
        expect($noFuture->severity())->toBe('warning');
    });

    // ------------------------------------------------------------------
    // Threshold values
    // ------------------------------------------------------------------

    it('has correct threshold values', function () {
        // RequiredFieldCheck defaults to 0.0 (zero tolerance from AbstractDqdCheck)
        $required = new RequiredFieldCheck('person', 'person_id', 'test');
        expect($required->threshold())->toBe(0.0);

        // ValueCompletenessCheck accepts custom threshold
        $value = new ValueCompletenessCheck('measurement', 'value_as_number', 'test', 50.0);
        expect($value->threshold())->toBe(50.0);

        // NonZeroConceptCheck accepts custom threshold
        $nonZero = new NonZeroConceptCheck('person', 'gender_concept_id', 'test', 1.0);
        expect($nonZero->threshold())->toBe(1.0);

        // NoFutureDateCheck defaults to 0.0
        $noFutureDefault = new NoFutureDateCheck('condition_occurrence', 'condition_start_date', 'test');
        expect($noFutureDefault->threshold())->toBe(0.0);

        // NoFutureDateCheck with custom threshold
        $noFutureCustom = new NoFutureDateCheck('condition_occurrence', 'condition_end_date', 'test', 1.0);
        expect($noFutureCustom->threshold())->toBe(1.0);
    });
});
