<?php

declare(strict_types=1);

namespace App\Console\Commands\Omop;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class CreateCdmSchemaCommand extends Command
{
    protected $signature = 'omop:create-cdm-schema
        {--dialect=postgresql : Database dialect (postgresql, sqlserver, oracle, etc.)}
        {--host= : Database host}
        {--port=5432 : Database port}
        {--database= : Database name}
        {--username= : Database username}
        {--password= : Database password}
        {--cdm-schema=omop : Target CDM schema name}';

    protected $description = 'Create OMOP CDM v5.4 schema on an external database via the R runtime';

    public function handle(): int
    {
        $host = $this->option('host');
        $database = $this->option('database');

        if (! $host || ! $database) {
            $this->error('--host and --database are required');

            return self::FAILURE;
        }

        $rUrl = rtrim((string) config('services.darkstar.url', 'http://darkstar:8787'), '/');
        $timeout = (int) config('services.darkstar.timeout', 300);

        $this->info("Creating CDM schema '{$this->option('cdm-schema')}' on {$host}…");

        $response = Http::timeout($timeout)->post("{$rUrl}/omop/create-cdm-schema", [
            'dialect' => $this->option('dialect'),
            'host' => $host,
            'port' => (int) $this->option('port'),
            'database' => $database,
            'username' => $this->option('username') ?? '',
            'password' => $this->option('password') ?? '',
            'cdm_schema' => $this->option('cdm-schema'),
        ]);

        $body = $response->json();

        if (! $response->successful() || ($body['status'] ?? '') === 'error') {
            $this->error('CDM schema creation failed: '.($body['message'] ?? $response->body()));

            return self::FAILURE;
        }

        $this->info($body['message'] ?? 'CDM schema created');

        return self::SUCCESS;
    }
}
