<?php

declare(strict_types=1);

/**
 * Phase 18 GENOMICS-09/10/11 — RED Wave 0 stub for Co2SchemaProvisioner.
 *
 * Status: RED. Plan 18-03 will implement the provisioner service (GwasSchemaProvisioner
 * pattern) with HIGHSEC §4.1 grants and a regex allow-list for source_key.
 *
 * Covers T-18-03 (SQL injection via source_key) and T-18-04 (privilege escalation via
 * misconfigured grants).
 *
 * Test isolation: follows the Phase 14 GwasSchemaProvisionerTest precedent of NOT using
 * RefreshDatabase — collides with Phase 13.1 isolate_finngen_schema ALTER TABLE ... SET
 * SCHEMA migration on replay (42P07 duplicate relation).
 */
it('creates {source}_co2_results schema with 4 tables: endpoint_profile_summary, endpoint_profile_km_points, endpoint_profile_comorbidities, endpoint_profile_drug_classes', function (): void {
    $this->markTestIncomplete('Plan 18-03 Co2SchemaProvisioner');
});

it('grants SELECT/INSERT/UPDATE to parthenon_app on all 4 tables (HIGHSEC §4.1)', function (): void {
    $this->markTestIncomplete('Plan 18-03 HIGHSEC grants');
});

it('rejects unsafe source_key values matching DROP TABLE / quotes / semicolons (T-18-03)', function (): void {
    // Regex allow-list /^[a-z][a-z0-9_]{2,31}$/i mitigation.
    $this->markTestIncomplete('Plan 18-03 regex allow-list');
});

it('is idempotent — second call on same source_key does not fail or duplicate grants', function (): void {
    $this->markTestIncomplete('Plan 18-03 CREATE ... IF NOT EXISTS');
});
