<?php

use App\Exceptions\AiProviderNotConfiguredException;
use App\Services\AI\AnalyticsLlmService;
use App\Services\PatientSimilarity\CohortSimilarityInterpretationService;

function cohortSimilarityInterpretationResult(): array
{
    return [
        'source_cohort' => [
            'cohort_definition_id' => 83,
            'name' => 'Target',
            'member_count' => 1000,
            'dimensions' => ['conditions' => ['coverage' => 0.92]],
        ],
        'target_cohort' => [
            'cohort_definition_id' => 84,
            'name' => 'Comparator',
            'member_count' => 850,
            'dimensions' => ['conditions' => ['coverage' => 0.88]],
        ],
        'overall_divergence' => 0.37,
        'divergence' => [
            'conditions' => ['score' => 0.42, 'label' => 'moderate'],
            'drugs' => ['score' => 0.21, 'label' => 'low'],
        ],
        'covariates' => [
            ['covariate' => 'Chronic kidney disease', 'smd' => 0.27, 'type' => 'binary', 'domain' => 'condition'],
            ['covariate' => 'Age bucket', 'smd' => -0.14, 'type' => 'continuous', 'domain' => 'demographics'],
        ],
        'person_id' => 123,
        'points' => [
            ['person_id' => 123, 'x' => 1, 'y' => 1],
        ],
    ];
}

it('summarizes step data without patient-level fields', function () {
    $service = new CohortSimilarityInterpretationService(Mockery::mock(AnalyticsLlmService::class));

    $summary = $service->summarizeResultForStep('balance', cohortSimilarityInterpretationResult());

    expect($summary['covariate_count'])->toBe(2)
        ->and($summary['imbalanced_covariates'])->toBe(2)
        ->and($summary['high_imbalance_covariates'])->toBe(1)
        ->and(json_encode($summary))->not->toContain('person_id')
        ->and(json_encode($summary))->not->toContain('points');
});

it('builds an aggregate-only interpretation prompt', function () {
    $service = new CohortSimilarityInterpretationService(Mockery::mock(AnalyticsLlmService::class));

    $prompt = $service->buildPrompt(
        mode: 'compare',
        stepId: 'profile',
        result: $service->summarizeResultForStep('profile', cohortSimilarityInterpretationResult()),
        context: ['source_id' => 47],
        priorStepSummaries: [['step_id' => 'profile', 'summary' => 'Overall divergence 37%']],
    );

    expect($prompt)->toContain('Use only the supplied aggregate result')
        ->and($prompt)->toContain('Profile Comparison')
        ->and($prompt)->toContain('Return only JSON');
});

it('hashes aggregate step results deterministically for interpretation reuse', function () {
    $service = new CohortSimilarityInterpretationService(Mockery::mock(AnalyticsLlmService::class));

    $left = $service->hashStepResult(
        mode: 'compare',
        stepId: 'balance',
        result: ['b' => 2, 'a' => ['z' => 9, 'y' => 8]],
        context: ['target_cohort_id' => 1, 'source_id' => 2],
    );
    $right = $service->hashStepResult(
        mode: 'compare',
        stepId: 'balance',
        result: ['a' => ['y' => 8, 'z' => 9], 'b' => 2],
        context: ['source_id' => 2, 'target_cohort_id' => 1],
    );

    expect($left)->toBe($right)->and($left)->toHaveLength(64);
});

it('changes interpretation hashes when the aggregate context changes', function () {
    $service = new CohortSimilarityInterpretationService(Mockery::mock(AnalyticsLlmService::class));

    $base = $service->hashStepResult(
        mode: 'compare',
        stepId: 'balance',
        result: ['mean_absolute_smd' => 0.12],
        context: ['source_id' => 2, 'target_cohort_id' => 1],
    );
    $changed = $service->hashStepResult(
        mode: 'compare',
        stepId: 'balance',
        result: ['mean_absolute_smd' => 0.12],
        context: ['source_id' => 2, 'target_cohort_id' => 3],
    );

    expect($base)->not->toBe($changed);
});

it('interprets a step through the analytics llm service', function () {
    $llm = Mockery::mock(AnalyticsLlmService::class);
    $llm->shouldReceive('chat')
        ->once()
        ->withArgs(function (array $messages, array $options): bool {
            return str_contains($messages[0]['content'], 'Aggregate analysis payload')
                && ($options['temperature'] ?? null) === 0.1;
        })
        ->andReturn('```json
{
  "summary": "The cohorts differ most by renal comorbidity.",
  "interpretation": "The balance step suggests residual renal and age imbalance.",
  "clinical_implications": ["Renal disease may modify downstream outcomes."],
  "methodologic_cautions": ["Residual imbalance remains above the SMD threshold."],
  "recommended_next_steps": ["Run propensity score matching before reading projections."],
  "confidence": 0.82
}
```');

    $service = new CohortSimilarityInterpretationService($llm);

    $interpretation = $service->interpret('compare', 'balance', cohortSimilarityInterpretationResult());

    expect($interpretation['status'])->toBe('interpreted')
        ->and($interpretation['summary'])->toContain('renal comorbidity')
        ->and($interpretation['clinical_implications'])->toBe(['Renal disease may modify downstream outcomes.'])
        ->and($interpretation['methodologic_cautions'])->toBe(['Residual imbalance remains above the SMD threshold.'])
        ->and($interpretation['confidence'])->toBe(0.82);
});

it('returns unavailable when no analytics provider is configured', function () {
    $llm = Mockery::mock(AnalyticsLlmService::class);
    $llm->shouldReceive('chat')
        ->once()
        ->andThrow(new AiProviderNotConfiguredException('No active provider'));

    $service = new CohortSimilarityInterpretationService($llm);

    $interpretation = $service->interpret('compare', 'balance', cohortSimilarityInterpretationResult());

    expect($interpretation['status'])->toBe('unavailable')
        ->and($interpretation['error'])->toBe('No active provider');
});
