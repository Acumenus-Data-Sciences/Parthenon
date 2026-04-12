<?php

namespace App\Console\Commands;

use App\Models\Vocabulary\Concept;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;

class ValidateSolrVocabularyCompleteness extends Command
{
    protected $signature = 'solr:validate-vocabulary
        {--domain= : Only check concepts in this OMOP domain (e.g. Condition, Drug)}
        {--sample=1000 : Sample size for spot-check verification}';

    protected $description = 'Validate Solr vocabulary index completeness against PostgreSQL vocab.concept table';

    private const CORE = 'vocabulary';

    private const COVERAGE_THRESHOLD = 95.0;

    private const MISSING_RATE_THRESHOLD = 5.0;

    public function handle(SolrClientWrapper $solr): int
    {
        $this->info('=== Solr Vocabulary Index Completeness Validation ===');
        $this->newLine();

        // Check Solr reachability
        if (! $solr->isEnabled()) {
            $this->error('Solr is disabled in configuration (solr.enabled = false).');

            return self::FAILURE;
        }

        if (! $solr->ping(self::CORE)) {
            $this->error('Solr vocabulary core is not reachable. Is the Solr service running?');

            return self::FAILURE;
        }

        $this->info('Solr vocabulary core: reachable');
        $this->newLine();

        $domain = $this->option('domain');
        $sampleSize = (int) $this->option('sample');

        // Step 1: Count comparison
        $this->info('--- Count Comparison ---');

        $pgQuery = Concept::whereNotNull('standard_concept');
        if ($domain) {
            $pgQuery->where('domain_id', $domain);
        }
        $pgCount = $pgQuery->count();

        $solrParams = ['q' => '*:*', 'rows' => 0];
        if ($domain) {
            $solrParams['fq'] = "domain_id:{$domain}";
        }
        $solrResult = $solr->select(self::CORE, $solrParams);

        if ($solrResult === null) {
            $this->error('Failed to query Solr for document count.');

            return self::FAILURE;
        }

        $solrCount = (int) ($solrResult['response']['numFound'] ?? 0);
        $coverage = $pgCount > 0 ? ($solrCount / $pgCount) * 100.0 : 0.0;

        $domainLabel = $domain ? " (domain: {$domain})" : '';
        $this->line("  PostgreSQL standard concepts{$domainLabel}: ".number_format($pgCount));
        $this->line("  Solr documents{$domainLabel}:                  ".number_format($solrCount));
        $this->line(sprintf('  Coverage: %.2f%%', $coverage));

        $coveragePassed = $coverage >= self::COVERAGE_THRESHOLD;
        if ($coveragePassed) {
            $this->info('  Coverage: PASS');
        } else {
            $this->error(sprintf('  Coverage: FAIL (< %.0f%%)', self::COVERAGE_THRESHOLD));
        }
        $this->newLine();

        // Step 2: Spot check
        $this->info('--- Spot Check ---');

        $sampleQuery = Concept::whereNotNull('standard_concept');
        if ($domain) {
            $sampleQuery->where('domain_id', $domain);
        }
        $sampleIds = $sampleQuery
            ->inRandomOrder()
            ->limit($sampleSize)
            ->pluck('concept_id')
            ->all();

        $actualSampleSize = count($sampleIds);
        if ($actualSampleSize === 0) {
            $this->warn('  No concepts found to sample.');

            return $coveragePassed ? self::SUCCESS : self::FAILURE;
        }

        $this->line("  Sampling {$actualSampleSize} random concept IDs from PostgreSQL...");

        $missingIds = [];
        // Query Solr in batches to avoid URL length limits
        $batchSize = 50;
        $batches = array_chunk($sampleIds, $batchSize);

        foreach ($batches as $batch) {
            $idList = implode(' OR ', $batch);
            $checkResult = $solr->select(self::CORE, [
                'q' => "concept_id:({$idList})",
                'rows' => $batchSize,
                'fl' => 'concept_id',
            ]);

            if ($checkResult === null) {
                $this->error('  Failed to query Solr during spot check.');

                return self::FAILURE;
            }

            $foundIds = array_map(
                fn (array $doc): int => (int) $doc['concept_id'],
                $checkResult['response']['docs'] ?? []
            );

            foreach ($batch as $id) {
                if (! in_array($id, $foundIds, true)) {
                    $missingIds[] = $id;
                }
            }
        }

        $missingCount = count($missingIds);
        $missingRate = ($missingCount / $actualSampleSize) * 100.0;

        $this->line("  Checked: {$actualSampleSize}");
        $this->line("  Missing from Solr: {$missingCount}");
        $this->line(sprintf('  Missing rate: %.2f%%', $missingRate));

        $spotCheckPassed = $missingRate <= self::MISSING_RATE_THRESHOLD;
        if ($spotCheckPassed) {
            $this->info('  Spot check: PASS');
        } else {
            $this->error(sprintf('  Spot check: FAIL (> %.0f%% missing)', self::MISSING_RATE_THRESHOLD));
        }

        if ($missingCount > 0 && $missingCount <= 20) {
            $this->newLine();
            $this->line('  Missing concept IDs: '.implode(', ', $missingIds));
        } elseif ($missingCount > 20) {
            $this->newLine();
            $this->line('  First 20 missing concept IDs: '.implode(', ', array_slice($missingIds, 0, 20)));
        }

        // Summary
        $this->newLine();
        $this->info('--- Summary ---');

        $passed = $coveragePassed && $spotCheckPassed;
        if ($passed) {
            $this->info('RESULT: PASS — Solr vocabulary index is complete.');

            return self::SUCCESS;
        }

        $this->error('RESULT: FAIL — Solr vocabulary index has gaps. Run solr:index-vocabulary to reindex.');

        return self::FAILURE;
    }
}
