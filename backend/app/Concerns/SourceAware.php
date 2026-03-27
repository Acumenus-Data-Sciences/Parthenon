<?php

namespace App\Concerns;

use App\Context\SourceContext;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

/**
 * Provides source-aware database connection accessors.
 *
 * Use this trait in any service that needs to query CDM, Results, or Vocabulary
 * data. It replaces hardcoded DB::connection('omop') / DB::connection('results')
 * calls with context-aware methods that resolve from the request's SourceContext.
 */
trait SourceAware
{
    protected function cdm(): Connection
    {
        return DB::connection(app(SourceContext::class)->cdmConnection());
    }

    protected function results(): Connection
    {
        return DB::connection(app(SourceContext::class)->resultsConnection());
    }

    protected function vocab(): Connection
    {
        return DB::connection(app(SourceContext::class)->vocabConnection());
    }
}
