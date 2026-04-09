<?php

use App\Services\Cohort\Builders\CensoringBuilder;
use App\Services\Cohort\Builders\ConceptSetSqlBuilder;
use App\Services\Cohort\Builders\EndStrategyBuilder;
use App\Services\Cohort\Builders\OccurrenceFilterBuilder;
use App\Services\Cohort\Builders\RiskScoreCriteriaBuilder;
use App\Services\Cohort\Criteria\CriteriaBuilderRegistry;
use App\Services\Cohort\Schema\CohortExpressionSchema;

describe('OccurrenceFilterBuilder', function () {

    it('emits the correct comparator for each occurrence type', function () {
        $builder = new OccurrenceFilterBuilder;

        // Type 0 = exactly
        expect($builder->build(['Type' => 0, 'Count' => 0]))->toBe('COUNT(*) = 0');
        // Type 1 = at most
        expect($builder->build(['Type' => 1, 'Count' => 2]))->toBe('COUNT(*) <= 2');
        // Type 2 = at least (default)
        expect($builder->build(['Type' => 2, 'Count' => 3]))->toBe('COUNT(*) >= 3');
        // Default unknown type falls back to >=
        expect($builder->build(['Type' => 99, 'Count' => 4]))->toBe('COUNT(*) >= 4');

        // Null occurrence is treated as no filter
        expect($builder->build(null))->toBeNull();
    });

    it('wraps the predicate in a HAVING keyword via buildClause', function () {
        $builder = new OccurrenceFilterBuilder;

        expect($builder->buildClause(['Type' => 2, 'Count' => 1]))->toBe('HAVING COUNT(*) >= 1');
        expect($builder->buildClause(null))->toBe('');
    });

    it('flags zero-match occurrences as requiring a left join', function () {
        $builder = new OccurrenceFilterBuilder;

        // "exactly 0" or "at most N" both need persons-without-events preserved
        expect($builder->requiresLeftJoin(['Type' => 0, 'Count' => 0]))->toBeTrue();
        expect($builder->requiresLeftJoin(['Type' => 1, 'Count' => 5]))->toBeTrue();

        // "at least N" and "exactly N>0" can use semi-join
        expect($builder->requiresLeftJoin(['Type' => 2, 'Count' => 1]))->toBeFalse();
        expect($builder->requiresLeftJoin(['Type' => 0, 'Count' => 3]))->toBeFalse();
        expect($builder->requiresLeftJoin(null))->toBeFalse();
    });
});

describe('EndStrategyBuilder', function () {

    it('falls back to LEAST(end_date, op_end_date) when no strategy is provided', function () {
        $builder = new EndStrategyBuilder;

        $expr = $builder->build(null, 'ie.start_date', 'ie.end_date');

        expect($expr)->toBe('LEAST(ie.end_date, ie.op_end_date)');
    });

    it('honors a DateOffset DateField=StartDate with a non-zero offset', function () {
        $builder = new EndStrategyBuilder;

        $expr = $builder->build(
            ['DateOffset' => ['DateField' => 'StartDate', 'Offset' => 365]],
            'ie.start_date',
            'ie.end_date',
        );

        expect($expr)->toBe('LEAST(DATEADD(ie.start_date, 365), ie.op_end_date)');
    });

    it('skips DATEADD when offset is zero and uses the chosen DateField', function () {
        $builder = new EndStrategyBuilder;

        $expr = $builder->build(
            ['DateOffset' => ['DateField' => 'EndDate', 'Offset' => 0]],
            'ie.start_date',
            'ie.end_date',
        );

        expect($expr)->toBe('LEAST(ie.end_date, ie.op_end_date)');
    });

    it('uses the observation period end as the date base when requested', function () {
        $builder = new EndStrategyBuilder;

        $expr = $builder->build(
            ['DateOffset' => ['DateField' => 'ObservationPeriodEnd', 'Offset' => -7]],
            'ie.start_date',
            'ie.end_date',
        );

        expect($expr)->toBe('LEAST(DATEADD(ie.op_end_date, -7), ie.op_end_date)');
    });
});

