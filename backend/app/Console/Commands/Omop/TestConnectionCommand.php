<?php

declare(strict_types=1);

namespace App\Console\Commands\Omop;

use App\Models\App\Source;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class TestConnectionCommand extends Command
{
    protected $signature = 'omop:test-connection
        {--source-key= : Registered source key to test}
        {--dialect=postgresql : Dialect for raw credential test}
        {--host= : Database host}
        {--port= : Database port}
        {--database= : Database name}
        {--username= : Username}
        {--password= : Password}';

    protected $description = 'Test connectivity to an external OMOP CDM database';

    public function handle(): int
    {
        [$driver, $host, $port, $database, $username, $password] = $this->resolveParams();

        if (! $host || ! $database) {
            $this->error('Provide --source-key or --host + --database');

            return self::FAILURE;
        }

        $pdoDialects = ['pgsql', 'sqlsrv', 'mysql'];
        if (! in_array($driver, $pdoDialects, true)) {
            $this->warn("Dialect driver '{$driver}' does not support PHP PDO. Skipping connection test.");

            return self::SUCCESS;
        }

        $connName = 'omop_test_'.uniqid();

        try {
            config([
                "database.connections.{$connName}" => [
                    'driver' => $driver,
                    'host' => $host,
                    'port' => (int) $port,
                    'database' => $database,
                    'username' => $username ?? '',
                    'password' => $password ?? '',
                    'charset' => 'utf8',
                    'options' => [\PDO::ATTR_TIMEOUT => 10],
                ],
            ]);

            DB::connection($connName)->getPdo();
            DB::purge($connName);

            $this->info("Connection successful: {$host}/{$database}");

            return self::SUCCESS;
        } catch (\Exception $e) {
            DB::purge($connName);
            $this->error("Connection failed: {$e->getMessage()}");

            return self::FAILURE;
        }
    }

    /** @return array{string, string|null, string|int, string|null, string|null, string|null} */
    private function resolveParams(): array
    {
        if ($key = $this->option('source-key')) {
            $source = Source::where('source_key', $key)->first();
            if (! $source) {
                $this->error("Source '{$key}' not found.");

                return ['pgsql', null, 5432, null, null, null];
            }

            return [
                $this->dialectToDriver($source->source_dialect ?? 'postgresql'),
                $source->db_host,
                $source->db_port ?? 5432,
                $source->db_database,
                $source->username,
                $source->password,
            ];
        }

        return [
            $this->dialectToDriver($this->option('dialect') ?? 'postgresql'),
            $this->option('host'),
            $this->option('port') ?? 5432,
            $this->option('database'),
            $this->option('username'),
            $this->option('password'),
        ];
    }

    private function dialectToDriver(string $dialect): string
    {
        return match ($dialect) {
            'sqlserver', 'synapse' => 'sqlsrv',
            'mysql' => 'mysql',
            default => 'pgsql',
        };
    }
}
