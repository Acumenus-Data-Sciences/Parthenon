<?php

namespace Tests\Unit;

use App\Support\EvidenceSynthesisResultNormalizer;
use PHPUnit\Framework\TestCase;

class EvidenceSynthesisResultNormalizerTest extends TestCase
{
    public function test_it_normalizes_sparse_evidence_synthesis_payloads(): void
    {
        $normalized = EvidenceSynthesisResultNormalizer::normalize([
            'status' => 'completed',
            'method' => 'bayesian',
            'pooled' => [
                'hr' => 1.2,
            ],
            'per_site' => [
                [
                    'site_name' => 'Site A',
                    'hr' => 1.1,
                ],
            ],
        ]);

        $this->assertSame('completed', $normalized['status']);
        $this->assertSame('bayesian', $normalized['method']);
        $this->assertSame(1.2, $normalized['pooled']['hr']);
        $this->assertSame(0.0, $normalized['pooled']['tau']);
        $this->assertSame('Site A', $normalized['per_site'][0]['site_name']);
        $this->assertSame(1.1, $normalized['per_site'][0]['hr']);
    }

    public function test_it_normalizes_placeholder_evidence_synthesis_payloads(): void
    {
        $normalized = EvidenceSynthesisResultNormalizer::normalize([
            'status' => 'r_not_implemented',
            'message' => 'Pending',
        ]);

        $this->assertSame('r_not_implemented', $normalized['status']);
        $this->assertSame('Pending', $normalized['message']);
        $this->assertSame([], $normalized['per_site']);
        $this->assertSame(0.0, $normalized['pooled']['hr']);
    }
}
