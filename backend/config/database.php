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

        'pgsql' => [
            'driver' => 'pgsql',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'ohdsi'),
            'username' => env('DB_USERNAME', 'smudoshi'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => env('DB_CHARSET', 'utf8'),
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => env('DB_SEARCH_PATH', 'app,public'),
            'sslmode' => 'prefer',
        ],

        // CDM connection — used by DQD, ingestion, cohort generation, and other
        // analytical services. On Docker installer deployments this falls back to
        // the Docker postgres / eunomia schema. On Acumenus dev set CDM_DB_* vars
        // (host, database, username) and CDM_DB_SEARCH_PATH=omop,public in .env.
        'cdm' => [
            'driver' => 'pgsql',
            'host' => env('CDM_DB_HOST', env('DB_HOST', '127.0.0.1')),
            'port' => env('CDM_DB_PORT', env('DB_PORT', '5432')),
            'database' => env('CDM_DB_DATABASE', env('DB_DATABASE', 'parthenon')),
            'username' => env('CDM_DB_USERNAME', env('DB_USERNAME', 'parthenon')),
            'password' => env('CDM_DB_PASSWORD', env('DB_PASSWORD', '')),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => env('CDM_DB_SEARCH_PATH', 'eunomia,public'),
            'sslmode' => 'prefer',
        ],

        // Vocabulary/concept lookup connection. Used by AbbyAiService, AchillesResultReaderService,
        // and VocabularyModel. On Docker installer deployments the Eunomia CDM (including vocab
        // tables) is in the 'eunomia' schema of the Docker postgres. On Acumenus dev the vocab
        // is in the 'omop' schema of local PG 17 — set VOCAB_DB_SEARCH_PATH=omop,public in .env.
        'vocab' => [
            'driver' => 'pgsql',
            'host' => env('DB_VOCAB_HOST', env('DB_HOST', '127.0.0.1')),
            'port' => env('DB_VOCAB_PORT', env('DB_PORT', '5432')),
            'database' => env('DB_VOCAB_DATABASE', env('DB_DATABASE', 'parthenon')),
            'username' => env('DB_VOCAB_USERNAME', env('DB_USERNAME', 'parthenon')),
            'password' => env('DB_VOCAB_PASSWORD', env('DB_PASSWORD', '')),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => env('VOCAB_DB_SEARCH_PATH', 'eunomia,public'),
            'sslmode' => 'prefer',
        ],

        // Achilles/DQD results connection. AchillesResultReaderService overrides
        // search_path per-request based on the source's results daimon table_qualifier
        // (e.g. 'achilles_results' for Acumenus, 'eunomia_results' for Eunomia).
        // In Docker installer deployments DB_HOST/DB_DATABASE point to the Docker
        // postgres, so eunomia_results is reachable without any extra env vars.
        'results' => [
            'driver' => 'pgsql',
            'host' => env('RESULTS_DB_HOST', env('DB_HOST', '127.0.0.1')),
            'port' => env('RESULTS_DB_PORT', env('DB_PORT', '5432')),
            'database' => env('RESULTS_DB_DATABASE', env('DB_DATABASE', 'parthenon')),
            'username' => env('RESULTS_DB_USERNAME', env('DB_USERNAME', 'parthenon')),
            'password' => env('RESULTS_DB_PASSWORD', env('DB_PASSWORD', '')),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => env('RESULTS_DB_SEARCH_PATH', 'eunomia_results,public'),
            'sslmode' => 'prefer',
        ],

        // GIS schema connection — connects to local PG 17 (ohdsi database)
        // for OHDSI GIS extension tables (geographic_location, external_exposure, etc.)
        // Used by GIS use-case services. On Docker installs, set GIS_DB_* env vars.
        'gis' => [
            'driver' => 'pgsql',
            'host' => env('GIS_DB_HOST', env('CDM_DB_HOST', '127.0.0.1')),
            'port' => env('GIS_DB_PORT', env('CDM_DB_PORT', '5432')),
            'database' => env('GIS_DB_DATABASE', env('CDM_DB_DATABASE', 'ohdsi')),
            'username' => env('GIS_DB_USERNAME', env('CDM_DB_USERNAME', 'smudoshi')),
            'password' => env('GIS_DB_PASSWORD', env('CDM_DB_PASSWORD', '')),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => env('GIS_DB_SEARCH_PATH', 'gis,omop,public,app'),
            'sslmode' => 'prefer',
        ],

        // Docker PostgreSQL — used by db:sync command to mirror app tables
        // between the local PG (source of truth) and the Docker container PG.
        'docker_pg' => [
            'driver' => 'pgsql',
            'host' => env('DOCKER_DB_HOST', 'postgres'),
            'port' => env('DOCKER_DB_PORT', '5432'),
            'database' => env('DOCKER_DB_DATABASE', 'parthenon'),
            'username' => env('DOCKER_DB_USERNAME', 'parthenon'),
            'password' => env('DOCKER_DB_PASSWORD', 'secret'),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'app,public',
            'sslmode' => 'prefer',
        ],

        // Eunomia GiBleed demo dataset — lives in the Docker postgres (same DB as
        // the app) in the 'eunomia' schema. The schema is populated by pg_restore
        // during Phase 5 of the installer. search_path is set statically here and
        // overridden per-request by AchillesResultReaderService for the results schema.
        'eunomia' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', 'postgres'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('DB_USERNAME', 'parthenon'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'eunomia,public',
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
