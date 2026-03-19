<?php

namespace App\Console\Commands;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Console\Command;

/**
 * Register the Acumenus OHDSI CDM as a source in the app database.
 *
 * Usage: php artisan acumenus:seed-source
 *
 * Idempotent: safe to re-run. Uses updateOrCreate on source_key 'ACUMENUS'.
 *
 * This command is for the Acumenus production instance only. It registers
 * the local PostgreSQL 17 OHDSI database (omop schema) as a CDM source,
 * with Achilles results in the results schema.
 *
 * All connections share the same 'parthenon' database configured via
 * DB_HOST/DB_DATABASE/DB_USERNAME/DB_PASSWORD in backend/.env.
 * Schema isolation is via search_path in config/database.php.
 */
class SeedAcumenusSourceCommand extends Command
{
    protected $signature = 'acumenus:seed-source';

    protected $description = 'Register the Acumenus OHDSI CDM as a source (production instance only)';

    public function handle(): int
    {
        $source = Source::updateOrCreate(
            ['source_key' => 'ACUMENUS'],
            [
                'source_name' => 'OHDSI Acumenus CDM',
                'source_dialect' => 'postgresql',
                'source_connection' => 'omop',
                'is_cache_enabled' => false,
            ]
        );

        // CDM and Vocabulary share the omop schema; Results are in the results schema.
        $daimons = [
            ['daimon_type' => DaimonType::CDM->value,        'table_qualifier' => 'omop',    'priority' => 0],
            ['daimon_type' => DaimonType::Vocabulary->value,  'table_qualifier' => 'omop',    'priority' => 0],
            ['daimon_type' => DaimonType::Results->value,     'table_qualifier' => 'results', 'priority' => 0],
        ];

        foreach ($daimons as $daimon) {
            SourceDaimon::updateOrCreate(
                ['source_id' => $source->id, 'daimon_type' => $daimon['daimon_type']],
                ['table_qualifier' => $daimon['table_qualifier'], 'priority' => $daimon['priority']]
            );
        }

        $verb = $source->wasRecentlyCreated ? 'Created' : 'Updated';
        $this->info("✓ {$verb} source: {$source->source_name} (key=ACUMENUS, id={$source->id})");

        return self::SUCCESS;
    }
}
