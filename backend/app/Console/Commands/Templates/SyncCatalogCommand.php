<?php

declare(strict_types=1);

namespace App\Console\Commands\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SyncCatalogCommand extends Command
{
    protected $signature = 'templates:sync';

    protected $description = 'Pull the manifest catalog from parthenon-templates and cache it for the UI.';

    public function handle(TemplateRegistryClient $registry): int
    {
        try {
            $catalog = $registry->listTemplates();
        } catch (TemplateRegistryException $e) {
            $this->error('templates sync failed: '.$e->getMessage());
            Log::warning('templates:sync registry error', ['error' => $e->getMessage(), 'status' => $e->getStatusCode()]);

            return self::FAILURE;
        }

        Cache::put('templates:catalog', $catalog, now()->addMinutes(60));

        $this->info(sprintf('templates synced: %d', count($catalog)));
        Log::info('templates:sync ok', ['count' => count($catalog)]);

        return self::SUCCESS;
    }
}
