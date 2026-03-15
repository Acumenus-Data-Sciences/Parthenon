<?php

namespace App\Console\Commands;

use App\Services\QueryLibrary\OhdsiQueryLibraryImporter;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;

class ImportOhdsiQueryLibraryCommand extends Command
{
    protected $signature = 'query-library:import-ohdsi
        {path : Path to the OHDSI QueryLibrary repo root or queries directory}
        {--fresh : Remove existing OHDSI query-library rows before importing}
        {--reindex : Reindex the Solr query_library core after import}';

    protected $description = 'Import OHDSI QueryLibrary markdown queries into query_library_entries';

    public function handle(
        OhdsiQueryLibraryImporter $importer,
        SolrClientWrapper $solr,
    ): int {
        $result = $importer->importFromPath(
            (string) $this->argument('path'),
            (bool) $this->option('fresh'),
        );

        $this->info('Imported '.$result['imported'].' OHDSI QueryLibrary entries.');
        if ($result['skipped'] > 0) {
            $this->warn('Skipped '.$result['skipped'].' markdown files without SQL blocks.');
        }

        if ($this->option('reindex')) {
            if (! $solr->isEnabled()) {
                $this->warn('Solr reindex skipped because SOLR_ENABLED is false.');

                return self::SUCCESS;
            }

            $this->call('solr:index-query-library', ['--fresh' => true]);
        }

        return self::SUCCESS;
    }
}
