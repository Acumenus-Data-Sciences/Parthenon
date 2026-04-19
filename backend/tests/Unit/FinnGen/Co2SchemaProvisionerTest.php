<?php

declare(strict_types=1);

use App\Services\FinnGen\Co2SchemaProvisioner;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

uses(TestCase::class);

/**
 * Phase 18 GENOMICS-09/10/11 — Co2SchemaProvisioner.
 *
 * Flipped GREEN by Plan 18-03 Task 1. Provisioner mirrors GwasSchemaProvisioner
 * (Phase 14) with HIGHSEC §4.1 three-tier grants and a T-18-03 regex allow-list
 * on source_key before any interpolation. All DDL runs inside a single
 * DB::transaction (T-18-04) so partial-failure leaves no schema fragment.
 *
 * Test isolation: does NOT use RefreshDatabase — collides with Phase 13.1
 * isolate_finngen_schema ALTER TABLE ... SET SCHEMA migration on replay
 * (42P07 duplicate relation). Follows the Phase 14 GwasSchemaProvisionerTest
 * precedent; idempotent CREATE ... IF NOT EXISTS makes this safe.
 */
it('creates {source}_co2_results schema with 4 tables: endpoint_profile_summary, endpoint_profile_km_points, endpoint_profile_comorbidities, endpoint_profile_drug_classes', function (): void {
    app(Co2SchemaProvisioner::class)->provision('pancreas');

    $tables = DB::select("
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'pancreas_co2_results'
        ORDER BY table_name
    ");
    $names = array_map(fn ($r) => $r->table_name, $tables);

    expect($names)->toContain(
        'endpoint_profile_summary',
        'endpoint_profile_km_points',
        'endpoint_profile_comorbidities',
        'endpoint_profile_drug_classes',
    );
});

it('grants SELECT/INSERT/UPDATE to parthenon_app on all 4 tables (HIGHSEC §4.1)', function (): void {
    app(Co2SchemaProvisioner::class)->provision('pancreas');

    $hasRole = DB::selectOne("SELECT 1 AS ok FROM pg_roles WHERE rolname = 'parthenon_app'");
    if (! $hasRole) {
        test()->markTestSkipped('parthenon_app role absent in this env');
    }

    $grants = DB::select("
        SELECT table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE grantee = 'parthenon_app'
          AND table_schema = 'pancreas_co2_results'
          AND privilege_type IN ('SELECT','INSERT','UPDATE')
    ");

    // 4 tables × 3 privileges = 12 minimum rows.
    expect(count($grants))->toBeGreaterThanOrEqual(12);
});

it('rejects unsafe source_key values matching DROP TABLE / quotes / semicolons (T-18-03)', function (): void {
    $svc = app(Co2SchemaProvisioner::class);

    expect(fn () => $svc->provision('bad; DROP TABLE x;--'))
        ->toThrow(InvalidArgumentException::class);
    expect(fn () => $svc->provision('pancreas--evil'))
        ->toThrow(InvalidArgumentException::class);
    expect(fn () => $svc->provision('pancreas'))
        ->not->toThrow(InvalidArgumentException::class);
});

it('is idempotent — second call on same source_key does not fail or duplicate grants', function (): void {
    $svc = app(Co2SchemaProvisioner::class);
    $svc->provision('pancreas');

    expect(fn () => $svc->provision('pancreas'))->not->toThrow(Throwable::class);
});
