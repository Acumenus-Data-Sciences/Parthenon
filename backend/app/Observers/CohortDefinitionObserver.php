<?php

namespace App\Observers;

use App\Jobs\Solr\SolrUpdateCohortJob;
use App\Models\App\CohortDefinition;

class CohortDefinitionObserver
{
    public function created(CohortDefinition $cohort): void
    {
        $cohort->recomputeQualityTier();
        $this->dispatchSolr($cohort);
    }

    public function updated(CohortDefinition $cohort): void
    {
        if ($cohort->wasChanged(['expression_json', 'name', 'description', 'is_public', 'tags', 'domain'])) {
            $cohort->recomputeQualityTier();
        }
        $this->dispatchSolr($cohort);
    }

    public function deleted(CohortDefinition $cohort): void
    {
        if (config('solr.enabled')) {
            SolrUpdateCohortJob::dispatch('cohort', $cohort->id, true)->delay(5);
        }
    }

    private function dispatchSolr(CohortDefinition $cohort): void
    {
        if (config('solr.enabled')) {
            SolrUpdateCohortJob::dispatch('cohort', $cohort->id, false)->delay(5);
        }
    }
}
