<?php

namespace App\Console\Commands;

use App\Services\WebApi\WebApiImporterService;
use Illuminate\Console\Command;

class ImportWebApiSourcesCommand extends Command
{
    protected $signature = 'parthenon:import-webapi-sources
        {url : The base URL of the legacy WebAPI instance}
        {--auth-type=none : Authentication type (none, basic, bearer)}
        {--token= : Bearer token or basic auth credentials (user:pass)}';

    protected $description = 'Import data sources from a legacy OHDSI WebAPI instance';

    public function handle(WebApiImporterService $importer): int
    {
        $url = $this->argument('url');
        $authType = $this->option('auth-type');
        $token = $this->option('token');

        $this->info("Importing sources from: {$url}");

        try {
            $result = $importer->importFromUrl($url, $authType, $token);
        } catch (\Throwable $e) {
            $this->error("Import failed: {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->newLine();
        $this->table(
            ['Source Key', 'Source Name', 'Status'],
            array_map(fn (array $s) => [$s['source_key'], $s['source_name'], $s['status']], $result['sources']),
        );

        $this->newLine();
        $this->info("Imported: {$result['imported']}  |  Skipped: {$result['skipped']}");

        return self::SUCCESS;
    }
}
