<?php

declare(strict_types=1);

namespace Tests\Concerns;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

/**
 * Force the *_testing DB connections to point at the docker postgres
 * container regardless of what backend/.env or phpunit.xml put in $_SERVER,
 * then ensure the schemas that migrations need exist before RefreshDatabase
 * runs.
 *
 * Why config override instead of phpunit.xml `force="true"`:
 * Laravel's `env()` helper prefers $_SERVER. PHPUnit's `force="true"` does
 * not reliably overwrite an already-set $_SERVER entry. backend/.env values
 * leak into $_SERVER at container start, so phpunit's overrides are silently
 * lost — pgsql_testing ends up trying to talk to host PG17 with the OS user.
 * Overriding `config('database.connections.*')` runtime bypasses env()
 * entirely.
 *
 * Idempotent (CREATE SCHEMA IF NOT EXISTS). Safe to run on every test boot.
 */
trait BootsTestSchemas
{
    /**
     * Schemas referenced by `search_path` across the *_testing connection
     * definitions in `backend/config/database.php`. Add new entries when
     * introducing a new connection.
     *
     * @var list<string>
     */
    protected array $testSchemas = [
        'app',
        'php',
        'vocab',
        'omop',
        'results',
        'gis',
        'finngen',
        'inpatient',
        'inpatient_ext',
        'eunomia',
        'pancreas',
        'temp_abby',
    ];

    /**
     * @var list<string>
     */
    protected array $testConnections = [
        'pgsql_testing',
        'inpatient_testing',
        'finngen_testing',
        'finngen_ro_testing',
    ];

    protected function bootTestSchemas(): void
    {
        $this->forceTestConnectionConfig();

        $connection = DB::connection('pgsql_testing');
        foreach ($this->testSchemas as $schema) {
            // Schema names cannot be bound via PDO placeholders. The
            // hard-coded whitelist above guards against injection.
            $connection->statement(sprintf('CREATE SCHEMA IF NOT EXISTS %s', $schema));
        }
    }

    /**
     * Override every *_testing connection's host/port/credentials at runtime
     * so they actually reach a usable Postgres regardless of $_SERVER state.
     *
     * Resolution order:
     *   1. If `postgres` resolves (we're inside docker) → postgres:5432
     *   2. Else use getenv('DB_TEST_HOST') / 'DB_HOST' (set by CI workflow
     *      env or phpunit.xml force=true), default 127.0.0.1
     *   3. Same for port (defaults to 5432)
     */
    private function forceTestConnectionConfig(): void
    {
        [$host, $port] = $this->resolveTestDbAddress();
        $username = (string) (getenv('DB_TEST_USERNAME') ?: getenv('DB_USERNAME') ?: 'parthenon');
        // env() leaked smudoshi via $_SERVER. Force the test seed user
        // unless the workflow explicitly sets a different one.
        if ($username === 'smudoshi' || $username === '') {
            $username = 'parthenon';
        }
        $password = (string) (getenv('DB_TEST_PASSWORD') ?: getenv('DB_PASSWORD') ?: 'secret');

        foreach ($this->testConnections as $name) {
            $key = "database.connections.$name";
            if (Config::get($key) === null) {
                continue;
            }
            Config::set("$key.host", $host);
            Config::set("$key.port", $port);
            Config::set("$key.database", 'parthenon_testing');
            Config::set("$key.username", $username);
            Config::set("$key.password", $password);
            Config::set("$key.sslmode", 'prefer');
        }

        // Drop any cached connection objects so the new config takes effect
        // on the next DB::connection(...) call.
        DB::purge();
        foreach ($this->testConnections as $name) {
            DB::purge($name);
        }
    }

    /**
     * @return array{0:string,1:string} [host, port]
     */
    private function resolveTestDbAddress(): array
    {
        // Inside docker (parthenon-php container): postgres service hostname
        // resolves and we should use it directly.
        if (gethostbynamel('postgres') !== false) {
            return ['postgres', '5432'];
        }

        // GitHub Actions / host-side: respect the workflow's env vars.
        $host = (string) (getenv('DB_TEST_HOST') ?: getenv('DB_HOST') ?: '127.0.0.1');
        $port = (string) (getenv('DB_TEST_PORT') ?: getenv('DB_PORT') ?: '5432');

        // Defensive: if container env leaked host.docker.internal here we
        // would fail with the OS user. Force a sane default.
        if ($host === 'host.docker.internal') {
            $host = '127.0.0.1';
            $port = '5432';
        }

        return [$host, $port];
    }
}
