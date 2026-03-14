<?php

namespace Tests\Unit;

use App\Support\SccsResultNormalizer;
use PHPUnit\Framework\TestCase;

class SccsResultNormalizerTest extends TestCase
{
    public function test_it_translates_legacy_sccs_keys(): void
    {
        $normalized = SccsResultNormalizer::normalize([
            'status' => 'completed',
            'estimates' => [
                [
                    'name' => 'Exposure window',
                    'irr' => 1.4,
                    'ci_lower' => 1.1,
                    'ci_upper' => 1.8,
                ],
            ],
            'summary' => [
                'cases' => 44,
                'events' => 17,
            ],
        ]);

        $this->assertSame('completed', $normalized['status']);
        $this->assertSame('Exposure window', $normalized['estimates'][0]['covariate']);
        $this->assertSame(44, $normalized['population']['cases']);
        $this->assertSame(17, $normalized['population']['outcomes']);
        $this->assertSame(0, $normalized['population']['observation_periods']);
    }

    public function test_it_normalizes_placeholder_sccs_payloads(): void
    {
        $normalized = SccsResultNormalizer::normalize([
            'status' => 'r_not_implemented',
            'message' => 'Not configured',
        ]);

        $this->assertSame('r_not_implemented', $normalized['status']);
        $this->assertSame('Not configured', $normalized['message']);
        $this->assertSame([], $normalized['estimates']);
        $this->assertSame(0, $normalized['population']['cases']);
    }
}
