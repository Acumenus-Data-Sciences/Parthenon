<?php

namespace App\Console\Commands;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Console\Command;

/**
 * Register the Pancreatic Cancer Multimodal Corpus as a CDM source.
 *
 * Usage: php artisan pancreas:seed-source
 *
 * Idempotent: safe to re-run. Uses updateOrCreate on source_key 'PANCREAS'.
 *
 * The 'pancreas' Laravel connection points to the parthenon database with
 * search_path=pancreas,vocab,php. Vocabulary is shared from the vocab schema.
 */
class SeedPancreasSourceCommand extends Command
{
    protected $signature = 'pancreas:seed-source';

    protected $description = 'Register the Pancreatic Cancer Multimodal Corpus as a CDM source';

    public function handle(): int
    {
        $source = Source::updateOrCreate(
            ['source_key' => 'PANCREAS'],
            [
                'source_name' => 'Pancreatic Cancer Corpus',
                'source_dialect' => 'postgresql',
                'source_connection' => 'pancreas',
                'is_cache_enabled' => false,
            ]
        );

        // CDM in pancreas schema, vocabulary shared from vocab, results in pancreas_results.
        $daimons = [
            ['daimon_type' => DaimonType::CDM->value,        'table_qualifier' => 'pancreas',         'priority' => 0],
            ['daimon_type' => DaimonType::Vocabulary->value,  'table_qualifier' => 'vocab',            'priority' => 0],
            ['daimon_type' => DaimonType::Results->value,     'table_qualifier' => 'pancreas_results', 'priority' => 0],
        ];

        foreach ($daimons as $daimon) {
            SourceDaimon::updateOrCreate(
                ['source_id' => $source->id, 'daimon_type' => $daimon['daimon_type']],
                ['table_qualifier' => $daimon['table_qualifier'], 'priority' => $daimon['priority']]
            );
        }

        $verb = $source->wasRecentlyCreated ? 'Created' : 'Updated';
        $this->info("{$verb} source: {$source->source_name} (key=PANCREAS, id={$source->id})");

        return self::SUCCESS;
    }
}