describe('ConceptSetSqlBuilder', function () {

    it('builds a no-op CTE for an empty concept set', function () {
        $builder = new ConceptSetSqlBuilder;

        $ctes = $builder->build([
            ['id' => 7, 'expression' => ['items' => []]],
        ], 'vocab');

        expect($ctes)->toHaveCount(1)
            ->and($ctes[0])->toContain('codesetId_7 AS')
            ->and($ctes[0])->toContain('WHERE 1 = 0');
    });

    it('emits direct, descendant, and mapped expansions for an inline concept set', function () {
        $builder = new ConceptSetSqlBuilder;

        $ctes = $builder->build([
            [
                'id' => 0,
                'expression' => [
                    'items' => [
                        [
                            'concept' => ['CONCEPT_ID' => 201826],   // Type 2 diabetes
                            'includeDescendants' => true,
                            'includeMapped' => false,
                            'isExcluded' => false,
                        ],
                        [
                            'concept' => ['CONCEPT_ID' => 442793],   // related concept
                            'includeDescendants' => false,
                            'includeMapped' => true,
                            'isExcluded' => false,
                        ],
                    ],
                ],
            ],
        ], 'vocab');

        expect($ctes)->toHaveCount(1);
        $cte = $ctes[0];

        expect($cte)
            ->toContain('codesetId_0 AS MATERIALIZED')
            // Direct ids
            ->toContain('FROM vocab.concept WHERE concept_id IN (201826, 442793)')
            // Descendants via concept_ancestor (singular table — guarded by VocabTableNamingRegressionTest)
            ->toContain('FROM vocab.concept_ancestor ca')
            ->toContain('ca.ancestor_concept_id IN (201826)')
            // Mapped via concept_relationship (singular)
            ->toContain('FROM vocab.concept_relationship cr')
            ->toContain("cr.relationship_id = 'Maps to'");
    });

    it('subtracts excluded concepts via NOT IN', function () {
        $builder = new ConceptSetSqlBuilder;

        $ctes = $builder->build([
            [
                'id' => 1,
                'expression' => [
                    'items' => [
                        [
                            'concept' => ['CONCEPT_ID' => 100],
                            'includeDescendants' => false,
                            'includeMapped' => false,
                            'isExcluded' => false,
                        ],
                        [
                            'concept' => ['CONCEPT_ID' => 200],
                            'includeDescendants' => false,
                            'includeMapped' => false,
                            'isExcluded' => true,
                        ],
                    ],
                ],
            ],
        ], 'vocab');

        $cte = $ctes[0];

        expect($cte)->toContain('codesetId_1 AS MATERIALIZED')
            ->and($cte)->toContain('WHERE concept_id NOT IN');
    });
});

describe('CohortExpressionSchema validation negatives', function () {

    it('throws when PrimaryCriteria is missing entirely', function () {
        $schema = new CohortExpressionSchema;

        expect(fn () => $schema->validate(['ConceptSets' => []]))
            ->toThrow(InvalidArgumentException::class, 'PrimaryCriteria is required');
    });

    it('throws when a primary criterion lacks a domain key', function () {
        $schema = new CohortExpressionSchema;

        $expression = [
            'ConceptSets' => [],
            'PrimaryCriteria' => [
                'CriteriaList' => [
                    ['UnknownDomain' => ['CodesetId' => 1]],
                ],
                'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
            ],
        ];

        expect(fn () => $schema->validate($expression))
            ->toThrow(InvalidArgumentException::class, 'must contain one of');
    });

    it('throws when a primary criterion contains multiple domain keys', function () {
        $schema = new CohortExpressionSchema;

        $expression = [
            'ConceptSets' => [],
            'PrimaryCriteria' => [
                'CriteriaList' => [
                    [
                        'ConditionOccurrence' => ['CodesetId' => 0],
                        'DrugExposure' => ['CodesetId' => 1],
                    ],
                ],
                'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
            ],
        ];

        expect(fn () => $schema->validate($expression))
            ->toThrow(InvalidArgumentException::class, 'multiple domain keys');
    });

    it('rejects RiskScoreCriteria entries that omit operator and tier', function () {
        $schema = new CohortExpressionSchema;

        $expression = [
            'ConceptSets' => [],
            'PrimaryCriteria' => [
                'CriteriaList' => [
                    ['ConditionOccurrence' => ['CodesetId' => 0]],
                ],
                'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
            ],
            'RiskScoreCriteria' => [
                ['analysisId' => 7, 'scoreId' => 'chads_vasc'],
            ],
        ];

        expect(fn () => $schema->validate($expression))
            ->toThrow(InvalidArgumentException::class, 'must specify either');
    });

    it('returns the canonical list of domain keys via domainKeys()', function () {
        $schema = new CohortExpressionSchema;

        $keys = $schema->domainKeys();

        expect($keys)->toContain('ConditionOccurrence')
            ->and($keys)->toContain('DrugExposure')
            ->and($keys)->toContain('Death')
            ->and($keys)->toContain('VisitOccurrence');
    });

    it('extracts the first matching domain key from a criterion array', function () {
        $schema = new CohortExpressionSchema;

        $key = $schema->extractDomainKey([
            'Foo' => 1,
            'Measurement' => ['CodesetId' => 0],
        ]);

        expect($key)->toBe('Measurement');
        expect($schema->extractDomainKey(['Foo' => 1]))->toBeNull();
    });
});

