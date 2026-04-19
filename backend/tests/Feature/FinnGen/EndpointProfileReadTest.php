<?php

declare(strict_types=1);

/**
 * Phase 18 GENOMICS-09/10/11 — RED Wave 0 stub for EndpointBrowserController::showProfile().
 *
 * Status: RED. Plan 18-04 will implement the cached-read path + hash-diff branch and
 * flip each markTestIncomplete() to real assertions.
 *
 * Covers D-09 (cache location), D-10 (expression-hash invalidation), D-15 (source eligibility).
 *
 * Test isolation: follows the Phase 14/17 GwasDispatchTest / PrsDispatchTest precedent
 * of NOT using RefreshDatabase — it collides with the Phase 13.1 isolate_finngen_schema
 * ALTER TABLE ... SET SCHEMA migration on replay (42P07 duplicate relation).
 */
it('returns status=cached with summary + km_points + comorbidities + drug_classes when hash matches', function (): void {
    $this->markTestIncomplete('Plan 18-04 EndpointBrowserController::showProfile');
});

it('returns status=needs_compute with dispatch_url when cached hash differs from current expression hash', function (): void {
    // D-10 stale-hash invalidation + Pitfall 4 hash stability.
    $this->markTestIncomplete('Plan 18-04 hash comparison');
});

it('returns status=needs_compute with reason=no_cache when no row exists for endpoint x source', function (): void {
    $this->markTestIncomplete('Plan 18-04 absent-cache path');
});

it('returns status=ineligible with error_code=source_ineligible when source has no death and no observation_period', function (): void {
    $this->markTestIncomplete('Plan 18-04 read-path precondition');
});
