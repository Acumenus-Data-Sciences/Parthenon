<?php

use App\Services\Cohort\Criteria\ConditionCriteriaBuilder;
use App\Services\Cohort\Criteria\CriteriaBuilderRegistry;
use App\Services\Cohort\Criteria\DeathCriteriaBuilder;
use App\Services\Cohort\Criteria\DemographicCriteriaBuilder;
use App\Services\Cohort\Criteria\DrugCriteriaBuilder;

describe('CriteriaBuilderRegistry', function () {

    it('exposes all seven OMOP CDM domain criteria builders', function () {
        $registry = new CriteriaBuilderRegistry;

        $expected = [
            'ConditionOccurrence',
            'DrugExposure',
            'ProcedureOccurrence',
            'Measurement',
            'Observation',
            'VisitOccurrence',
            'Death',
        ];

        foreach ($expected as $key) {
            expect($registry->has($key))->toBeTrue("Missing builder for {$key}");
        }

        $keys = $registry->domainKeys();
        sort($keys);
        $expectedSorted = $expected;
        sort($expectedSorted);
        expect($keys)->toBe($expectedSorted);
    });

    it('throws when an unknown domain key is requested', function () {
        $registry = new CriteriaBuilderRegistry;

        expect(fn () => $registry->get('SpecimenOccurrence'))
            ->toThrow(InvalidArgumentException::class, "Unknown domain key 'SpecimenOccurrence'");
    });
});

describe('ConditionCriteriaBuilder::buildWhereClauses', function () {

    it('emits IN clauses for ConditionType plus stop reason and codeset clauses', function () {
        $builder = new ConditionCriteriaBuilder;

        $clauses = $builder->buildWhereClauses([
            'ConditionType' => [
                ['CONCEPT_ID' => 32020, 'CONCEPT_NAME' => 'EHR encounter diagnosis'],
                32817,
            ],
            'ConditionSourceConcept' => 42,
            'StopReason' => "Patient O'Brien stopped",
        ], 'e');

        // Concept list emitted as IN(...)
        expect($clauses)->toContain('e.condition_type_concept_id IN (32020, 32817)');

        // CodesetId clause references the codeset CTE
        expect($clauses)->toContain('e.condition_source_concept_id IN (SELECT concept_id FROM codesetId_42)');

        // Stop reason should be quoted with doubled-up apostrophes
        expect($clauses)->toContain("e.stop_reason = 'Patient O''Brien stopped'");
    });

    it('reports CDM column metadata used by primary criteria builder', function () {
        $builder = new ConditionCriteriaBuilder;

        expect($builder->domainKey())->toBe('ConditionOccurrence')
            ->and($builder->cdmTable())->toBe('condition_occurrence')
            ->and($builder->conceptIdColumn())->toBe('condition_concept_id')
            ->and($builder->startDateColumn())->toBe('condition_start_date')
            ->and($builder->endDateColumn())->toBe('condition_end_date')
            ->and($builder->personIdColumn())->toBe('person_id');
    });
});

describe('DrugCriteriaBuilder numeric range filters', function () {

    it('builds a between clause for DaysSupply with extent and a gte for Quantity', function () {
        $builder = new DrugCriteriaBuilder;

        $clauses = $builder->buildWhereClauses([
            'DaysSupply' => ['Op' => 'bt', 'Value' => 7, 'Extent' => 30],
            'Quantity' => ['Op' => 'gte', 'Value' => 10],
            'Refills' => ['Op' => 'lt', 'Value' => 3],
        ], 'e');

        expect($clauses)->toContain('e.days_supply BETWEEN 7 AND 30')
            ->and($clauses)->toContain('e.quantity >= 10')
            ->and($clauses)->toContain('e.refills < 3');
    });

    it('skips numeric ranges when the operator or value is missing', function () {
        $builder = new DrugCriteriaBuilder;

        $clauses = $builder->buildWhereClauses([
            'DaysSupply' => ['Op' => 'gt'],     // missing value
            'Quantity' => ['Value' => 10],      // missing op
        ], 'e');

        expect($clauses)->toBe([]);
    });
});

describe('DeathCriteriaBuilder', function () {

    it('returns null for endDateColumn since death has no end date', function () {
        $builder = new DeathCriteriaBuilder;

        expect($builder->endDateColumn())->toBeNull()
            ->and($builder->startDateColumn())->toBe('death_date')
            ->and($builder->conceptIdColumn())->toBe('cause_concept_id')
            ->and($builder->cdmTable())->toBe('death');
    });

    it('builds DeathType IN list and DeathSourceConcept codeset reference', function () {
        $builder = new DeathCriteriaBuilder;

        $clauses = $builder->buildWhereClauses([
            'DeathType' => [32815],
            'DeathSourceConcept' => 9,
        ], 'e');

        expect($clauses)->toContain('e.death_type_concept_id IN (32815)')
            ->and($clauses)->toContain('e.cause_source_concept_id IN (SELECT concept_id FROM codesetId_9)');
    });
});

describe('DemographicCriteriaBuilder::buildWhereClauses', function () {

    it('combines age range, gender, race, and ethnicity into AND-able clauses', function () {
        $builder = new DemographicCriteriaBuilder;

        $clauses = $builder->buildWhereClauses(
            [
                [
                    'Age' => ['Op' => 'bt', 'Value' => 18, 'Extent' => 65],
                    'Gender' => [['CONCEPT_ID' => 8532]],         // female
                    'Race' => [8527],                              // white
                    'Ethnicity' => [38003564],                     // not hispanic
                ],
            ],
            'p',
            'qe.start_date',
        );

        // Age expression is computed from year_of_birth
        expect($clauses)->toContain('(EXTRACT(YEAR FROM qe.start_date) - p.year_of_birth) BETWEEN 18 AND 65')
            ->and($clauses)->toContain('p.gender_concept_id IN (8532)')
            ->and($clauses)->toContain('p.race_concept_id IN (8527)')
            ->and($clauses)->toContain('p.ethnicity_concept_id IN (38003564)');
    });

    it('returns no clauses for an empty demographic criteria array', function () {
        $builder = new DemographicCriteriaBuilder;

        expect($builder->buildWhereClauses([], 'p', 'qe.start_date'))->toBe([]);
    });
});
