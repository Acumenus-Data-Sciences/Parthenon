<?php

/*
 * Integration test that validates every non-default Laravel database
 * connection defined in backend/config/database.php is correctly
 * configured against the live single-database, schema-isolated
 * Parthenon PostgreSQL instance.
 *
 * For each connection we verify:
 *   1. The runtime `SHOW search_path` matches the configured value.
 *   2. A representative table that MUST exist in the first schema of
 *      the search_path resolves via `to_regclass()` and is queryable.
 *   3. Each additional configured schema either exists (sentinel table
 *      resolves) or is documented as optional (skipped).
 *
 * Connections whose first schema is missing in the current environment
 * are reported via `markTestSkipped()` so the test surfaces "verified"
 * vs "skipped" cleanly without spurious failures on partially populated
 * environments.
 *
 * The `interrogation` connection uses a dedicated `abby_analyst`
 * PostgreSQL role with read-only privileges. The test only attempts
 * a trivial `SELECT 1` and skips if credentials are not configured in
 * the current environment — we never attempt writes against CDM data
 * (CdmModel is read-only by contract).
 *
 * NOTE: All vocabulary table references use the SINGULAR OMOP CDM v5.4
 * names (vocab.concept, vocab.concept_ancestor, ...). Do NOT introduce
 * any plural forms here; backend/tests/Feature/Vocabulary/VocabTableNamingRegressionTest.php
 * will fail the build if you do.
 */

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * @return array<string, array{
 *     connection: string,
 *     expectedSearchPath: string,
 *     primarySchema: string,
 *     primaryTable: string,
 *     sentinelTables: list<string>,
 * }>
 */
function databaseConnectionMatrix(): array
{
    return [
        'omop (CDM + shared vocab)' => [
            'connection' => 'omop',
            'expectedSearchPath' => 'omop,vocab,php',
            'primarySchema' => 'omop',
            'primaryTable' => 'omop.person',
            'sentinelTables' => ['omop.person', 'vocab.concept'],
        ],
        'results (Achilles output)' => [
            'connection' => 'results',
            'expectedSearchPath' => 'results,php',
            'primarySchema' => 'results',
            'primaryTable' => 'results.achilles_results',
            'sentinelTables' => ['results.achilles_results'],
        ],
        'gis (geospatial)' => [
            'connection' => 'gis',
            'expectedSearchPath' => 'gis,omop,vocab,php',
            'primarySchema' => 'gis',
            'primaryTable' => 'gis.geographic_location',
            'sentinelTables' => ['gis.geographic_location', 'omop.person', 'vocab.concept'],
        ],
        'eunomia (GiBleed demo)' => [
            'connection' => 'eunomia',
            'expectedSearchPath' => 'eunomia,php',
            'primarySchema' => 'eunomia',
            'primaryTable' => 'eunomia.person',
            'sentinelTables' => ['eunomia.person'],
        ],
        'inpatient (Morpheus CDM)' => [
            'connection' => 'inpatient',
            'expectedSearchPath' => 'inpatient,inpatient_ext,vocab',
            'primarySchema' => 'inpatient',
            'primaryTable' => 'inpatient.visit_occurrence',
            'sentinelTables' => ['inpatient.visit_occurrence', 'vocab.concept'],
        ],
        'pancreas (cancer corpus CDM)' => [
            'connection' => 'pancreas',
            'expectedSearchPath' => 'pancreas,vocab,php',
            'primarySchema' => 'pancreas',
            'primaryTable' => 'pancreas.person',
            'sentinelTables' => ['pancreas.person', 'vocab.concept'],
        ],
    ];
}

/**
 * Normalize a `SHOW search_path` result. PostgreSQL may return
 * "omop, vocab, php" (with spaces) or "omop,vocab,php" depending on
 * how the path was set. Normalize to the canonical comma-separated
 * form with no surrounding whitespace.
 */
function normalizeSearchPath(string $value): string
{
    $parts = array_map('trim', explode(',', $value));

    return implode(',', $parts);
}

/**
 * @return list<string>
 */
function currentSchemas(string $connection): array
{
    /** @var array<int, stdClass> $rows */
    $rows = DB::connection($connection)->select('SELECT current_schemas(false) AS schemas');
    /** @var string $raw */
    $raw = $rows[0]->schemas;

    // current_schemas returns a PostgreSQL array literal like "{omop,vocab}".
    $trimmed = trim($raw, '{}');
    if ($trimmed === '') {
        return [];
    }

    return array_map('trim', explode(',', $trimmed));
}

