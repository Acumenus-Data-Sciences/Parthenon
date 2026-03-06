<?php

namespace App\Observers;

use App\Jobs\Solr\SolrUpdateCohortJob;
use App\Models\App\CohortDefinition;

class CohortDefinitionObserver
{
    public function created(CohortDefinition $cohort): void
    {
        $this->dispatch($cohort);
    }

    public function updated(CohortDefinition $cohort): void
    {
        $this->dispatch($cohort);
    }

    public function deleted(CohortDefinition $cohort): void
    {
        if (config('solr.enabled')) {
            SolrUpdateCohortJob::dispatch('cohort', $cohort->id, true)->delay(5);
        }
    }

    private function dispatch(CohortDefinition $cohort): void
    {
        if (config('solr.enabled')) {
            SolrUpdateCohortJob::dispatch('cohort', $cohort->id, false)->delay(5);
        }
    }
}
