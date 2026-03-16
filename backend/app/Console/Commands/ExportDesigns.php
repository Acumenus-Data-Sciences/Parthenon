<?php

namespace App\Console\Commands;

use App\Services\DesignProtection\DesignFixtureExporter;
use Illuminate\Console\Command;

class ExportDesigns extends Command
{
    protected $signature = 'parthenon:export-designs';

    protected $description = 'Export all design entities (cohorts, concept sets, analyses) to git-tracked JSON fixture files';

    public function handle(DesignFixtureExporter $exporter): int
    {
        $this->info('Exporting design fixtures...');

        $summary = $exporter->exportAll();

        $this->info("Exported {$summary->written} files, deleted {$summary->deleted} files, skipped {$summary->skipped} faker-generated.");

        if (! empty($summary->errors)) {
            foreach ($summary->errors as $error) {
                $this->warn("  Error: {$error}");
            }
        }

        // Always exit 0 — export failure must not break a deploy
        return self::SUCCESS;
    }
}
