<?php

declare(strict_types=1);

namespace App\Console\Commands\Omop;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Console\Command;

class LoadVocabularyCommand extends Command
{
    protected $signature = 'omop:load-vocabulary
        {--source-key= : Registered source key}
        {--zip= : Path to Athena vocabulary ZIP file}';

    protected $description = 'Load Athena OMOP vocabulary ZIP into an external source\'s vocabulary schema';

    public function handle(): int
    {
        $key = $this->option('source-key');
        $zip = $this->option('zip');

        if (! $key || ! $zip) {
            $this->error('--source-key and --zip are required');

            return self::FAILURE;
        }

        $source = Source::where('source_key', $key)->first();
        if (! $source) {
            $this->error("Source '{$key}' not found.");

            return self::FAILURE;
        }

        if (! file_exists((string) $zip)) {
            $this->error("ZIP file not found: {$zip}");

            return self::FAILURE;
        }

        $vocabDaimon = SourceDaimon::where('source_id', $source->id)
            ->where('daimon_type', DaimonType::Vocabulary->value)
            ->first();

        $vocabSchema = $vocabDaimon?->table_qualifier ?? 'vocab';

        $this->info("Source '{$key}' vocabulary schema: {$vocabSchema}");
        $this->info("ZIP: {$zip}");
        $this->info("Target: {$source->db_host}/{$source->db_database}.{$vocabSchema}");

        // The actual vocabulary loading for external sources requires vocabulary:import (not yet
        // implemented) to support --connection and --schema targeting. Prerequisites are validated;
        // run parthenon:load-vocabularies manually with a dynamic DB connection targeting this source.
        $this->warn(
            'Vocabulary import for external sources requires a connection-aware import command. '
            .'Prerequisites validated successfully — configure the external DB connection and run '
            .'parthenon:load-vocabularies --zip targeting this source\'s vocabulary schema.'
        );

        return self::SUCCESS;
    }
}
