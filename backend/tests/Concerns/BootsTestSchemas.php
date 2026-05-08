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
     * so they always point at the docker postgres container (`postgres:5432`
     * inside the network) with the seeded `parthenon` superuser, regardless
     * of $_SERVER state.
     */
    private function forceTestConnectionConfig(): void
    {
        $host = $this->detectTestDbHost();
        $port = $host === 'postgres' ? '5432' : '5480';

        foreach ($this->testConnections as $name) {
            $key = "database.connections.$name";
            if (Config::get($key) === null) {
                continue;
            }
            Config::set("$key.host", $host);
            Config::set("$key.port", $port);
            Config::set("$key.database", 'parthenon_testing');
            Config::set("$key.username", 'parthenon');
            Config::set("$key.password", 'secret');
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
     * Resolve a host that this PHP process can reach. Inside the docker
     * `php` service the postgres container is reachable as `postgres`;
     * on the host machine it's `127.0.0.1:5480`.
     */
    private function detectTestDbHost(): string
    {
        // Heuristic: inside the parthenon-php container, /etc/hostname is
        // the container's docker hostname. The host has its own hostname.
        if (gethostbynamel('postgres') !== false) {
            return 'postgres';
        }

        return '127.0.0.1';
    }
}
