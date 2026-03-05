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
 * with Achilles results in the achilles_results schema.
 *
 * The 'cdm' Laravel connection is configured via CDM_DB_* env vars in
 * backend/.env (host, database, username, password, search_path=omop,public).
 * The 'results' connection is configured via RESULTS_DB_* env vars
 * (search_path=achilles_results,public).
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
                'source_name'       => 'OHDSI Acumenus CDM',
                'source_dialect'    => 'postgresql',
                'source_connection' => 'cdm',
                'is_cache_enabled'  => false,
            ]
        );

        // CDM and Vocabulary share the omop schema; Results are in achilles_results.
        $daimons = [
            ['daimon_type' => DaimonType::CDM->value,        'table_qualifier' => 'omop',             'priority' => 0],
            ['daimon_type' => DaimonType::Vocabulary->value,  'table_qualifier' => 'omop',             'priority' => 0],
            ['daimon_type' => DaimonType::Results->value,     'table_qualifier' => 'achilles_results', 'priority' => 0],
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
