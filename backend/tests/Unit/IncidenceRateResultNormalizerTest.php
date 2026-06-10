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

    public function test_it_computes_a_poisson_ci_when_bounds_are_absent(): void
    {
        $normalized = IncidenceRateResultNormalizer::normalize([
            'results' => [
                [
                    'outcome_cohort_id' => 5426,
                    'outcome_cohort_name' => 'MACE',
                    'persons_at_risk' => 265498,
                    'persons_with_outcome' => 1482,
                    'person_years' => 1323204.6543,
                    'incidence_rate' => 1.12,
                ],
            ],
        ]);

        $row = $normalized['results'][0];

        // Byar's interval must bracket the point estimate and be strictly positive.
        $this->assertGreaterThan(0.0, $row['rate_95_ci_lower']);
        $this->assertLessThan($row['incidence_rate'], $row['rate_95_ci_lower']);
        $this->assertGreaterThan($row['incidence_rate'], $row['rate_95_ci_upper']);
        $this->assertEqualsWithDelta(1.0637, $row['rate_95_ci_lower'], 0.01);
        $this->assertEqualsWithDelta(1.1785, $row['rate_95_ci_upper'], 0.01);
    }

    public function test_it_yields_a_one_sided_ci_for_zero_event_outcomes(): void
    {
        $normalized = IncidenceRateResultNormalizer::normalize([
            'results' => [
                [
                    'outcome_cohort_id' => 5439,
                    'outcome_cohort_name' => 'NC: zero events',
                    'persons_at_risk' => 265498,
                    'persons_with_outcome' => 0,
                    'person_years' => 1326581.3826,
                    'incidence_rate' => 0.0,
                ],
            ],
        ]);

        $row = $normalized['results'][0];

        $this->assertSame(0.0, $row['rate_95_ci_lower']);
        $this->assertGreaterThan(0.0, $row['rate_95_ci_upper']);
    }

    public function test_it_preserves_an_existing_confidence_interval(): void
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
                    'rate_95_ci_lower' => 17.0,
                    'rate_95_ci_upper' => 508.6,
                ],
            ],
        ]);

        $this->assertSame(17.0, $normalized['results'][0]['rate_95_ci_lower']);
        $this->assertSame(508.6, $normalized['results'][0]['rate_95_ci_upper']);
    }

    public function test_it_does_not_fabricate_a_ci_for_masked_rows(): void
    {
        $normalized = IncidenceRateResultNormalizer::normalize([
            'results' => [
                [
                    'outcome_cohort_id' => 9,
                    'outcome_cohort_name' => 'Masked',
                    'persons_at_risk' => 265498,
                    'persons_with_outcome' => -1, // min-cell-count masked
                    'person_years' => 1000.0,
                    'incidence_rate' => -1.0,
                ],
            ],
        ]);

        $this->assertSame(0.0, $normalized['results'][0]['rate_95_ci_lower']);
        $this->assertSame(0.0, $normalized['results'][0]['rate_95_ci_upper']);
    }
}
