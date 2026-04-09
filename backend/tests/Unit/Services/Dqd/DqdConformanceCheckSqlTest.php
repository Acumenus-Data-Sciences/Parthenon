<?php

use App\Services\Dqd\Checks\Conformance\ConformanceCheckFactory;
use App\Services\Dqd\Checks\Conformance\DateValidityCheck;
use App\Services\Dqd\Checks\Conformance\DomainConformanceCheck;
use App\Services\Dqd\Checks\Conformance\ForeignKeyCheck;
use App\Services\Dqd\Checks\Conformance\StandardConceptCheck;
use App\Services\Dqd\Checks\Conformance\TypeConceptValidCheck;

describe('DQD conformance check SQL contracts', function () {

    it('produces a foreign-key check that joins source to target on the FK columns', function () {
        $check = new ForeignKeyCheck(
            'condition_occurrence',
            'person_id',
            'person',
            'person_id',
            false,
            'Condition person_id must reference a valid person',
        );

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        expect($violated)
            ->toContain('LEFT JOIN cdm.person r')
            ->and($violated)->toContain('cdm.condition_occurrence t')
            ->and($violated)->toContain('t.person_id = r.person_id')
            ->and($violated)->toContain('r.person_id IS NULL');

        // Non-nullable FK: total query is unconditional COUNT(*)
        expect($total)->toContain('FROM cdm.condition_occurrence')
            ->and($total)->not->toContain('IS NOT NULL');

        expect($check->checkId())->toBe('conformance_fk_condition_occurrence_person_id')
            ->and($check->category())->toBe('conformance')
            ->and($check->subcategory())->toBe('foreignKey')
            ->and($check->cdmTable())->toBe('condition_occurrence')
            ->and($check->cdmColumn())->toBe('person_id')
            ->and($check->severity())->toBe('error');
    });

    it('excludes nulls from both queries when the FK column is nullable', function () {
        $check = new ForeignKeyCheck(
            'condition_occurrence',
            'visit_occurrence_id',
            'visit_occurrence',
            'visit_occurrence_id',
            true,
            'Condition visit_occurrence_id must reference a valid visit',
        );

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        // Violated query keeps the LEFT JOIN but adds NULL guard
        expect($violated)->toContain('LEFT JOIN cdm.visit_occurrence r')
            ->and($violated)->toContain('AND t.visit_occurrence_id IS NOT NULL');

        // Total query restricts to non-null FKs
        expect($total)->toContain('WHERE visit_occurrence_id IS NOT NULL');
    });

    it('produces a date validity check that respects null end dates', function () {
        $check = new DateValidityCheck(
            'visit_occurrence',
            'visit_start_date',
            'visit_end_date',
            'Visit start date must not be after end date',
        );

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        expect($violated)->toContain('FROM cdm.visit_occurrence')
            ->and($violated)->toContain('visit_end_date IS NOT NULL')
            ->and($violated)->toContain('visit_start_date > visit_end_date');

        // Total denominator is rows where end_date is populated
        expect($total)->toContain('FROM cdm.visit_occurrence')
            ->and($total)->toContain('visit_end_date IS NOT NULL');

        // Composite cdmColumn for two-column checks
        expect($check->cdmColumn())->toBe('visit_start_date,visit_end_date')
            ->and($check->subcategory())->toBe('dateValidity')
            ->and($check->checkId())->toBe('conformance_dateOrder_visit_occurrence_visit_start_date');
    });

    it('produces a domain conformance check that filters by expected concept domain', function () {
        $check = new DomainConformanceCheck(
            'condition_occurrence',
            'condition_concept_id',
            'Condition',
            'Condition concepts should belong to the Condition domain',
        );

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        expect($violated)->toContain('cdm.condition_occurrence t')
            ->and($violated)->toContain('JOIN vocab.concept c')
            ->and($violated)->toContain("c.domain_id != 'Condition'")
            ->and($violated)->toContain('t.condition_concept_id != 0')
            ->and($violated)->toContain('t.condition_concept_id IS NOT NULL');

        expect($total)->toContain('FROM cdm.condition_occurrence')
            ->and($total)->toContain('condition_concept_id != 0');

        expect($check->severity())->toBe('warning')
            ->and($check->threshold())->toBe(5.0)
            ->and($check->subcategory())->toBe('domainConformance');
    });

    it('produces a standard concept check that joins to the vocabulary concept table', function () {
        $check = new StandardConceptCheck(
            'measurement',
            'measurement_concept_id',
            'Measurement concept should be a standard concept',
        );

        $violated = $check->sqlViolated('cdm', 'vocab');

        expect($violated)->toContain('cdm.measurement t')
            ->and($violated)->toContain('JOIN vocab.concept c')
            ->and($violated)->toContain("c.standard_concept != 'S'")
            ->and($violated)->toContain('c.standard_concept IS NULL');

        expect($check->severity())->toBe('warning')
            ->and($check->threshold())->toBe(5.0)
            ->and($check->subcategory())->toBe('standardConcept')
            ->and($check->checkId())->toBe('conformance_standardConcept_measurement_measurement_concept_id');
    });

    it('produces a type concept validity check that flags missing vocabulary entries', function () {
        $check = new TypeConceptValidCheck(
            'drug_exposure',
            'drug_type_concept_id',
            'Drug type concept must exist in vocabulary',
        );

        $violated = $check->sqlViolated('cdm', 'vocab');
        $total = $check->sqlTotal('cdm', 'vocab');

        expect($violated)->toContain('LEFT JOIN vocab.concept c')
            ->and($violated)->toContain('c.concept_id IS NULL')
            ->and($violated)->toContain('cdm.drug_exposure t')
            ->and($violated)->toContain('t.drug_type_concept_id != 0');

        expect($total)->toContain('drug_type_concept_id != 0');

        expect($check->subcategory())->toBe('typeConceptValid')
            ->and($check->severity())->toBe('warning');
    });

    it('factory enumerates all six conformance check subcategories', function () {
        $checks = ConformanceCheckFactory::create();

        $subcategories = array_unique(array_map(fn ($c) => $c->subcategory(), $checks));
        sort($subcategories);

        expect($subcategories)->toBe([
            'conceptIdValid',
            'dateValidity',
            'domainConformance',
            'foreignKey',
            'standardConcept',
            'typeConceptValid',
        ]);

        // Every check id is unique
        $ids = array_map(fn ($c) => $c->checkId(), $checks);
        expect(count($ids))->toBe(count(array_unique($ids)));
    });
});
