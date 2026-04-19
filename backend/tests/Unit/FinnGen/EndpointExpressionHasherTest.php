<?php

declare(strict_types=1);

/**
 * Phase 18 GENOMICS-09/10/11 — RED Wave 0 stub for EndpointExpressionHasher.
 *
 * Status: RED. Plan 18-03 will implement canonical SHA-256 hashing of the resolved
 * endpoint expression JSON. Hash must be stable across semantically equivalent inputs
 * (key order, whitespace, int-vs-float concept IDs) so D-10 cache invalidation flips
 * only on real expression change — not serialization noise.
 *
 * Covers Pitfall 4 (hash stability).
 */
it('produces identical SHA-256 hash across semantically equivalent JSON (key order, whitespace)', function (): void {
    $this->markTestIncomplete('Plan 18-03 EndpointExpressionHasher::hash');
});

it('produces different hash when concept_id list changes', function (): void {
    $this->markTestIncomplete('Plan 18-03 hash sensitivity');
});

it('normalizes integer vs float concept_ids (1234 === 1234.0)', function (): void {
    $this->markTestIncomplete('Plan 18-03 number coercion');
});
