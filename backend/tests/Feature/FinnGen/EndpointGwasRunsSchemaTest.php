<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Phase 15 Plan 08 — schema-level guards for finngen.endpoint_gwas_runs.
 *
 * Verifies Plan 15-01's migration shipped the expected shape: table exists,
 * every expected index is present, the status CHECK constraint rejects
 * invalid enum values, and HIGHSEC §4.1 grants to parthenon_app are in place.
 */
it('creates the finngen.endpoint_gwas_runs table with the expected indexes', function () {
    $indexes = DB::connection('pgsql')->select(
        "SELECT indexname FROM pg_indexes WHERE schemaname='finngen' AND tablename='endpoint_gwas_runs'"
    );
    $names = collect($indexes)->pluck('indexname')->sort()->values()->all();

    // Primary key — Laravel default name is "{table}_pkey"; the migration did
    // not prefix it with the schema, so the actual name is 'endpoint_gwas_runs_pkey'.
    expect($names)->toContain('endpoint_gwas_runs_pkey');
    expect($names)->toContain('finngen_endpoint_gwas_runs_unique_idx');
    expect($names)->toContain('finngen_endpoint_gwas_runs_endpoint_source_idx');
    expect($names)->toContain('finngen_endpoint_gwas_runs_run_id_idx');
    expect($names)->toContain('finngen_endpoint_gwas_runs_control_cohort_idx');
    // At least 5 Plan 15-01 indexes present.
    expect(count($names))->toBeGreaterThanOrEqual(5);
});

it('enforces the status CHECK constraint', function () {
    expect(fn () => DB::connection('pgsql')->insert(
        'INSERT INTO finngen.endpoint_gwas_runs (endpoint_name, source_key, control_cohort_id, covariate_set_id, run_id, status) VALUES (?, ?, ?, ?, ?, ?)',
        ['E4_DM2', 'PANCREAS', 1, 1, '01J8XYZTESTROW0000000X0001', 'invalid_status']
    ))->toThrow(QueryException::class);
});

it('grants parthenon_app SELECT/INSERT/UPDATE/DELETE on finngen.endpoint_gwas_runs', function () {
    $grants = DB::connection('pgsql')->select(
        "SELECT privilege_type
           FROM information_schema.role_table_grants
          WHERE grantee='parthenon_app'
            AND table_schema='finngen'
            AND table_name='endpoint_gwas_runs'"
    );
    $types = collect($grants)->pluck('privilege_type')->sort()->values()->all();
    expect($types)->toContain('SELECT');
    expect($types)->toContain('INSERT');
    expect($types)->toContain('UPDATE');
    expect($types)->toContain('DELETE');
});

it('also ships the generation-history partial expression index on finngen.runs', function () {
    $rows = DB::connection('pgsql')->select(
        "SELECT indexname FROM pg_indexes
          WHERE schemaname='finngen'
            AND tablename='runs'
            AND indexname='finngen_runs_endpoint_name_idx'"
    );
    expect(count($rows))->toBe(1);
});
