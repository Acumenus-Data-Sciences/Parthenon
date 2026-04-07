<?php

use Illuminate\Support\Str;

return [

    /*
    |--------------------------------------------------------------------------
    | Default Database Connection Name
    |--------------------------------------------------------------------------
    |
    | Here you may specify which of the database connections below you wish
    | to use as your default connection for database operations. This is
    | the connection which will be utilized unless another connection
    | is explicitly specified when you execute a query / statement.
    |
    */

    'default' => env('DB_CONNECTION', 'pgsql'),

    /*
    |--------------------------------------------------------------------------
    | Database Connections
    |--------------------------------------------------------------------------
    |
    | Below are all of the database connections defined for your application.
    | An example configuration is provided for each database system which
    | is supported by Laravel. You're free to add / remove connections.
    |
    */

    'connections' => [

        'sqlite' => [
            'driver' => 'sqlite',
            'url' => env('DB_URL'),
            'database' => env('DB_DATABASE', database_path('database.sqlite')),
            'prefix' => '',
            'foreign_key_constraints' => env('DB_FOREIGN_KEYS', true),
            'busy_timeout' => null,
            'journal_mode' => null,
            'synchronous' => null,
        ],

        'mysql' => [
            'driver' => 'mysql',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '3306'),
            'database' => env('DB_DATABASE', 'laravel'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => env('DB_CHARSET', 'utf8mb4'),
            'collation' => env('DB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        'mariadb' => [
            'driver' => 'mariadb',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '3306'),
            'database' => env('DB_DATABASE', 'laravel'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => env('DB_CHARSET', 'utf8mb4'),
            'collation' => env('DB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
            ]) : [],
        ],

        // ────────────────────────────────────────────────────────────────────
        // SINGLE-DATABASE ARCHITECTURE
        // All connections point to the same 'parthenon' database.
        // Schema isolation via search_path:
        //   pgsql     → app,php                      (application tables, Laravel internals)
        //   omop      → omop,vocab,php                (CDM + shared vocabulary)
        //   results   → results,php                  (Achilles/DQD output)
        //   gis       → gis,omop,vocab,php           (geospatial + CDM + vocab lookup)
        //   eunomia   → eunomia,php                  (demo dataset)
        //   inpatient → inpatient,inpatient_ext,vocab (Morpheus inpatient CDM + extensions + shared vocab)
        // ────────────────────────────────────────────────────────────────────

        'pgsql' => [
            'driver' => 'pgsql',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('DB_USERNAME', 'parthenon'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => env('DB_CHARSET', 'utf8'),
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'app,php,public',
            'sslmode' => 'prefer',
        ],

        // Dedicated PostgreSQL connection for test execution. This must never
        // resolve to the live application database.
        'pgsql_testing' => [
            'driver' => 'pgsql',
            'url' => env('DB_TEST_URL'),
            'host' => env('DB_TEST_HOST', env('DB_HOST', '127.0.0.1')),
            'port' => env('DB_TEST_PORT', env('DB_PORT', '5432')),
            'database' => env('DB_TEST_DATABASE', 'parthenon_testing'),
            'username' => env('DB_TEST_USERNAME', env('DB_USERNAME', 'parthenon')),
            'password' => env('DB_TEST_PASSWORD', env('DB_PASSWORD', '')),
            'charset' => env('DB_CHARSET', 'utf8'),
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'app,php,public',
            'sslmode' => 'prefer',
        ],

        // OMOP CDM + Vocabulary — used by DQD, ingestion, cohort generation,
        // AbbyAI, and all clinical data services. Vocabulary tables live in
        // the shared 'vocab' schema; CDM clinical tables remain in 'omop'.
        'omop' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('DB_USERNAME', 'parthenon'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'omop,vocab,php',
            'sslmode' => 'prefer',
        ],

        // Vocabulary-first — used by VocabularyModel as default when no
        // SourceContext is active. Puts vocab before omop so that
        // vocab.concept (7M rows) is resolved before omop.concept (CDM).
        'vocab' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('DB_USERNAME', 'parthenon'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'vocab,omop,php',
            'sslmode' => 'prefer',
        ],

        // Achilles/DQD results. AchillesResultReaderService overrides
        // search_path per-request based on source daimon table_qualifier
        // (e.g. 'results' for Acumenus, 'eunomia_results' for Eunomia).
        'results' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('DB_USERNAME', 'parthenon'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'results,php',
            'sslmode' => 'prefer',
        ],

        // GIS extension tables (geographic_location, external_exposure, etc.)
        // search_path includes omop for CDM lookups and vocab for vocabulary.
        'gis' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('DB_USERNAME', 'parthenon'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'gis,omop,vocab,php',
            'sslmode' => 'prefer',
        ],

        // Eunomia GiBleed demo dataset — populated by pg_restore during
        // installer Phase 5. Used as an alternative CDM source for demos.
        'eunomia' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('DB_USERNAME', 'parthenon'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'eunomia,php',
            'sslmode' => 'prefer',
        ],

        // Morpheus inpatient CDM — schema-isolated OMOP CDM for inpatient
        // clinical data. Extension tables in inpatient_ext, shared vocabulary
        // from vocab schema.
        'inpatient' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('DB_USERNAME', 'parthenon'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'inpatient,inpatient_ext,vocab',
            'sslmode' => 'prefer',
        ],

        // Pancreatic Cancer Corpus CDM — schema-isolated OMOP CDM for
        // multimodal pancreatic cancer research dataset. Shared vocabulary
        // from vocab schema.
        'pancreas' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('DB_USERNAME', 'parthenon'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'pancreas,vocab,php',
            'sslmode' => 'prefer',
        ],

        // Data interrogation — read-only CDM access for Abby AI analytics.
        // Uses dedicated abby_analyst role with SELECT-only on omop/results/vocab
        // and full access to temp_abby scratch schema.
        'interrogation' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('ABBY_ANALYST_USERNAME', 'abby_analyst'),
            'password' => env('ABBY_ANALYST_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'omop,vocab,results,temp_abby',
            'sslmode' => 'prefer',
        ],

        'sqlsrv' => [
            'driver' => 'sqlsrv',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', 'localhost'),
            'port' => env('DB_PORT', '1433'),
            'database' => env('DB_DATABASE', 'laravel'),
            'username' => env('DB_USERNAME', 'root'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => env('DB_CHARSET', 'utf8'),
            'prefix' => '',
            'prefix_indexes' => true,
            // 'encrypt' => env('DB_ENCRYPT', 'yes'),
            // 'trust_server_certificate' => env('DB_TRUST_SERVER_CERTIFICATE', 'false'),
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Migration Repository Table
    |--------------------------------------------------------------------------
    |
    | This table keeps track of all the migrations that have already run for
    | your application. Using this information, we can determine which of
    | the migrations on disk haven't actually been run on the database.
    |
    */

    'migrations' => [
        'table' => 'migrations',
        'update_date_on_publish' => true,
    ],

    /*
    |--------------------------------------------------------------------------
    | Redis Databases
    |--------------------------------------------------------------------------
    |
    | Redis is an open source, fast, and advanced key-value store that also
    | provides a richer body of commands than a typical key-value system
    | such as Memcached. You may define your connection settings here.
    |
    */

    'redis' => [

        'client' => env('REDIS_CLIENT', 'phpredis'),

        'options' => [
            'cluster' => env('REDIS_CLUSTER', 'redis'),
            'prefix' => env('REDIS_PREFIX', Str::slug(env('APP_NAME', 'laravel'), '_').'_database_'),
        ],

        'default' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_DB', '0'),
        ],

        'cache' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_CACHE_DB', '1'),
        ],

    ],

];
