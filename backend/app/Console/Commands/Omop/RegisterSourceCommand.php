<?php

declare(strict_types=1);

namespace App\Console\Commands\Omop;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Console\Command;

class RegisterSourceCommand extends Command
{
    protected $signature = 'omop:register-source
        {--source-key= : Unique source key (e.g. EXT_OMOP_CDM)}
        {--name= : Display name}
        {--dialect=postgresql : Database dialect (postgresql, sqlserver, oracle, etc.)}
        {--host= : Database host}
        {--port= : Database port}
        {--database= : Database name}
        {--username= : Database username}
        {--password= : Database password}
        {--cdm-schema=omop : CDM schema name}
        {--vocab-schema=vocab : Vocabulary schema name}
        {--results-schema=results : Results schema name}';

    protected $description = 'Register an external OMOP CDM database as a Parthenon data source';

    public function handle(): int
    {
        $key = $this->option('source-key');
        if (! $key) {
            $this->error('--source-key is required');

            return self::FAILURE;
        }

        $host = $this->option('host');
        $database = $this->option('database');
        if (! $host || ! $database) {
            $this->error('--host and --database are required');

            return self::FAILURE;
        }

        $source = Source::updateOrCreate(
            ['source_key' => $key],
            [
                'source_name' => $this->option('name') ?? $key,
                'source_dialect' => $this->option('dialect') ?? 'postgresql',
                'source_connection' => 'dynamic',
                'db_host' => $this->option('host'),
                'db_port' => $this->option('port') ? (int) $this->option('port') : null,
                'db_database' => $this->option('database'),
                'username' => $this->option('username'),
                'password' => $this->option('password'),
                'is_cache_enabled' => false,
            ]
        );

        $daimons = [
            ['daimon_type' => DaimonType::CDM->value,       'table_qualifier' => $this->option('cdm-schema'),     'priority' => 0],
            ['daimon_type' => DaimonType::Vocabulary->value, 'table_qualifier' => $this->option('vocab-schema'),   'priority' => 0],
            ['daimon_type' => DaimonType::Results->value,    'table_qualifier' => $this->option('results-schema'), 'priority' => 0],
        ];

        foreach ($daimons as $daimon) {
            SourceDaimon::updateOrCreate(
                ['source_id' => $source->id, 'daimon_type' => $daimon['daimon_type']],
                ['table_qualifier' => $daimon['table_qualifier'], 'priority' => $daimon['priority']]
            );
        }

        $verb = $source->wasRecentlyCreated ? 'Created' : 'Updated';
        $this->info("{$verb} source: {$source->source_name} (key={$key}, id={$source->id})");

        return self::SUCCESS;
    }
}
