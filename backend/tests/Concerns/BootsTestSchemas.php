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
     * Patch *_testing connection config ONLY when it is obviously broken
     * (host.docker.internal leaked from backend/.env, or username=smudoshi
     * because env() picked up the OS user). In a healthy context (GitHub
     * Actions runner with DB_HOST/DB_PORT in workflow env) leave the
     * config alone — the trait must not stomp over correct values.
     */
    private function forceTestConnectionConfig(): void
    {
        $changed = false;
        foreach ($this->testConnections as $name) {
            $key = "database.connections.$name";
            if (Config::get($key) === null) {
                continue;
            }
            if ($this->maybePatchConnection($key)) {
                $changed = true;
            }
        }

        if ($changed) {
            DB::purge();
            foreach ($this->testConnections as $name) {
                DB::purge($name);
            }
        }
    }

    /**
     * Returns true when at least one field on the connection was rewritten.
     */
    private function maybePatchConnection(string $configKey): bool
    {
        $changed = false;
        $host = (string) Config::get("$configKey.host");
        $username = (string) Config::get("$configKey.username");
        $database = (string) Config::get("$configKey.database");

        // host.docker.internal leaks from backend/.env when the parthenon-php
        // container ran the suite. Inside that container, postgres:5432 is
        // the right destination; skip the rewrite if we cannot resolve it.
        if ($host === 'host.docker.internal' && gethostbynamel('postgres') !== false) {
            Config::set("$configKey.host", 'postgres');
            Config::set("$configKey.port", 5432);
            $changed = true;
        }

        // env() returned the OS user when phpunit.xml lacked force="true"
        // and $_SERVER was empty. Replace with the seeded test superuser.
        $brokenUsernames = ['', 'smudoshi', 'DB_USERNAME_NOT_SET'];
        if (in_array($username, $brokenUsernames, true)) {
            Config::set("$configKey.username", 'parthenon');
            Config::set("$configKey.password", 'secret');
            $changed = true;
        }

        if ($database === '' || $database === 'DB_DATABASE_NOT_SET') {
            Config::set("$configKey.database", 'parthenon_testing');
            $changed = true;
        }

        return $changed;
    }
}
