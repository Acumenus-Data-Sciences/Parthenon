<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

/**
 * Phase 17 Plan 01 — verifies the vocab.pgs_* catalog tables and their
 * HIGHSEC grants post-migrate. Does NOT use RefreshDatabase — the tables
 * should already exist from migrate-once on parthenon_testing (the outer
 * test harness bootstraps migrations before the suite runs).
 *
 * Task 1 assertion: parthenon_migrator has CREATE on schema vocab
 * (required prerequisite for Task 2 table creation).
 *
 * Task 2 assertions: vocab.pgs_scores + vocab.pgs_score_variants exist
 * with the expected columns, PK, FK, index, and 3-tier HIGHSEC grants.
 */
it('grants CREATE on schema vocab to parthenon_migrator (Task 1)', function () {
    if (! hasPgRoleForPrivilegeAssertions('parthenon_migrator')) {
        return;
    }

    $row = DB::selectOne(
        "SELECT has_schema_privilege('parthenon_migrator', 'vocab', 'CREATE') AS c"
    );
    expect((bool) $row->c)->toBeTrue(
        'parthenon_migrator must have CREATE on vocab schema (migration 2026_04_25_000050)'
    );
});

it('creates vocab.pgs_scores with expected columns', function () {
    $cols = DB::select("
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'vocab'
          AND table_name   = 'pgs_scores'
        ORDER BY ordinal_position
    ");
    $names = array_map(fn ($r) => $r->column_name, $cols);
    expect($names)->toContain(
        'score_id',
        'pgs_name',
        'trait_reported',
        'trait_efo_ids',
        'variants_number',
        'ancestry_distribution',
        'publication_doi',
        'license',
        'weights_file_url',
        'harmonized_file_url',
        'genome_build',
        'loaded_at',
        'created_at',
        'updated_at',
    );
});

it('creates vocab.pgs_score_variants with composite PK', function () {
    $pkCols = DB::select("
        SELECT a.attname AS column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'vocab.pgs_score_variants'::regclass
          AND i.indisprimary
        ORDER BY array_position(i.indkey, a.attnum)
    ");
    $names = array_map(fn ($r) => $r->column_name, $pkCols);
    expect($names)->toEqual(['score_id', 'chrom', 'pos_grch38', 'effect_allele']);
});

it('creates FK from pgs_score_variants.score_id to pgs_scores ON DELETE CASCADE', function () {
    $row = DB::selectOne("
        SELECT pc.confdeltype,
               ns.nspname AS referenced_schema,
               cls.relname AS referenced_table
        FROM pg_constraint pc
        JOIN pg_class cls ON cls.oid = pc.confrelid
        JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE pc.conrelid = 'vocab.pgs_score_variants'::regclass
          AND pc.contype  = 'f'
          AND pc.conname  = 'pgs_score_variants_score_fk'
    ");
    expect($row)->not->toBeNull();
    expect($row->confdeltype)->toBe('c'); // CASCADE
    expect($row->referenced_schema)->toBe('vocab');
    expect($row->referenced_table)->toBe('pgs_scores');
});

it('creates index on pgs_score_variants(score_id)', function () {
    $row = DB::selectOne("
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = 'vocab'
          AND tablename  = 'pgs_score_variants'
          AND indexname  = 'pgs_score_variants_score_idx'
    ");
    expect($row)->not->toBeNull();
    expect($row->indexdef)->toContain('(score_id)');
});

it('grants SELECT on vocab.pgs_scores to parthenon_app (HIGHSEC §4.1)', function () {
    if (! hasPgRoleForPrivilegeAssertions('parthenon_app')) {
        return;
    }

    $row = DB::selectOne(
        "SELECT has_table_privilege('parthenon_app', 'vocab.pgs_scores', 'SELECT') AS ok"
    );
    expect((bool) $row->ok)->toBeTrue();
});

it('grants SELECT on vocab.pgs_score_variants to parthenon_app (HIGHSEC §4.1)', function () {
    if (! hasPgRoleForPrivilegeAssertions('parthenon_app')) {
        return;
    }

    $row = DB::selectOne(
        "SELECT has_table_privilege('parthenon_app', 'vocab.pgs_score_variants', 'SELECT') AS ok"
    );
    expect((bool) $row->ok)->toBeTrue();
});

it('does NOT grant INSERT on vocab.pgs_scores to parthenon_app (read-only contract)', function () {
    if (! hasPgRoleForPrivilegeAssertions('parthenon_app')) {
        return;
    }

    $row = DB::selectOne(
        "SELECT has_table_privilege('parthenon_app', 'vocab.pgs_scores', 'INSERT') AS ok"
    );
    expect((bool) $row->ok)->toBeFalse(
        'parthenon_app must NOT have INSERT on vocab.pgs_scores per HIGHSEC'
    );
});
