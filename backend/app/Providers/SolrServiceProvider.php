<?php

namespace App\Providers;

use App\Services\Solr\SolrClientWrapper;
use App\Services\Solr\VocabularySearchService;
use Illuminate\Support\ServiceProvider;

class SolrServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(SolrClientWrapper::class);
        $this->app->singleton(VocabularySearchService::class);
    }
}
