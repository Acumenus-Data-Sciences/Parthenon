<?php

namespace App\Console\Commands;

use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class SolrIndexGisSpatial extends Command
{
    protected $signature = 'solr:index-gis-spatial
        {--concept-id= : Only reindex a single condition (concept ID)}
        {--fresh : Delete all documents before indexing}';

    protected $description = 'Trigger full GIS spatial reindex via the AI service (PG compute + Solr push)';

    public function handle(SolrClientWrapper $solr): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = config('solr.cores.gis_spatial', 'gis_spatial');

        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the Solr container running?");

            return self::FAILURE;
        }

        $aiServiceUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');

        if ((bool) $this->option('fresh')) {
            $this->info('Deleting all existing documents from gis_spatial core...');
            $solr->deleteAll($core);
        }

        $conceptId = $this->option('concept-id');

        if ($conceptId) {
            $this->info("Refreshing stats for concept {$conceptId}...");
            $response = Http::timeout(120)->post(
                "{$aiServiceUrl}/cdm-spatial/refresh?concept_id=".(int) $conceptId
            );

            if ($response->failed()) {
                $this->error('Refresh failed: '.$response->body());

                return self::FAILURE;
            }

            $data = $response->json();
            $this->info("Done: {$data['metrics_computed']} metrics computed");
        } else {
            $this->info('Starting full reindex across all conditions (runs in background)...');
            $response = Http::timeout(10)->post("{$aiServiceUrl}/cdm-spatial/reindex-all");

            if ($response->failed()) {
                $this->error('Reindex request failed: '.$response->body());

                return self::FAILURE;
            }

            $this->info('Reindex started. Monitor AI service logs for progress.');
        }

        return self::SUCCESS;
    }
}
