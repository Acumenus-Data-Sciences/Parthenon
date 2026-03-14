<?php

namespace Tests\Unit;

use App\Support\IncidenceRateResultNormalizer;
use PHPUnit\Framework\TestCase;

class IncidenceRateResultNormalizerTest extends TestCase
{
    public function test_it_normalizes_legacy_outcome_map_payloads(): void
    {
        $normalized = IncidenceRateResultNormalizer::normalize([
            'targetCohortId' => 10,
            'outcomes' => [
                300 => [
                    'overall' => [
                        'outcome_cohort_name' => 'Stroke',
                        'persons_at_risk' => 120,
                        'persons_with_outcome' => 9,
                        'person_years' => 88.5,
                        'incidence_rate' => 101.7,
                        'rate_95_ci_lower' => 70.2,
                        'rate_95_ci_upper' => 133.1,
                    ],
                    'strata' => [
                        'gender' => [
                            [
                                'gender' => 'Female',
                                'persons_at_risk' => 70,
                                'persons_with_outcome' => 5,
                                'person_years' => 50.1,
                                'incidence_rate' => 99.8,
                            ],
                        ],
                    ],
                ],
            ],
        ]);

        $this->assertArrayHasKey('results', $normalized);
        $this->assertCount(1, $normalized['results']);
        $this->assertSame(300, $normalized['results'][0]['outcome_cohort_id']);
        $this->assertSame('Stroke', $normalized['results'][0]['outcome_cohort_name']);
        $this->assertSame(120, $normalized['results'][0]['persons_at_risk']);
        $this->assertCount(1, $normalized['results'][0]['strata']);
        $this->assertSame('gender', $normalized['results'][0]['strata'][0]['stratum_name']);
        $this->assertSame('Female', $normalized['results'][0]['strata'][0]['stratum_value']);
    }

    public function test_it_normalizes_existing_results_payloads(): void
    {
        $normalized = IncidenceRateResultNormalizer::normalize([
            'results' => [
                [
                    'outcome_cohort_id' => 7,
                    'outcome_cohort_name' => 'AMI',
                    'persons_at_risk' => 20,
                    'persons_with_outcome' => 2,
                    'person_years' => 14.2,
                    'incidence_rate' => 140.8,
                    'strata' => [
                        [
                            'stratum_name' => 'age',
                            'stratum_value' => '65+',
                        ],
                    ],
                ],
            ],
        ]);

        $this->assertCount(1, $normalized['results']);
        $this->assertSame('AMI', $normalized['results'][0]['outcome_cohort_name']);
        $this->assertSame('age', $normalized['results'][0]['strata'][0]['stratum_name']);
        $this->assertSame('65+', $normalized['results'][0]['strata'][0]['stratum_value']);
    }
}