describe('CensoringBuilder and RiskScoreCriteriaBuilder', function () {

    it('returns no CTEs and a null censoring expression for an empty censoring list', function () {
        $registry = new CriteriaBuilderRegistry;
        $schema = new CohortExpressionSchema;
        $builder = new CensoringBuilder($registry, $schema);

        $result = $builder->build([], 'cdm');

        expect($result['ctes'])->toBe([])
            ->and($result['censorExpr'])->toBeNull();
    });

    it('emits a censoring CTE per criterion plus a combined min-date CTE', function () {
        $registry = new CriteriaBuilderRegistry;
        $schema = new CohortExpressionSchema;
        $builder = new CensoringBuilder($registry, $schema);

        $result = $builder->build([
            ['ConditionOccurrence' => ['CodesetId' => 5]],
        ], 'cdm');

        expect($result['ctes'])->not->toBe([]);
        $allCteText = implode("\n", $result['ctes']);

        expect($allCteText)->toContain('censoring_0 AS')
            ->and($allCteText)->toContain('FROM cdm.condition_occurrence e')
            ->and($allCteText)->toContain('JOIN codesetId_5 cs')
            ->and($allCteText)->toContain('censoring_events AS')
            ->and($allCteText)->toContain('MIN(censoring_date)');

        // The censoring expression should adjust ie.end_date based on ce.censoring_date
        expect($result['censorExpr'])->toContain('ce.censoring_date < ie.end_date')
            ->and($result['censorExpr'])->toContain('ELSE ie.end_date');
    });

    it('builds risk score CTEs with operator and tier filter clauses', function () {
        $builder = new RiskScoreCriteriaBuilder;

        $result = $builder->build([
            [
                'analysisId' => 11,
                'scoreId' => 'chads_vasc',
                'operator' => 'gte',
                'value' => 2,
                'exclude' => false,
            ],
            [
                'analysisId' => 12,
                'scoreId' => 'charlson',
                'tier' => 'high',
                'exclude' => true,
            ],
        ]);

        expect($result['ctes'])->toHaveCount(2)
            ->and($result['filters'])->toBe([
                ['index' => 0, 'exclude' => false],
                ['index' => 1, 'exclude' => true],
            ]);

        $first = $result['ctes'][0];
        expect($first)->toContain('risk_score_filter_0 AS')
            ->and($first)->toContain("rspr.score_id = 'chads_vasc'")
            ->and($first)->toContain('rspr.score_value >= 2')
            ->and($first)->toContain('ae.analysis_id = 11')
            ->and($first)->toContain("ae.status = 'completed'");

        $second = $result['ctes'][1];
        expect($second)->toContain('risk_score_filter_1 AS')
            ->and($second)->toContain("rspr.risk_tier = 'high'");
    });
});
