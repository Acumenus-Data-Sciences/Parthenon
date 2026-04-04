<?php

namespace App\Console\Commands;

use App\Services\Vocabulary\HierarchyBuilderService;
use Illuminate\Console\Command;
use RuntimeException;

class BuildConceptHierarchy extends Command
{
    protected $signature = 'vocabulary:build-hierarchy
        {--domain= : Build for specific domain only (Condition, Drug, Procedure, Measurement, Observation, Visit)}
        {--fresh : Drop and rebuild concept_tree from scratch}
        {--populate-results : Also populate concept_hierarchy in all results schemas}';

    protected $description = 'Build vocab.concept_tree from concept_ancestor and optionally populate results schemas';

    public function handle(HierarchyBuilderService $service): int
    {
        $domain = $this->option('domain');

        if ($domain !== null && ! in_array($domain, HierarchyBuilderService::supportedDomains(), true)) {
            $this->error('Unsupported domain "'.$domain.'". Expected one of: '.implode(', ', HierarchyBuilderService::supportedDomains()));

            return self::FAILURE;
        }

        try {
            $service->ensureConceptTreeTableExists();
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->info('Clearing vocab.concept_tree...');
            $service->clearConceptTree();
        }

        if ($domain) {
            $this->info("Building concept_tree for {$domain}...");
            $count = $service->buildDomain($domain);
            $this->info("  {$domain}: {$count} edges");
        } else {
            $this->info('Building concept_tree for all domains...');
            $stats = $service->buildAll();
            foreach ($stats as $d => $count) {
                $this->info("  {$d}: {$count} edges");
            }
        }

        if ($this->option('populate-results')) {
            $this->info('Populating results schemas...');
            $results = $service->populateResultsSchemas();
            foreach ($results as $schema => $count) {
                $this->info("  {$schema}: {$count} rows");
            }
        }

        $this->info('Done.');

        return self::SUCCESS;
    }
}
