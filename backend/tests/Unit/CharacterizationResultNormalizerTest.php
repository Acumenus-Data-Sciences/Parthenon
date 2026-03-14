<?php

namespace Tests\Unit;

use App\Support\CharacterizationResultNormalizer;
use PHPUnit\Framework\TestCase;

class CharacterizationResultNormalizerTest extends TestCase
{
    public function test_it_normalizes_legacy_target_and_comparator_cohort_payloads(): void
    {
        $normalized = CharacterizationResultNormalizer::normalize([
            'targetCohorts' => [
                101 => [
                    'demographics' => [
                        [
                            'covariate_name' => 'Female',
                            'count' => 55,
                            'percent_value' => 55.0,
                        ],
                    ],
                ],
            ],
            'comparatorCohorts' => [
                202 => [
                    'conditions' => [
                        [
                            'concept_name' => 'Hypertension',
                            'person_count' => 11,
                            'percent_value' => 22.5,
                        ],
                    ],
                ],
            ],
        ]);

        $this->assertArrayHasKey('results', $normalized);
        $this->assertCount(2, $normalized['results']);

        $target = $normalized['results'][0];
        $this->assertSame(101, $target['cohort_id']);
        $this->assertSame('Cohort #101', $target['cohort_name']);
        $this->assertSame(55, $target['person_count']);
        $this->assertSame('Female', $target['features']['demographics'][0]['feature_name']);
        $this->assertSame(55.0, $target['features']['demographics'][0]['percent']);

        $comparator = $normalized['results'][1];
        $this->assertSame(202, $comparator['cohort_id']);
        $this->assertSame('Hypertension', $comparator['features']['conditions'][0]['feature_name']);
        $this->assertSame(11, $comparator['features']['conditions'][0]['count']);
    }

    public function test_it_normalizes_existing_results_payloads(): void
    {
        $normalized = CharacterizationResultNormalizer::normalize([
            'results' => [
                [
                    'cohort_id' => 1,
                    'cohort_name' => 'Test Cohort',
                    'person_count' => 10,
                    'features' => [
                        'drugs' => [
                            [
                                'feature_name' => 'Statin',
                                'count' => 4,
                                'percent' => 40,
                            ],
                        ],
                    ],
                ],
            ],
        ]);

        $this->assertCount(1, $normalized['results']);
        $this->assertSame('Statin', $normalized['results'][0]['features']['drugs'][0]['feature_name']);
        $this->assertSame(40.0, $normalized['results'][0]['features']['drugs'][0]['percent']);
    }
}
