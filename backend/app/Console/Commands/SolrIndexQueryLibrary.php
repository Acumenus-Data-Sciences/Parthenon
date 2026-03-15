<?php

namespace App\Console\Commands;

use App\Models\App\QueryLibraryEntry;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;

class SolrIndexQueryLibrary extends Command
{
    protected $signature = 'solr:index-query-library {--fresh : Clear the core before indexing}';

    protected $description = 'Index query library entries into the Solr query_library core';

    public function handle(SolrClientWrapper $solr): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = config('solr.cores.query_library', 'query_library');
        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the core created and available?");

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $solr->deleteAll($core);
        }

        $entries = QueryLibraryEntry::query()->get();
        if ($entries->isEmpty()) {
            $this->warn('No query library entries found to index.');

            return self::SUCCESS;
        }

        $documents = $entries->map(function (QueryLibraryEntry $entry) {
            return [
                'id' => $entry->id,
                'slug' => $entry->slug,
                'name' => $entry->name,
                'domain' => $entry->domain,
                'category' => $entry->category,
                'summary' => $entry->summary,
                'description' => $entry->description ?? '',
                'tags' => $entry->tags_json ?? [],
                'example_questions' => $entry->example_questions_json ?? [],
                'source' => $entry->source,
                'is_aggregate' => $entry->is_aggregate,
                'safety' => $entry->safety,
            ];
        })->all();

        $ok = $solr->addDocuments($core, $documents);
        if (! $ok) {
            $this->error('Failed to add query library documents to Solr.');

            return self::FAILURE;
        }

        $solr->commit($core);
        $docCount = $solr->documentCount($core);
        $this->info('Indexed '.count($documents)." query library entries into '{$core}'.");
        $this->info('Solr document count: '.($docCount ?? 0));

        return self::SUCCESS;
    }
}
