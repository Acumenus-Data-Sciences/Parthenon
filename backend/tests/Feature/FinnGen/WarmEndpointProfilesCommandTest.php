<?php

declare(strict_types=1);

/**
 * Phase 18 GENOMICS-09/10/11 — RED Wave 0 stub for WarmEndpointProfilesCommand.
 *
 * Status: RED. Plan 18-07 will implement the Artisan command that dispatches compute
 * only for access-log entries whose cached row is stale or missing, within a --since=14d
 * window drawn from finngen.endpoint_profile_access.
 *
 * Covers D-08 (hybrid lazy + background warm) and D-11 (warm signal = access log).
 *
 * Test isolation: follows the Phase 14/17 GwasDispatchTest / PrsDispatchTest precedent
 * of NOT using RefreshDatabase — it collides with the Phase 13.1 isolate_finngen_schema
 * ALTER TABLE ... SET SCHEMA migration on replay (42P07 duplicate relation).
 */
it('dispatches compute only for access-log entries whose cached row is stale or missing', function (): void {
    // D-11 warm-signal + D-10 hash invalidation.
    $this->markTestIncomplete('Plan 18-07 WarmEndpointProfilesCommand');
});

it('respects --since=14d window from finngen.endpoint_profile_access.last_accessed_at', function (): void {
    $this->markTestIncomplete('Plan 18-07 window filter');
});

it('skips entries whose cached hash equals the current expression hash', function (): void {
    $this->markTestIncomplete('Plan 18-07 no-op path');
});
