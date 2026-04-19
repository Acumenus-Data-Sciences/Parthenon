<?php

declare(strict_types=1);

/**
 * Phase 18 GENOMICS-09/10/11 — RED Wave 0 stub for EndpointBrowserController::profile().
 *
 * Status: RED. Plan 18-04 will implement the controller + routes + middleware and
 * flip each markTestIncomplete() to real assertions (per 18-01-PLAN.md T1 contract).
 *
 * Each incomplete reference names the downstream plan that owns the GREEN transition.
 *
 * Threat mitigations this stub covers:
 *   - T-18-01 (EoP) via the 403 permission-gate scenario.
 *   - T-18-05 (DoS / transaction poisoning) via the access-log-unavailable scenario.
 *
 * Test isolation: follows the Phase 14/17 GwasDispatchTest / PrsDispatchTest precedent
 * of NOT using RefreshDatabase — it collides with the Phase 13.1 isolate_finngen_schema
 * ALTER TABLE ... SET SCHEMA migration on replay (42P07 duplicate relation). Plan 18-04
 * will wire the full seeder + FinnGenRunService mocking harness for the GREEN branch.
 */
it('returns 202 + run envelope when researcher dispatches endpoint profile against eligible source', function (): void {
    // GIVEN researcher with finngen.endpoint_profile.compute on a FinnGen endpoint
    // named E4_DM2 and PANCREAS source that has death + observation_period rows.
    // WHEN POST /api/v1/finngen/endpoints/E4_DM2/profile with source_key=PANCREAS.
    // THEN 202 with body { data: { run_id, endpoint_name, source_key, expression_hash } }.
    $this->markTestIncomplete('Plan 18-04 implements EndpointBrowserController::profile');
});

it('returns 422 source_ineligible when source has no death data', function (): void {
    $this->markTestIncomplete('Plan 18-04 precondition ladder');
});

it('returns 422 endpoint_not_resolvable when endpoint coverage_bucket is UNMAPPED', function (): void {
    $this->markTestIncomplete('Plan 18-04 precondition ladder');
});

it('returns 403 when user lacks finngen.endpoint_profile.compute permission', function (): void {
    // T-18-01 mitigation test — permission gate must block viewers / non-compute roles.
    $this->markTestIncomplete('Plan 18-04 routes middleware');
});

it('succeeds when access-log table is unavailable (transaction poisoning mitigation)', function (): void {
    // Pitfall 3 + T-18-05 — access-log middleware must try-catch so a failed
    // finngen.endpoint_profile_access write does NOT poison the outer PG transaction.
    $this->markTestIncomplete('Plan 18-04 TrackEndpointProfileAccess middleware');
});
