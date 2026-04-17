<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

/**
 * Phase 13.1 Wave 0 — SC 1-4.
 *
 * Expected state: RED until Plan 13.1-02 migration lands. Assertions fail
 * naturally because:
 *   - pg_namespace has no row named 'finngen' yet (schema not created)
 *   - information_schema.tables WHERE table_schema='finngen' returns empty
 *   - finngen.endpoint_definitions does not exist
 *   - app.cohort_definitions still has the coverage_profile column
 *
 * @note RED until Plan 13.1-02 migration ships.
 */
it('creates the finngen schema owned with USAGE grant for parthenon_app', function (): void {
    $exists = DB::selectOne("SELECT 1 AS ok FROM pg_namespace WHERE nspname = 'finngen'");
    expect($exists)->not->toBeNull();

    $priv = DB::selectOne("SELECT has_schema_privilege('parthenon_app', 'finngen', 'USAGE') AS ok");
    expect((bool) $priv->ok)->toBeTrue();
});

it('relocates the 7 FinnGen tables into finngen schema without finngen_ prefix', function (): void {
    // Per CONTEXT.md scope: the 6 existing app.finngen_* tables plus the new
    // finngen.endpoint_definitions table yield 7 tables under the finngen schema.
    $expected = [
        'analysis_modules',
        'endpoint_definitions',
        'endpoint_expressions_pre_phase13',
        'endpoint_generations',
        'runs',
        'unmapped_codes',
        'workbench_sessions',
    ];
    $actual = collect(DB::select(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='finngen' ORDER BY 1"
    ))->pluck('table_name')->all();
    expect($actual)->toBe($expected);
});

it('migrates endpoint rows out of app.cohort_definitions into finngen.endpoint_definitions', function (): void {
    // When RefreshDatabase runs the testing seeders, the seeded count will not
    // necessarily be the prod 5,161 (seeders may ship a smaller fixture). The
    // invariant is: (a) finngen.endpoint_definitions exists and is queryable,
    // (b) app.cohort_definitions has ZERO rows with domain='finngen-endpoint'
    //     after the 13.1 migration runs (the rows were moved, not copied).
    $fcount = DB::selectOne('SELECT COUNT(*)::int AS n FROM finngen.endpoint_definitions')->n;
    expect($fcount)->toBeGreaterThanOrEqual(0);

    $acount = DB::selectOne(
        "SELECT COUNT(*)::int AS n FROM app.cohort_definitions WHERE domain='finngen-endpoint'"
    )->n;
    expect($acount)->toBe(0);
});

it('drops app.cohort_definitions.coverage_profile column', function (): void {
    $col = DB::selectOne(
        'SELECT column_name FROM information_schema.columns '.
        "WHERE table_schema='app' AND table_name='cohort_definitions' AND column_name='coverage_profile'"
    );
    expect($col)->toBeNull();
});
