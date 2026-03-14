<?php

namespace Tests\Unit;

use App\Support\PredictionResultNormalizer;
use PHPUnit\Framework\TestCase;

class PredictionResultNormalizerTest extends TestCase
{
    public function test_it_normalizes_sparse_prediction_payloads(): void
    {
        $normalized = PredictionResultNormalizer::normalize([
            'status' => 'completed',
            'summary' => [
                'target_count' => 100,
            ],
            'performance' => [
                'auc' => 0.81,
            ],
            'top_predictors' => [
                ['covariate_name' => 'Age'],
            ],
        ]);

        $this->assertSame('completed', $normalized['status']);
        $this->assertSame(100, $normalized['summary']['target_count']);
        $this->assertSame(0, $normalized['summary']['outcome_count']);
        $this->assertSame(0.81, $normalized['performance']['auc']);
        $this->assertSame(0.0, $normalized['performance']['brier_score']);
        $this->assertSame('Age', $normalized['top_predictors'][0]['covariate_name']);
        $this->assertSame([], $normalized['roc_curve']);
        $this->assertSame([], $normalized['prediction_distribution']);
    }

    public function test_it_normalizes_placeholder_prediction_payloads(): void
    {
        $normalized = PredictionResultNormalizer::normalize([
            'status' => 'r_not_implemented',
            'message' => 'Pending',
        ]);

        $this->assertSame('r_not_implemented', $normalized['status']);
        $this->assertSame('Pending', $normalized['message']);
        $this->assertSame(0, $normalized['summary']['target_count']);
        $this->assertSame([], $normalized['external_validation']);
    }
}
