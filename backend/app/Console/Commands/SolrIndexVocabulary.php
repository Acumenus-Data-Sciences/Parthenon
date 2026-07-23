<?php

namespace App\Console\Commands;

use App\Models\Vocabulary\Concept;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;

class SolrIndexVocabulary extends Command
{
    protected $signature = 'solr:index-vocabulary
        {--core= : Target Solr core (defaults to solr.cores.vocabulary)}
        {--domain= : Only index concepts in this domain}
        {--vocabulary= : Only index concepts in this vocabulary}
        {--fresh : Delete all documents before indexing}
        {--batch-size=1000 : Documents per batch sent to Solr}';

    protected $description = 'Index OMOP vocabulary concepts into the Solr vocabulary core';

    public function handle(SolrClientWrapper $solr): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = (string) ($this->option('core') ?: config('solr.cores.vocabulary', 'vocabulary'));
        if (preg_match('/^[A-Za-z0-9_.-]+$/', $core) !== 1) {
            $this->error('Invalid Solr core name. Use only letters, numbers, dot, underscore, and hyphen.');

            return self::FAILURE;
        }

        // Check connectivity
        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the Solr container running?");

            return self::FAILURE;
        }

        $batchSize = (int) $this->option('batch-size');
        if ($batchSize < 1 || $batchSize > 5000) {
            $this->error('Batch size must be between 1 and 5000.');

            return self::FAILURE;
        }
        $fresh = (bool) $this->option('fresh');

        if ($fresh) {
            $this->info('Deleting all existing documents...');
            if (! $solr->deleteAll($core)) {
                $this->error("Failed to clear Solr core '{$core}'.");

                return self::FAILURE;
            }
        }

        // Build query
        $query = Concept::query()->with('synonyms');

        if ($domain = $this->option('domain')) {
            $query->inDomain($domain);
            $this->info("Filtering to domain: {$domain}");
        }

        if ($vocabulary = $this->option('vocabulary')) {
            $query->inVocabulary($vocabulary);
            $this->info("Filtering to vocabulary: {$vocabulary}");
        }

        $total = (clone $query)->count();
        $this->info("Indexing {$total} concepts into Solr core '{$core}'...");

        $bar = $this->output->createProgressBar($total);
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %elapsed:6s%/%estimated:-6s% %memory:6s%');
        $bar->start();

        $indexed = 0;
        $errors = 0;
        $startTime = microtime(true);

        $query->select([
            'concept_id',
            'concept_name',
            'concept_code',
            'domain_id',
            'vocabulary_id',
            'concept_class_id',
            'standard_concept',
            'invalid_reason',
            'valid_start_date',
            'valid_end_date',
        ])->chunkById(5000, function ($concepts) use ($solr, $core, $batchSize, &$indexed, &$errors, $bar) {
            $batch = [];

            foreach ($concepts as $concept) {
                $synonyms = $concept->synonyms->pluck('concept_synonym_name')->toArray();

                $doc = [
                    'concept_id' => (string) $concept->concept_id,
                    'concept_name' => $concept->concept_name,
                    'concept_name_sort' => mb_strtolower($concept->concept_name),
                    'concept_code' => $concept->concept_code,
                    'concept_synonyms' => $synonyms,
                    'domain_id' => $concept->domain_id,
                    'vocabulary_id' => $concept->vocabulary_id,
                    'concept_class_id' => $concept->concept_class_id,
                    'standard_concept' => $concept->standard_concept ?? '',
                    'invalid_reason' => $concept->invalid_reason ?? '',
                ];

                if ($concept->valid_start_date) {
                    $doc['valid_start_date'] = $concept->valid_start_date->format('Y-m-d\TH:i:s\Z');
                }
                if ($concept->valid_end_date) {
                    $doc['valid_end_date'] = $concept->valid_end_date->format('Y-m-d\TH:i:s\Z');
                }

                $batch[] = $doc;

                if (count($batch) >= $batchSize) {
                    if ($solr->addDocuments($core, $batch)) {
                        $indexed += count($batch);
                    } else {
                        $errors += count($batch);
                    }
                    $bar->advance(count($batch));
                    $batch = [];
                }
            }

            // Flush remaining
            if (! empty($batch)) {
                if ($solr->addDocuments($core, $batch)) {
                    $indexed += count($batch);
                } else {
                    $errors += count($batch);
                }
                $bar->advance(count($batch));
            }
        }, 'concept_id');

        $bar->finish();
        $this->newLine(2);

        // Commit
        $this->info('Committing...');
        if (! $solr->commit($core)) {
            $this->error("Failed to commit Solr core '{$core}'.");

            return self::FAILURE;
        }

        $elapsed = round(microtime(true) - $startTime, 1);
        $rate = $indexed > 0 ? round($indexed / $elapsed) : 0;

        $this->info("Indexed: {$indexed} | Errors: {$errors} | Time: {$elapsed}s | Rate: {$rate} docs/s");

        // Verify
        $docCount = $solr->documentCount($core);
        $this->info("Solr document count: {$docCount}");

        if ($errors > 0) {
            $this->warn("Completed with {$errors} errors.");

            return self::FAILURE;
        }

        if ($fresh && ! $this->option('domain') && ! $this->option('vocabulary') && $docCount !== $total) {
            $this->error("Document count mismatch after fresh build: expected {$total}, found ".($docCount ?? 'unknown').'.');

            return self::FAILURE;
        }

        $this->info('Vocabulary indexing complete.');

        return self::SUCCESS;
    }
}
