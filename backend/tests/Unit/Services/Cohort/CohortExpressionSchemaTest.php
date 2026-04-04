<?php

use App\Services\Cohort\CohortSqlCompiler;
use App\Services\Cohort\Schema\CohortExpressionSchema;

it('maps atlas inclusion rules into additional criteria during validation', function () {
    $schema = app(CohortExpressionSchema::class);

    $expression = [
        'ConceptSets' => [
            [
                'id' => 0,
                'name' => 'Type 2 diabetes mellitus',
                'expression' => ['items' => []],
            ],
            [
                'id' => 1,
                'name' => 'Essential hypertension',
                'expression' => ['items' => []],
            ],
        ],
        'PrimaryCriteria' => [
            'CriteriaList' => [
                ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
            ],
            'ObservationWindow' => ['PriorDays' => 365, 'PostDays' => 0],
        ],
        'InclusionRules' => [
            [
                'name' => 'Has hypertension diagnosis within 365 days prior to index',
                'expression' => [
                    'Type' => 'ALL',
                    'CriteriaList' => [[
                        'Criteria' => [
                            'ConditionOccurrence' => ['CodesetId' => 1, 'First' => false],
                        ],
                        'Occurrence' => ['Type' => 2, 'Count' => 1],
                    ]],
                    'DemographicCriteriaList' => [],
                    'Groups' => [],
                ],
            ],
        ],
    ];

    $normalized = $schema->validate($expression);

    expect($normalized['AdditionalCriteria'])->not->toBeNull();
    expect($normalized['AdditionalCriteria']['Type'])->toBe('ALL');
    expect($normalized['AdditionalCriteria']['Groups'])->toHaveCount(1);
    expect($normalized['AdditionalCriteria']['Groups'][0]['CriteriaList'][0]['Criteria']['ConditionOccurrence']['CodesetId'])
        ->toBe(1);
});

it('includes atlas inclusion rules in compiled cohort sql', function () {
    $compiler = app(CohortSqlCompiler::class);

    $expression = [
        'ConceptSets' => [
            [
                'id' => 0,
                'name' => 'Type 2 diabetes mellitus',
                'expression' => ['items' => []],
            ],
            [
                'id' => 1,
                'name' => 'Essential hypertension',
                'expression' => ['items' => []],
            ],
        ],
        'PrimaryCriteria' => [
            'CriteriaList' => [
                ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
            ],
            'ObservationWindow' => ['PriorDays' => 365, 'PostDays' => 0],
        ],
        'QualifiedLimit' => ['Type' => 'First'],
        'ExpressionLimit' => ['Type' => 'First'],
        'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 30],
        'InclusionRules' => [
            [
                'name' => 'Has hypertension diagnosis within 365 days prior to index',
                'expression' => [
                    'Type' => 'ALL',
                    'CriteriaList' => [[
                        'Criteria' => [
                            'ConditionOccurrence' => ['CodesetId' => 1, 'First' => false],
                        ],
                        'StartWindow' => [
                            'Start' => ['Days' => 365, 'Coeff' => -1],
                            'End' => ['Days' => 0, 'Coeff' => -1],
                        ],
                        'Occurrence' => ['Type' => 2, 'Count' => 1],
                    ]],
                    'DemographicCriteriaList' => [],
                    'Groups' => [],
                ],
            ],
        ],
    ];

    $sql = $compiler->preview($expression, 'cdm', 'vocab');

    expect($sql)->toContain('codesetId_1');
    expect($sql)->toContain('inclusion_rule_0');
    expect($sql)->toContain('COUNT(*) >= 1');
});

it('compiles zero-count inclusion rules with left join semantics', function () {
    $compiler = app(CohortSqlCompiler::class);

    $expression = [
        'ConceptSets' => [
            [
                'id' => 0,
                'name' => 'Type 2 diabetes mellitus',
                'expression' => ['items' => []],
            ],
            [
                'id' => 1,
                'name' => 'MACE',
                'expression' => ['items' => []],
            ],
        ],
        'PrimaryCriteria' => [
            'CriteriaList' => [
                ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
            ],
            'ObservationWindow' => ['PriorDays' => 365, 'PostDays' => 0],
        ],
        'InclusionRules' => [
            [
                'name' => 'No prior MACE event',
                'expression' => [
                    'Type' => 'ALL',
                    'CriteriaList' => [[
                        'Criteria' => [
                            'ConditionOccurrence' => ['CodesetId' => 1, 'First' => false],
                        ],
                        'StartWindow' => [
                            'Start' => ['Days' => 365, 'Coeff' => -1],
                            'End' => ['Days' => 0, 'Coeff' => -1],
                        ],
                        'Occurrence' => ['Type' => 0, 'Count' => 0],
                    ]],
                    'DemographicCriteriaList' => [],
                    'Groups' => [],
                ],
            ],
        ],
    ];

    $sql = $compiler->preview($expression, 'cdm', 'vocab');

    expect($sql)->toContain('LEFT JOIN cdm.condition_occurrence e ON qe.person_id = e.person_id');
    expect($sql)->toContain('COUNT(e.person_id) = 0');
});
