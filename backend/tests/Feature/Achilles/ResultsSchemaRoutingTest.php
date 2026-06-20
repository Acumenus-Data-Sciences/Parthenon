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

use App\Context\SourceContext;
use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Support\Facades\DB;

const LOCAL_CONN = 'local_parthenon';

/**
 * @return array{host: string, port: string, database: string, username: string, password: ?string}
 */
function localParthenonTarget(): array
{
    return [
        'host' => (string) env('ACHILLES_ROUTING_DB_HOST', '127.0.0.1'),
        'port' => (string) env('ACHILLES_ROUTING_DB_PORT', '5432'),
        'database' => (string) env('ACHILLES_ROUTING_DB_DATABASE', 'parthenon'),
        'username' => (string) env('ACHILLES_ROUTING_DB_USERNAME', 'parthenon'),
        'password' => env('ACHILLES_ROUTING_DB_PASSWORD'),
    ];
}

function localParthenonUnavailableReason(): ?string
{
    static $checked = false;
    static $reason = null;

    if ($checked) {
        return $reason;
    }

    $checked = true;
    $target = localParthenonTarget();

    try {
        ensureLocalConnection();
        DB::connection(LOCAL_CONN)->getPdo();

        foreach (['app.sources', 'app.source_daimons'] as $table) {
            $exists = DB::connection(LOCAL_CONN)->selectOne(
                'SELECT to_regclass(?) AS relation_name',
                [$table],
            );

            if ($exists === null || $exists->relation_name === null) {
                $reason = "Local parthenon database is reachable at {$target['host']}:{$target['port']}/{$target['database']} but {$table} is missing; set ACHILLES_ROUTING_DB_* to a migrated app catalog to run this live smoke.";

                return $reason;
            }
        }

        return null;
    } catch (Throwable $e) {
        $reason = "Local parthenon database is not reachable at {$target['host']}:{$target['port']}/{$target['database']}: {$e->getMessage()}";

        return $reason;
    }
}

function skipUnlessLocalParthenonCatalogAvailable(): void
{
    $reason = localParthenonUnavailableReason();

    if ($reason !== null) {
        test()->markTestSkipped($reason);
    }
}

function quotePgIdentifier(string $identifier): string
{
    return '"'.str_replace('"', '""', $identifier).'"';
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

    $target = localParthenonTarget();

    config([
        'database.connections.'.LOCAL_CONN => [
            'driver' => 'pgsql',
            'host' => $target['host'],
            'port' => $target['port'],
            'database' => $target['database'],
            'username' => $target['username'],
            'password' => $target['password'],
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'app,php',
            'sslmode' => 'prefer',
        ],
    ]);
}

it('registers distinct source-context connections from Achilles daimons', function () {
    config([
        'database.connections.achilles_routing_base' => array_merge(
            config('database.connections.pgsql_testing'),
            ['search_path' => 'app,php,public'],
        ),
    ]);

    $source = new Source([
        'source_name' => 'Achilles routing fixture',
        'source_key' => 'ACHILLES_ROUTING_FIXTURE',
        'source_dialect' => 'postgresql',
        'source_connection' => 'achilles_routing_base',
    ]);
    $source->id = 42;
    $source->setRelation('daimons', collect([
        new SourceDaimon([
            'daimon_type' => DaimonType::CDM->value,
            'table_qualifier' => 'achilles_cdm',
            'priority' => 1,
        ]),
        new SourceDaimon([
            'daimon_type' => DaimonType::Results->value,
            'table_qualifier' => 'achilles_results',
            'priority' => 1,
        ]),
        new SourceDaimon([
            'daimon_type' => DaimonType::Vocabulary->value,
            'table_qualifier' => 'achilles_vocab',
            'priority' => 1,
        ]),
    ]));

    $ctx = SourceContext::forSource($source);

    expect($ctx->cdmSchema)->toBe('achilles_cdm')
        ->and($ctx->resultsSchema)->toBe('achilles_results')
        ->and($ctx->vocabSchema)->toBe('achilles_vocab')
        ->and($ctx->cdmConnection())->toBe('ctx_cdm')
        ->and($ctx->resultsConnection())->toBe('ctx_results')
        ->and($ctx->vocabConnection())->toBe('ctx_vocab')
        ->and(config('database.connections.ctx_cdm.search_path'))->toBe('"achilles_cdm","achilles_vocab",public')
        ->and(config('database.connections.ctx_results.search_path'))->toBe('"achilles_results","achilles_vocab",public')
        ->and(config('database.connections.ctx_vocab.search_path'))->toBe('"achilles_vocab",public');
});

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
    skipUnlessLocalParthenonCatalogAvailable();

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
    skipUnlessLocalParthenonCatalogAvailable();

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
    skipUnlessLocalParthenonCatalogAvailable();

    $sources = loadSourceDaimonMap();

    expect($sources)->not->toBeEmpty('No sources found — seed data may be missing');

    foreach ($sources as $source) {
        expect($source['vocabulary'])->not->toBeNull(
            "Source [{$source['source_name']}] is missing a vocabulary daimon"
        );
    }
});

it('results schema exists in PostgreSQL and accepts SET search_path', function () {
    skipUnlessLocalParthenonCatalogAvailable();

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
            ->statement('SET search_path TO '.quotePgIdentifier($resultsSchema).',php');

        // If we get here without an exception, the schema is valid.
        expect(true)->toBeTrue();
    }

    // Reset search_path to default.
    DB::connection(LOCAL_CONN)->statement('SET search_path TO app,php');
});
