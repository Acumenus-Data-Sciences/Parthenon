<?php

namespace App\Console\Commands;

use App\Models\App\ConceptMapping;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;

class SolrIndexMappings extends Command
{
    protected $signature = 'solr:index-mappings
        {--job= : Only index mappings for a specific ingestion job ID}
        {--fresh : Delete all documents before indexing}';

    protected $description = 'Index concept mappings into the Solr mappings core';

    public function handle(SolrClientWrapper $solr): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = config('solr.cores.mappings', 'mappings');

        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the Solr container running?");

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->info('Deleting all existing documents...');
            $solr->deleteAll($core);
        }

        $jobId = $this->option('job');

        $query = ConceptMapping::with(['ingestionJob', 'candidates' => function ($q) {
            $q->orderBy('rank')->limit(1);
        }]);

        if ($jobId) {
            $query->where('ingestion_job_id', (int) $jobId);
        }

        $indexed = 0;
        $errors = 0;
        $startTime = microtime(true);

        // Cache job metadata to avoid repeated lookups
        $jobCache = [];

        $query->chunkById(500, function ($mappings) use ($solr, $core, &$indexed, &$errors, &$jobCache) {
            $docs = [];

            foreach ($mappings as $mapping) {
                $job = $mapping->ingestionJob;
                if (! $job) {
                    continue;
                }

                // Cache job file name
                if (! isset($jobCache[$job->id])) {
                    $config = $job->config_json ?? [];
                    $jobCache[$job->id] = $config['original_filename'] ?? "Job #{$job->id}";
                }

                // Get best candidate concept name
                $topCandidate = $mapping->candidates->first();
                $targetName = $topCandidate?->concept_name ?? '';

                $docs[] = [
                    'id' => (string) $mapping->id,
                    'ingestion_job_id' => $mapping->ingestion_job_id,
                    'source_code' => $mapping->source_code ?? '',
                    'source_description' => $mapping->source_description ?? '',
                    'source_vocabulary_id' => $mapping->source_vocabulary_id ?? '',
                    'target_concept_id' => $mapping->target_concept_id ?? 0,
                    'target_concept_name' => $targetName,
                    'target_domain_id' => $topCandidate?->domain_id ?? '',
                    'confidence' => (float) ($mapping->confidence ?? 0),
                    'strategy' => $mapping->strategy ?? '',
                    'review_tier' => $mapping->review_tier?->value ?? '',
                    'is_reviewed' => (bool) $mapping->is_reviewed,
                    'source_table' => $mapping->source_table ?? '',
                    'source_column' => $mapping->source_column ?? '',
                    'source_frequency' => $mapping->source_frequency ?? 0,
                    'job_file_name' => $jobCache[$job->id],
                    'created_at' => $mapping->created_at?->toIso8601String(),
                ];
            }

            if (! empty($docs)) {
                if ($solr->addDocuments($core, $docs)) {
                    $indexed += count($docs);
                } else {
                    $errors += count($docs);
                }
            }
        });

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

        $this->info('Mappings indexing complete.');

        return self::SUCCESS;
    }
}
