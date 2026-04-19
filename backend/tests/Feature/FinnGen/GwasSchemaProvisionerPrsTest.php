<?php

declare(strict_types=1);

use App\Services\FinnGen\GwasSchemaProvisioner;
use Illuminate\Support\Facades\DB;

/**
 * Phase 17 Plan 01 Task 2 — verify the GwasSchemaProvisioner extension
 * provisions {source}_gwas_results.prs_subject_scores alongside the
 * existing summary_stats table.
 *
 * Uses a unique throwaway source key ("pancreas_prs_test") to avoid
 * colliding with the existing GwasSchemaProvisionerTest which owns
 * the pancreas_gwas_results schema.
 */
beforeEach(function () {
    DB::statement('DROP SCHEMA IF EXISTS pancreas_prs_test_gwas_results CASCADE');
});

afterEach(function () {
    DB::statement('DROP SCHEMA IF EXISTS pancreas_prs_test_gwas_results CASCADE');
});

it('creates pancreas_prs_test_gwas_results.prs_subject_scores alongside summary_stats', function () {
    app(GwasSchemaProvisioner::class)->provision('pancreas_prs_test');

    $tables = DB::select("
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'pancreas_prs_test_gwas_results'
        ORDER BY table_name
    ");
    $names = array_map(fn ($r) => $r->table_name, $tables);

    expect($names)->toContain('summary_stats');
    expect($names)->toContain('prs_subject_scores');
});

it('provisions prs_subject_scores with expected columns', function () {
    app(GwasSchemaProvisioner::class)->provision('pancreas_prs_test');

    $cols = DB::select("
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'pancreas_prs_test_gwas_results'
          AND table_name   = 'prs_subject_scores'
        ORDER BY ordinal_position
    ");
    $names = array_map(fn ($r) => $r->column_name, $cols);

    expect($names)->toEqual([
        'score_id',
        'cohort_definition_id',
        'subject_id',
        'raw_score',
        'scored_at',
        'gwas_run_id',
    ]);
});

it('creates composite PK on (score_id, cohort_definition_id, subject_id)', function () {
    app(GwasSchemaProvisioner::class)->provision('pancreas_prs_test');

    $pkCols = DB::select("
        SELECT a.attname AS column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'pancreas_prs_test_gwas_results.prs_subject_scores'::regclass
          AND i.indisprimary
        ORDER BY array_position(i.indkey, a.attnum)
    ");
    $names = array_map(fn ($r) => $r->column_name, $pkCols);

    expect($names)->toEqual(['score_id', 'cohort_definition_id', 'subject_id']);
});

it('creates cross-schema FK to vocab.pgs_scores with ON DELETE CASCADE', function () {
    app(GwasSchemaProvisioner::class)->provision('pancreas_prs_test');

    $row = DB::selectOne("
        SELECT pc.confdeltype,
               ns.nspname AS referenced_schema,
               cls.relname AS referenced_table
        FROM pg_constraint pc
        JOIN pg_class cls ON cls.oid = pc.confrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE pc.conrelid = 'pancreas_prs_test_gwas_results.prs_subject_scores'::regclass
          AND pc.contype  = 'f'
          AND pc.conname  = 'prs_subject_scores_pgs_fk'
    ");

    expect($row)->not->toBeNull();
    expect($row->confdeltype)->toBe('c'); // CASCADE
    expect($row->referenced_schema)->toBe('vocab');
    expect($row->referenced_table)->toBe('pgs_scores');
});

it('creates cohort+score btree index on prs_subject_scores', function () {
    app(GwasSchemaProvisioner::class)->provision('pancreas_prs_test');

    $row = DB::selectOne("
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = 'pancreas_prs_test_gwas_results'
          AND tablename  = 'prs_subject_scores'
          AND indexname  = 'prs_subject_scores_cohort_score_idx'
    ");

    expect($row)->not->toBeNull();
    expect($row->indexdef)->toContain('cohort_definition_id');
    expect($row->indexdef)->toContain('score_id');
});

it('grants DML to parthenon_app on prs_subject_scores', function () {
    if (! hasPgRoleForPrivilegeAssertions('parthenon_app')) {
        return;
    }

    app(GwasSchemaProvisioner::class)->provision('pancreas_prs_test');

    $row = DB::selectOne("
        SELECT has_table_privilege('parthenon_app', 'pancreas_prs_test_gwas_results.prs_subject_scores', 'SELECT, INSERT, UPDATE, DELETE') AS ok
    ");
    expect((bool) $row->ok)->toBeTrue();
});

it('grants DML to parthenon_finngen_rw and SELECT only to parthenon_finngen_ro', function () {
    if (
        ! hasPgRoleForPrivilegeAssertions('parthenon_finngen_rw') ||
        ! hasPgRoleForPrivilegeAssertions('parthenon_finngen_ro')
    ) {
        return;
    }

    app(GwasSchemaProvisioner::class)->provision('pancreas_prs_test');

    $rw = DB::selectOne("SELECT has_table_privilege('parthenon_finngen_rw', 'pancreas_prs_test_gwas_results.prs_subject_scores', 'SELECT, INSERT, UPDATE, DELETE') AS ok")->ok;
    $ro_select = DB::selectOne("SELECT has_table_privilege('parthenon_finngen_ro', 'pancreas_prs_test_gwas_results.prs_subject_scores', 'SELECT') AS ok")->ok;
    $ro_insert = DB::selectOne("SELECT has_table_privilege('parthenon_finngen_ro', 'pancreas_prs_test_gwas_results.prs_subject_scores', 'INSERT') AS ok")->ok;

    expect((bool) $rw)->toBeTrue();
    expect((bool) $ro_select)->toBeTrue();
    expect((bool) $ro_insert)->toBeFalse();
});

it('is idempotent — second provision() call is a no-op', function () {
    $svc = app(GwasSchemaProvisioner::class);
    $svc->provision('pancreas_prs_test');
    $svc->provision('pancreas_prs_test'); // must not throw

    expect(DB::selectOne("
        SELECT to_regclass('pancreas_prs_test_gwas_results.prs_subject_scores') AS t
    ")->t)->not->toBeNull();

    // summary_stats still intact (no regression on Phase 14 behavior)
    expect(DB::selectOne("
        SELECT to_regclass('pancreas_prs_test_gwas_results.summary_stats') AS t
    ")->t)->not->toBeNull();
});