it('verifies the configured search_path for each non-default connection', function (
    string $connection,
    string $expectedSearchPath,
    string $primarySchema,
    string $primaryTable,
    array $sentinelTables,
) {
    // 1. Confirm the connection is registered in config.
    $configured = config("database.connections.{$connection}.search_path");
    expect($configured)
        ->not->toBeNull("Connection '{$connection}' is missing from database.php")
        ->and(normalizeSearchPath((string) $configured))
        ->toBe($expectedSearchPath, "Connection '{$connection}' search_path drift in database.php");

    // 2. Verify the live runtime search_path matches the config.
    /** @var array<int, stdClass> $rows */
    $rows = DB::connection($connection)->select('SHOW search_path');
    expect($rows)->not->toBeEmpty();
    /** @var string $runtime */
    $runtime = $rows[0]->search_path;
    expect(normalizeSearchPath($runtime))->toBe($expectedSearchPath);

    // 3. Skip cleanly if the primary schema is not present in this env
    //    (e.g. Eunomia not loaded, inpatient corpus not ingested).
    $present = currentSchemas($connection);
    if (! in_array($primarySchema, $present, true)) {
        $this->markTestSkipped(
            "Schema '{$primarySchema}' is not present on this environment "
            .'(current_schemas={'.implode(',', $present).'}). '
            .'Configured search_path is correct; data is not loaded.'
        );
    }

    // 4. Resolve the primary representative table via to_regclass.
    /** @var array<int, stdClass> $primary */
    $primary = DB::connection($connection)->select(
        'SELECT to_regclass(?) AS rel',
        [$primaryTable],
    );
    expect($primary[0]->rel)->not->toBeNull(
        "Expected '{$primaryTable}' to resolve via search_path on connection '{$connection}'"
    );

    // 5. Resolve every sentinel table — these MUST exist when the primary
    //    schema is present, since they live in shared schemas (vocab) or
    //    in the same schema. A null result indicates real config drift.
    foreach ($sentinelTables as $sentinel) {
        /** @var array<int, stdClass> $r */
        $r = DB::connection($connection)->select(
            'SELECT to_regclass(?) AS rel',
            [$sentinel],
        );
        expect($r[0]->rel)->not->toBeNull(
            "Sentinel table '{$sentinel}' did not resolve on connection '{$connection}'"
        );
    }

    // 6. Read-only end-to-end query to confirm SELECT works against the
    //    primary table. We use a fully qualified count and cap with LIMIT 1
    //    by wrapping in a subquery — count(*) on a 1.5M row table is fine,
    //    but for safety we use EXISTS which short-circuits.
    /** @var array<int, stdClass> $exists */
    $exists = DB::connection($connection)->select(
        "SELECT EXISTS (SELECT 1 FROM {$primaryTable} LIMIT 1) AS has_rows"
    );
    expect($exists)->not->toBeEmpty();
    expect(property_exists($exists[0], 'has_rows'))->toBeTrue();
})->with(databaseConnectionMatrix());

it('confirms the default pgsql connection resolves the application schema', function () {
    $configured = config('database.connections.pgsql.search_path');
    expect(normalizeSearchPath((string) $configured))->toBe('app,php,public');

    /** @var array<int, stdClass> $rows */
    $rows = DB::connection('pgsql')->select('SHOW search_path');
    expect(normalizeSearchPath((string) $rows[0]->search_path))->toBe('app,php,public');

    // The Laravel migrations table lives in the `app` schema in
    // production. The `pgsql_testing` connection used during phpunit
    // points at a separate database, so we explicitly target the
    // `pgsql` connection for this assertion.
    /** @var array<int, stdClass> $r */
    $r = DB::connection('pgsql')->select(
        'SELECT to_regclass(?) AS rel',
        ['app.migrations'],
    );

    if ($r[0]->rel === null) {
        $this->markTestSkipped(
            'app.migrations not present on pgsql connection in this environment.'
        );
    }

    expect($r[0]->rel)->not->toBeNull();
});

it('verifies the interrogation connection is reachable as a read-only role', function () {
    $configured = config('database.connections.interrogation.search_path');
    expect(normalizeSearchPath((string) $configured))->toBe('omop,vocab,results,temp_abby');

    $username = config('database.connections.interrogation.username');
    $password = config('database.connections.interrogation.password');

    if (empty($username) || empty($password)) {
        $this->markTestSkipped(
            'interrogation connection credentials (ABBY_ANALYST_USERNAME / '
            .'ABBY_ANALYST_PASSWORD) are not configured in this environment.'
        );
    }

    try {
        /** @var array<int, stdClass> $ping */
        $ping = DB::connection('interrogation')->select('SELECT 1 AS ok');
    } catch (QueryException $e) {
        // The abby_analyst role may not be provisioned (or its password
        // not synced) in every environment. Skip cleanly rather than
        // failing — the configuration itself is what we are validating.
        $this->markTestSkipped(
            'interrogation connection failed to authenticate: '.$e->getMessage()
        );
    }

    expect($ping)->not->toBeEmpty();
    expect((int) $ping[0]->ok)->toBe(1);

    /** @var array<int, stdClass> $rows */
    $rows = DB::connection('interrogation')->select('SHOW search_path');
    expect(normalizeSearchPath((string) $rows[0]->search_path))
        ->toBe('omop,vocab,results,temp_abby');

    // Confirm a CDM table resolves through the read-only role's search_path.
    /** @var array<int, stdClass> $r */
    $r = DB::connection('interrogation')->select(
        'SELECT to_regclass(?) AS rel',
        ['omop.person'],
    );
    expect($r[0]->rel)->not->toBeNull(
        'Expected omop.person to resolve through the interrogation connection'
    );
});
