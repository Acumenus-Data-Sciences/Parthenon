<?php

/*
 * Validate that every CDM source with a results daimon resolves to
 * a distinct, existing PostgreSQL schema — and that the results schema
 * never collides with the CDM schema for the same source.
 *
 * This test connects to the live parthenon database on localhost (host
 * PG17) and reads app.sources / app.source_daimons directly. It does
 * NOT rely on the Laravel connection config (which may point at a remote
 * or Docker host that is unreachable in CI/dev). Instead, it registers
 * a temporary `local_parthenon` connection at runtime.
 *
 * Requires: host PG17 with the `parthenon` database accessible via
 * local credentials (~/.pgpass).
 */

use Illuminate\Support\Facades\DB;

const LOCAL_CONN = 'local_parthenon';

function localParthenonReachable(): bool
{
    ensureLocalConnection();
    try {
        DB::connection(LOCAL_CONN)->getPdo();

        return true;
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * Register a temporary connection targeting the local PG17 host.
 * Uses the same parthenon database with the `app,php` search_path
 * so Source / SourceDaimon tables resolve correctly.
 */
function ensureLocalConnection(): void
{
    if (config('database.connections.'.LOCAL_CONN) !== null) {
        return;
    }

    config([
        'database.connections.'.LOCAL_CONN => [
            'driver' => 'pgsql',
            'host' => '127.0.0.1',
            'port' => env('DB_PORT', '5432'),
            'database' => 'parthenon',
            'username' => env('DB_USERNAME', 'parthenon'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'app,php',
            'sslmode' => 'prefer',
        ],
    ]);
}

/**
 * Load sources with their daimons via the local connection.
 *
 * @return list<array{source_name: string, cdm: ?string, results: ?string, vocabulary: ?string}>
 */
function loadSourceDaimonMap(): array
{
    ensureLocalConnection();

    $rows = DB::connection(LOCAL_CONN)->select(<<<'SQL'
        SELECT
            s.source_name,
            MAX(CASE WHEN sd.daimon_type = 'cdm'        THEN sd.table_qualifier END) AS cdm_schema,
            MAX(CASE WHEN sd.daimon_type = 'results'     THEN sd.table_qualifier END) AS results_schema,
            MAX(CASE WHEN sd.daimon_type = 'vocabulary'  THEN sd.table_qualifier END) AS vocabulary_schema
        FROM app.sources s
        JOIN app.source_daimons sd ON s.id = sd.source_id
        WHERE s.deleted_at IS NULL
        GROUP BY s.id, s.source_name
        ORDER BY s.source_name
    SQL);

    return array_map(fn ($row) => [
        'source_name' => $row->source_name,
        'cdm' => $row->cdm_schema,
        'results' => $row->results_schema,
        'vocabulary' => $row->vocabulary_schema,
    ], $rows);
}

it('every source with a results daimon resolves a distinct results schema', function () {
    if (! localParthenonReachable()) {
        $this->markTestSkipped('Local parthenon database not reachable (CI environment).');
    }
    $sources = loadSourceDaimonMap();

    $sourcesWithResults = array_filter($sources, fn ($s) => $s['results'] !== null);

    // We expect at least one source with a results daimon in a working install.
    expect($sourcesWithResults)->not->toBeEmpty(
        'No sources found with a results daimon — seed data may be missing'
    );

    $seenSchemas = [];

    foreach ($sourcesWithResults as $source) {
        $resultsSchema = $source['results'];

        expect($resultsSchema)->not->toBeNull(
            "Source [{$source['source_name']}] should have a results schema"
        );

        // Results schema must be unique across sources.
        expect($seenSchemas)->not->toContain(
            $resultsSchema,
            "Results schema '{$resultsSchema}' is duplicated across sources"
        );

        $seenSchemas[] = $resultsSchema;
    }
});

it('results schema != CDM schema for every source', function () {
    if (! localParthenonReachable()) {
        $this->markTestSkipped('Local parthenon database not reachable (CI environment).');
    }
    $sources = loadSourceDaimonMap();

    $sourcesWithResults = array_filter($sources, fn ($s) => $s['results'] !== null);

    foreach ($sourcesWithResults as $source) {
        expect($source['results'])->not->toBe(
            $source['cdm'],
            "Source [{$source['source_name']}]: results schema '{$source['results']}' collides with CDM schema '{$source['cdm']}'"
        );
    }
});

it('every source has a vocabulary daimon', function () {
    if (! localParthenonReachable()) {
        $this->markTestSkipped('Local parthenon database not reachable (CI environment).');
    }
    $sources = loadSourceDaimonMap();

    expect($sources)->not->toBeEmpty('No sources found — seed data may be missing');

    foreach ($sources as $source) {
        expect($source['vocabulary'])->not->toBeNull(
            "Source [{$source['source_name']}] is missing a vocabulary daimon"
        );
    }
});

it('results schema exists in PostgreSQL and accepts SET search_path', function () {
    if (! localParthenonReachable()) {
        $this->markTestSkipped('Local parthenon database not reachable (CI environment).');
    }
    $sources = loadSourceDaimonMap();

    $sourcesWithResults = array_filter($sources, fn ($s) => $s['results'] !== null);

    expect($sourcesWithResults)->not->toBeEmpty();

    foreach ($sourcesWithResults as $source) {
        $resultsSchema = $source['results'];

        // Verify the schema exists in pg_namespace.
        $exists = DB::connection(LOCAL_CONN)
            ->selectOne(
                'SELECT 1 AS ok FROM pg_namespace WHERE nspname = ?',
                [$resultsSchema]
            );

        expect($exists)->not->toBeNull(
            "Results schema '{$resultsSchema}' for source [{$source['source_name']}] does not exist in PostgreSQL"
        );

        // Verify SET search_path succeeds without error.
        DB::connection(LOCAL_CONN)
            ->statement("SET search_path TO \"{$resultsSchema}\",php");

        // If we get here without an exception, the schema is valid.
        expect(true)->toBeTrue();
    }

    // Reset search_path to default.
    DB::connection(LOCAL_CONN)->statement('SET search_path TO app,php');
});
