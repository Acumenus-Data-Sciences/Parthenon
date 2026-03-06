<?php

namespace App\Console\Commands;

use App\Models\App\Source;
use App\Services\Achilles\AchillesResultReaderService;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;

class SolrIndexAnalyses extends Command
{
    protected $signature = 'solr:index-analyses
        {--source= : Only index analyses for a specific source ID}
        {--fresh : Delete all documents before indexing}';

    protected $description = 'Index Achilles analysis metadata into the Solr analyses core';

    public function handle(SolrClientWrapper $solr, AchillesResultReaderService $reader): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = config('solr.cores.analyses', 'analyses');

        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the Solr container running?");

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->info('Deleting all existing documents...');
            $solr->deleteAll($core);
        }

        $sourceId = $this->option('source');
        $sources = $sourceId
            ? Source::where('id', $sourceId)->get()
            : Source::whereHas('daimons', fn ($q) => $q->where('daimon_type', 'results'))->get();

        if ($sources->isEmpty()) {
            $this->warn('No sources with results daimons found.');

            return self::SUCCESS;
        }

        $indexed = 0;
        $errors = 0;
        $startTime = microtime(true);

        foreach ($sources as $source) {
            $this->info("Indexing analyses for source: {$source->source_name} (ID: {$source->id})...");

            try {
                $analyses = $reader->getAvailableAnalyses($source);
            } catch (\Throwable $e) {
                $this->warn("  Failed to read analyses for source {$source->id}: {$e->getMessage()}");
                $errors++;

                continue;
            }

            if (empty($analyses)) {
                $this->line("  No analyses with results found.");

                continue;
            }

            $docs = [];
            foreach ($analyses as $analysis) {
                $docs[] = [
                    'id' => "s{$source->id}_a{$analysis['analysis_id']}",
                    'analysis_id' => $analysis['analysis_id'],
                    'analysis_name' => $analysis['analysis_name'] ?? "Analysis {$analysis['analysis_id']}",
                    'category' => $analysis['category'] ?? 'Uncategorized',
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'row_count' => $analysis['row_count'] ?? 0,
                ];
            }

            // Batch add in chunks of 200
            foreach (array_chunk($docs, 200) as $batch) {
                if ($solr->addDocuments($core, $batch)) {
                    $indexed += count($batch);
                } else {
                    $errors += count($batch);
                }
            }

            $this->info("  Indexed {$indexed} analyses for {$source->source_name}");
        }

        $this->info('Committing...');
        $solr->commit($core);

        $elapsed = round(microtime(true) - $startTime, 1);
        $docCount = $solr->documentCount($core);

        $this->info("Total indexed: {$indexed} | Errors: {$errors} | Time: {$elapsed}s");
        $this->info("Solr document count: {$docCount}");

        if ($errors > 0) {
            $this->warn("Completed with {$errors} errors.");

            return self::FAILURE;
        }

        $this->info('Analyses indexing complete.');

        return self::SUCCESS;
    }
}
