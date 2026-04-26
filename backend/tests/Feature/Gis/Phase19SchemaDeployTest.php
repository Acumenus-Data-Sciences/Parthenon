<?php

declare(strict_types=1);

/**
 * Phase 19 Wave 0 RED — gis schema deploy test stubs.
 *
 * These tests assert the end-state shape of the `gis` schema once Plan 02
 * lands the migration that creates the schema, six tables, materialized
 * view, and HIGHSEC-compliant GRANT posture against parthenon_app.
 *
 * Until Plan 02 ships, every assertion below MUST fail (RED). The
 * `--no-verify` Wave 0 commit is intentional per Phase 18-01 STATE.md
 * precedent: pre-commit Vitest/Pest gates are GREEN-only and structurally
 * incompatible with RED scaffolding.
 *
 * Decisions enforced:
 *   D-01 — gis.external_exposure has source_id NOT NULL + unique
 *          (source_id, person_id, exposure_type, exposure_date).
 *   D-04 — Migration must NOT silently skip when PostGIS is missing;
 *          enforced via Plan 02's RuntimeException, not this test file.
 *
 * Pest groups:
 *   phase19, gis        — every test
 *   highsec             — GRANT posture tests (4, 5)
 *   d-01                — unique constraint + source_id NOT NULL (6, 7)
 */

use Illuminate\Support\Facades\DB;

it('creates the gis schema after migration', function (): void {
    $row = DB::selectOne("SELECT nspname FROM pg_namespace WHERE nspname = 'gis'");
    expect($row)->not->toBeNull();
    expect($row->nspname)->toBe('gis');
})->group('phase19', 'gis');

it('creates all six gis tables', function (): void {
    $expected = [
        'geographic_location',
        'external_exposure',
        'location_geography',
        'gis_hospital',
        'geography_summary',
    ];
    $rows = DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'gis'");
    $actual = array_map(fn ($r) => $r->tablename, $rows);
    foreach ($expected as $table) {
        expect($actual)->toContain($table);
    }
})->group('phase19', 'gis');

it('creates the gis.patient_geography materialized view', function (): void {
    $row = DB::selectOne(
        "SELECT matviewname FROM pg_matviews WHERE schemaname = 'gis' AND matviewname = 'patient_geography'"
    );
    expect($row)->not->toBeNull();
    expect($row->matviewname)->toBe('patient_geography');
})->group('phase19', 'gis');

it('grants USAGE on gis schema to parthenon_app but NOT CREATE', function (): void {
    $usage = DB::selectOne("SELECT has_schema_privilege('parthenon_app', 'gis', 'USAGE') AS has_priv");
    $create = DB::selectOne("SELECT has_schema_privilege('parthenon_app', 'gis', 'CREATE') AS has_priv");
    expect((bool) $usage->has_priv)->toBeTrue();
    expect((bool) $create->has_priv)->toBeFalse();
})->group('phase19', 'gis', 'highsec');

it('grants DML on gis.external_exposure to parthenon_app but NOT TRUNCATE', function (): void {
    $insert = DB::selectOne("SELECT has_table_privilege('parthenon_app', 'gis.external_exposure', 'INSERT') AS has_priv");
    $select = DB::selectOne("SELECT has_table_privilege('parthenon_app', 'gis.external_exposure', 'SELECT') AS has_priv");
    $update = DB::selectOne("SELECT has_table_privilege('parthenon_app', 'gis.external_exposure', 'UPDATE') AS has_priv");
    $delete = DB::selectOne("SELECT has_table_privilege('parthenon_app', 'gis.external_exposure', 'DELETE') AS has_priv");
    $truncate = DB::selectOne("SELECT has_table_privilege('parthenon_app', 'gis.external_exposure', 'TRUNCATE') AS has_priv");
    expect((bool) $insert->has_priv)->toBeTrue();
    expect((bool) $select->has_priv)->toBeTrue();
    expect((bool) $update->has_priv)->toBeTrue();
    expect((bool) $delete->has_priv)->toBeTrue();
    expect((bool) $truncate->has_priv)->toBeFalse();
})->group('phase19', 'gis', 'highsec');

it('enforces unique (source_id, person_id, exposure_type, exposure_date) on gis.external_exposure (D-01)', function (): void {
    $row = DB::selectOne(<<<'SQL'
        SELECT c.conname, array_length(c.conkey, 1) AS keylen
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'gis'
          AND t.relname = 'external_exposure'
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 4
        LIMIT 1
    SQL);
    expect($row)->not->toBeNull();
    expect((int) $row->keylen)->toBe(4);
})->group('phase19', 'gis', 'd-01');

it('declares source_id NOT NULL on gis.external_exposure (D-01)', function (): void {
    $row = DB::selectOne(<<<'SQL'
        SELECT a.attnotnull
        FROM pg_attribute a
        JOIN pg_class t ON t.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'gis'
          AND t.relname = 'external_exposure'
          AND a.attname = 'source_id'
          AND a.attnum > 0
    SQL);
    expect($row)->not->toBeNull();
    expect((bool) $row->attnotnull)->toBeTrue();
})->group('phase19', 'gis', 'd-01');
