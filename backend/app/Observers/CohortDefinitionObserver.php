<?php

namespace App\Observers;

use App\Jobs\Solr\SolrUpdateCohortJob;
use App\Models\App\CohortDefinition;
use App\Services\Cohort\CohortDomainDetector;

class CohortDefinitionObserver
{
    public function __construct(
        private readonly CohortDomainDetector $detector,
    ) {}

    public function created(CohortDefinition $cohort): void
    {
        $cohort->recomputeQualityTier();
        $this->autoDetectDomain($cohort);
        $this->dispatchSolr($cohort);
    }

    public function updated(CohortDefinition $cohort): void
    {
        if ($cohort->wasChanged(['expression_json', 'name', 'description', 'is_public', 'tags', 'domain'])) {
            $cohort->recomputeQualityTier();
        }

        // Re-detect domain if expression changed and domain wasn't explicitly set
        if ($cohort->wasChanged('expression_json') && ! $cohort->wasChanged('domain')) {
            $this->autoDetectDomain($cohort);
        }

        $this->dispatchSolr($cohort);
    }

    public function deleted(CohortDefinition $cohort): void
    {
        if (config('solr.enabled')) {
            SolrUpdateCohortJob::dispatch('cohort', $cohort->id, true)->delay(5);
        }
    }

    /**
     * Auto-detect domain from expression concepts when domain is null.
     */
    private function autoDetectDomain(CohortDefinition $cohort): void
    {
        if ($cohort->domain !== null) {
            return;
        }

        $expression = $cohort->expression_json;
        if (empty($expression)) {
            return;
        }

        try {
            $detected = $this->detector->detect($expression);
            $cohort->updateQuietly(['domain' => $detected->value]);
        } catch (\Throwable) {
            // Non-critical — don't break the save if detection fails
        }
    }

    private function dispatchSolr(CohortDefinition $cohort): void
    {
        if (config('solr.enabled')) {
            SolrUpdateCohortJob::dispatch('cohort', $cohort->id, false)->delay(5);
        }
    }
}
