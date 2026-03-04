<?php

namespace App\Console\Commands;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Console\Command;

/**
 * Register the Eunomia GiBleed demo dataset as a CDM source in the app database.
 *
 * Usage: php artisan eunomia:seed-source
 *
 * Idempotent: safe to re-run. Uses updateOrCreate on source_key 'EUNOMIA'.
 *
 * Called by the installer (Phase 5) after pg_restore has loaded the eunomia schema
 * into the Docker postgres container. The 'eunomia' Laravel connection points to
 * that same Docker postgres with search_path=eunomia.
 *
 * Also removes any stale 'ohdsi-acumenus' source created by earlier versions of
 * DatabaseSeeder so the app shows only the Eunomia demo on a fresh install.
 */
class SeedEunomiaSourceCommand extends Command
{
    protected $signature = 'eunomia:seed-source';

    protected $description = 'Register the Eunomia GiBleed demo dataset as a CDM source';

    public function handle(): int
    {
        // Remove the Acumenus dev source if present from a previous seeder version.
        // Safe to delete — source_daimons cascade on source deletion.
        $removed = Source::where('source_key', 'ohdsi-acumenus')->delete();
        if ($removed) {
            $this->line("  Removed stale 'ohdsi-acumenus' source from previous seeder version.");
        }

        $source = Source::updateOrCreate(
            ['source_key' => 'EUNOMIA'],
            [
                'source_name'       => 'Eunomia GiBleed',
                'source_dialect'    => 'postgresql',
                'source_connection' => 'eunomia',
                'is_cache_enabled'  => false,
            ]
        );

        // CDM and Vocabulary share the eunomia schema; Results are in eunomia_results.
        $daimons = [
            ['daimon_type' => DaimonType::CDM->value,       'table_qualifier' => 'eunomia',         'priority' => 0],
            ['daimon_type' => DaimonType::Vocabulary->value, 'table_qualifier' => 'eunomia',         'priority' => 0],
            ['daimon_type' => DaimonType::Results->value,    'table_qualifier' => 'eunomia_results', 'priority' => 0],
        ];

        foreach ($daimons as $daimon) {
            SourceDaimon::updateOrCreate(
                ['source_id' => $source->id, 'daimon_type' => $daimon['daimon_type']],
                ['table_qualifier' => $daimon['table_qualifier'], 'priority' => $daimon['priority']]
            );
        }

        $verb = $source->wasRecentlyCreated ? 'Created' : 'Updated';
        $this->info("✓ {$verb} source: {$source->source_name} (key=EUNOMIA, id={$source->id})");

        return self::SUCCESS;
    }
}
