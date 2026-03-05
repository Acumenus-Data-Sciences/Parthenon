<?php

namespace App\Services\Database;

use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

/**
 * Builds and registers runtime Laravel database connections from Source metadata.
 *
 * When a Source has db_host set, this factory constructs a PDO-compatible
 * connection config on-the-fly and registers it via config() + DB::purge().
 * Falls back to the named source_connection string for legacy / local sources.
 *
 * Supported dialects: postgresql, redshift, oracle, sqlserver, synapse, snowflake
 * R-proxied dialects (no PHP PDO): databricks, bigquery, duckdb
 */
class DynamicConnectionFactory
{
    /**
     * Return a connection name suitable for DB::connection($name).
     *
     * If the source has db_host set, registers a dynamic connection and returns
     * its name. Otherwise returns source_connection (a named config entry).
     */
    public function connectionName(Source $source): string
    {
        if (empty($source->db_host)) {
            return $source->source_connection ?? 'results';
        }

        $name = 'src_'.$source->id;
        config(["database.connections.{$name}" => $this->buildConfig($source)]);
        DB::purge($name);

        return $name;
    }

    /**
     * Register a schema-specific connection (e.g. for a particular daimon schema).
     *
     * For PostgreSQL / Redshift: sets search_path on the connection.
     * For other dialects: fully-qualified table names are expected; returns base connection.
     */
    public function connectionForSchema(Source $source, string $schema): string
    {
        $base = $this->connectionName($source);

        if (in_array($source->source_dialect, ['postgresql', 'redshift'])) {
            DB::connection($base)->statement("SET search_path TO \"{$schema}\", public");
        }

        return $base;
    }

    /**
     * Build a connection config array for the given source.
     *
     * @return array<string, mixed>
     */
    private function buildConfig(Source $source): array
    {
        /** @var array<string, mixed> $opts */
        $opts = $source->db_options ?? [];

        return match ($source->source_dialect) {
            'postgresql' => [
                'driver' => 'pgsql',
                'host' => $source->db_host,
                'port' => $source->db_port ?? 5432,
                'database' => $source->db_database,
                'username' => $source->username,
                'password' => $source->password,
                'charset' => 'utf8',
                'prefix' => '',
                'schema' => 'public',
                'sslmode' => $opts['sslmode'] ?? 'prefer',
            ],
            'redshift' => [
                'driver' => 'pgsql',
                'host' => $source->db_host,
                'port' => $source->db_port ?? 5439,
                'database' => $source->db_database,
                'username' => $source->username,
                'password' => $source->password,
                'charset' => 'utf8',
                'prefix' => '',
                'schema' => 'public',
                'sslmode' => $opts['sslmode'] ?? 'require',
            ],
            'oracle' => [
                'driver' => 'oci8',
                'host' => $source->db_host,
                'port' => $source->db_port ?? 1521,
                'database' => $source->db_database,
                'username' => $source->username,
                'password' => $source->password,
                'charset' => $opts['charset'] ?? 'AL32UTF8',
                'prefix' => '',
            ],
            'sqlserver', 'synapse' => [
                'driver' => 'sqlsrv',
                'host' => $source->db_host,
                'port' => $source->db_port ?? 1433,
                'database' => $source->db_database,
                'username' => $source->username,
                'password' => $source->password,
                'charset' => 'utf8',
                'prefix' => '',
                'encrypt' => $opts['encrypt'] ?? 'yes',
                'trust_server_certificate' => $opts['trust_server_certificate'] ?? false,
            ],
            'snowflake' => [
                'driver' => 'snowflake',
                'host' => ($opts['account'] ?? $source->db_host).'.snowflakecomputing.com',
                'port' => 443,
                'database' => $source->db_database,
                'username' => $source->username,
                'password' => $source->password,
                'warehouse' => $opts['warehouse'] ?? null,
                'schema' => $opts['schema'] ?? 'PUBLIC',
                'role' => $opts['role'] ?? null,
                'prefix' => '',
            ],
            default => throw new \InvalidArgumentException(
                "Dialect '{$source->source_dialect}' is not supported by DynamicConnectionFactory. ".
                'Use R-service proxy for databricks, bigquery, and duckdb.'
            ),
        };
    }

    /**
     * Attempt a trivial SELECT 1 to verify connectivity.
     *
     * @return array{success: bool, latency_ms: int, error: string|null}
     */
    public function testConnection(Source $source): array
    {
        $start = hrtime(true);
        try {
            $name = $this->connectionName($source);
            DB::connection($name)->select('SELECT 1');
            $ms = (int) round((hrtime(true) - $start) / 1_000_000);

            return ['success' => true, 'latency_ms' => $ms, 'error' => null];
        } catch (\Throwable $e) {
            $ms = (int) round((hrtime(true) - $start) / 1_000_000);

            return ['success' => false, 'latency_ms' => $ms, 'error' => $e->getMessage()];
        }
    }
}
