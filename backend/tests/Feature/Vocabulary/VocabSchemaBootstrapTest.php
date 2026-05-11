<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

/**
 * Regression guard for clean PostgreSQL installs: the OMOP vocabulary schema
 * must exist before the base vocabulary migrations run. If `vocab` is missing,
 * PostgreSQL ignores it in search_path and unqualified DDL lands in `omop`.
 */
it('keeps shared OMOP vocabulary tables in the vocab schema', function (): void {
    try {
        DB::connection()->getPdo();
    } catch (Throwable) {
        test()->markTestSkipped('PostgreSQL test database is not reachable.');
    }

    $schema = DB::selectOne(
        "SELECT 1 AS exists FROM information_schema.schemata WHERE schema_name = 'vocab'"
    );

    expect((bool) ($schema?->exists ?? false))->toBeTrue('schema vocab must exist');

    $requiredTables = [
        'vocabulary',
        'domain',
        'concept_class',
        'relationship',
        'concept',
        'concept_relationship',
        'concept_ancestor',
        'concept_synonym',
        'drug_strength',
        'source_to_concept_map',
        'concept_embeddings',
        'concept_tree',
    ];

    foreach ($requiredTables as $table) {
        $row = DB::selectOne('SELECT to_regclass(?) IS NOT NULL AS exists', ["vocab.{$table}"]);
        expect((bool) ($row?->exists ?? false))->toBeTrue("vocab.{$table} must exist");
    }

    $misplaced = DB::select(
        "SELECT tablename
           FROM pg_tables
          WHERE schemaname = 'omop'
            AND tablename = ANY(?::text[])
          ORDER BY tablename",
        ['{'.implode(',', $requiredTables).'}']
    );

    expect($misplaced)->toBeEmpty(
        'Vocabulary tables must not be created under omop: '
        .implode(', ', array_map(fn ($row) => $row->tablename, $misplaced))
    );
});
