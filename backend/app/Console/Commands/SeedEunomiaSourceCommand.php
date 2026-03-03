<?php

namespace App\Console\Commands;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Console\Command;

/**
 * Create (or update) the Eunomia GiBleed demo Source in the app database.
 *
 * Usage: php artisan eunomia:seed-source
 *
 * Idempotent: safe to re-run. Uses updateOrCreate on source_key.
 */
class SeedEunomiaSourceCommand extends Command
{
    protected $signature = 'eunomia:seed-source';

    protected $description = 'Register the Eunomia GiBleed demo data source in Parthenon';

    public function handle(): int
    {
        $source = Source::updateOrCreate(
            ['source_key' => 'eunomia'],
            [
                'source_name'     => 'Eunomia GiBleed (Demo)',
                'source_dialect'  => 'postgresql',
                'is_cache_enabled' => false,
            ]
        );

        $daimons = [
            ['daimon_type' => DaimonType::CDM->value,        'table_qualifier' => 'eunomia',          'priority' => 0],
            ['daimon_type' => DaimonType::Vocabulary->value,  'table_qualifier' => 'eunomia',          'priority' => 0],
            ['daimon_type' => DaimonType::Results->value,     'table_qualifier' => 'achilles_results', 'priority' => 0],
        ];

        foreach ($daimons as $daimon) {
            SourceDaimon::updateOrCreate(
                ['source_id' => $source->id, 'daimon_type' => $daimon['daimon_type']],
                ['table_qualifier' => $daimon['table_qualifier'], 'priority' => $daimon['priority']]
            );
        }

        $verb = $source->wasRecentlyCreated ? 'Created' : 'Updated';
        $this->info("✓ {$verb} source: {$source->source_name} (id={$source->id})");

        return self::SUCCESS;
    }
}
