<?php

namespace App\Console\Commands;

use App\Models\Vocabulary\Concept;
use App\Services\Solr\SolrClientWrapper;
use App\Services\Solr\VocabularyIndexAudit;
use Illuminate\Console\Command;

class ValidateSolrVocabularyCompleteness extends Command
{
    protected $signature = 'solr:validate-vocabulary
        {--core= : Solr core to validate (defaults to solr.cores.vocabulary)}
        {--domain= : Only check concepts in this OMOP domain (e.g. Condition, Drug)}
        {--sample=1000 : Deterministic, evenly distributed field-audit sample size}';

    protected $description = 'Validate exact Solr vocabulary count and sampled fields against PostgreSQL vocab.concept';

    public function handle(SolrClientWrapper $solr, VocabularyIndexAudit $audit): int
    {
        $this->info('=== Solr Vocabulary Index Completeness Validation ===');
        $this->newLine();

        $core = (string) ($this->option('core') ?: config('solr.cores.vocabulary', 'vocabulary'));
        if (preg_match('/^[A-Za-z0-9_.-]+$/', $core) !== 1) {
            $this->error('Invalid Solr core name. Use only letters, numbers, dot, underscore, and hyphen.');

            return self::FAILURE;
        }

        $sampleSize = (int) $this->option('sample');
        if ($sampleSize < 1 || $sampleSize > 10000) {
            $this->error('Sample size must be between 1 and 10000.');

            return self::FAILURE;
        }

        if (! $solr->isEnabled()) {
            $this->error('Solr is disabled in configuration (solr.enabled = false).');

            return self::FAILURE;
        }

        if (! $solr->ping($core)) {
            $this->error("Solr core '{$core}' is not reachable.");

            return self::FAILURE;
        }

        $this->info("Solr core '{$core}': reachable");
        $this->newLine();

        $domain = $this->option('domain');
        $domain = is_string($domain) && $domain !== '' ? $domain : null;

        $this->info('--- Exact Count Comparison ---');

        $pgQuery = Concept::query();
        if ($domain !== null) {
            $pgQuery->where('domain_id', $domain);
        }
        $pgCount = $pgQuery->count();

        $solrParams = ['q' => '*:*', 'rows' => 0];
        if ($domain !== null) {
            $escapedDomain = addcslashes($domain, '\\"');
            $solrParams['fq'] = 'domain_id:"'.$escapedDomain.'"';
        }
        $solrResult = $solr->select($core, $solrParams);
        if ($solrResult === null) {
            $this->error('Failed to query Solr for document count.');

            return self::FAILURE;
        }

        $solrCount = (int) ($solrResult['response']['numFound'] ?? 0);
        $domainLabel = $domain !== null ? " (domain: {$domain})" : '';
        $this->line("  PostgreSQL concepts{$domainLabel}: ".number_format($pgCount));
        $this->line("  Solr documents{$domainLabel}:      ".number_format($solrCount));

        $countPassed = $audit->countsMatch($pgCount, $solrCount);
        if ($countPassed) {
            $this->info('  Exact count: PASS');
        } else {
            $delta = $solrCount - $pgCount;
            $this->error('  Exact count: FAIL (delta '.sprintf('%+d', $delta).')');
        }
        $this->newLine();

        $this->info('--- Deterministic Field Audit ---');
        $sample = $this->deterministicSample(
            $domain,
            min($sampleSize, max($pgCount, 1)),
            $pgCount,
            $audit
        );
        if ($sample === []) {
            $this->warn('  No PostgreSQL concepts found to sample.');

            return $countPassed ? self::SUCCESS : self::FAILURE;
        }

        $this->line('  Auditing '.count($sample).' evenly distributed concept documents...');

        $missingIds = [];
        $unexpectedIds = [];
        $staleFields = [];
        foreach (array_chunk($sample, 50) as $batch) {
            $idList = implode(' OR ', array_column($batch, 'concept_id'));
            $checkResult = $solr->select($core, [
                'q' => "concept_id:({$idList})",
                'rows' => count($batch),
                'fl' => implode(',', VocabularyIndexAudit::AUDITED_FIELDS),
            ]);

            if ($checkResult === null) {
                $this->error('  Failed to query Solr during field audit.');

                return self::FAILURE;
            }

            $comparison = $audit->compareBatch($batch, $checkResult['response']['docs'] ?? []);
            $missingIds = [...$missingIds, ...$comparison['missing_ids']];
            $unexpectedIds = [...$unexpectedIds, ...$comparison['unexpected_ids']];
            $staleFields += $comparison['stale_fields'];
        }

        $fieldAuditPassed = $missingIds === [] && $unexpectedIds === [] && $staleFields === [];
        $this->line('  Missing documents: '.count($missingIds));
        $this->line('  Unexpected documents: '.count($unexpectedIds));
        $this->line('  Documents with stale fields: '.count($staleFields));

        if ($fieldAuditPassed) {
            $this->info('  Field audit: PASS');
        } else {
            $this->error('  Field audit: FAIL');
            $this->reportSampleFailures($missingIds, $unexpectedIds, $staleFields);
        }

        $this->newLine();
        $this->info('--- Summary ---');

        if ($countPassed && $fieldAuditPassed) {
            $this->info('RESULT: PASS — Solr vocabulary count and sampled fields match PostgreSQL exactly.');

            return self::SUCCESS;
        }

        $this->error("RESULT: FAIL — rebuild a replacement core with solr:index-vocabulary --core={$core} --fresh, then revalidate before cutover.");

        return self::FAILURE;
    }

    /**
     * Use a deterministic modulo stride while walking the concept primary-key
     * index instead of sorting millions of rows with ORDER BY random().
     *
     * @return array<int, array<string, string>>
     */
    private function deterministicSample(
        ?string $domain,
        int $sampleSize,
        int $postgresCount,
        VocabularyIndexAudit $audit
    ): array {
        $stride = max(1, intdiv(max($postgresCount, 1), $sampleSize));
        $sampleQuery = Concept::query()
            ->select(VocabularyIndexAudit::AUDITED_FIELDS)
            ->whereRaw('mod(concept_id, ?) = 0', [$stride]);

        if ($domain !== null) {
            $sampleQuery->where('domain_id', $domain);
        }

        $rows = $sampleQuery
            ->orderBy('concept_id')
            ->limit($sampleSize)
            ->get()
            ->all();

        return array_map($audit->expectedDocument(...), $rows);
    }

    /**
     * @param  list<int>  $missingIds
     * @param  list<int>  $unexpectedIds
     * @param  array<int, list<string>>  $staleFields
     */
    private function reportSampleFailures(array $missingIds, array $unexpectedIds, array $staleFields): void
    {
        if ($missingIds !== []) {
            $this->line('  Missing IDs (first 20): '.implode(', ', array_slice($missingIds, 0, 20)));
        }
        if ($unexpectedIds !== []) {
            $this->line('  Unexpected IDs (first 20): '.implode(', ', array_slice($unexpectedIds, 0, 20)));
        }
        foreach (array_slice($staleFields, 0, 20, true) as $conceptId => $fields) {
            $this->line("  Stale concept {$conceptId}: ".implode(', ', $fields));
        }
    }
}
