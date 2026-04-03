<?php

namespace App\Console\Commands;

use App\Services\Vocabulary\HierarchyBuilderService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

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

        if ($this->option('fresh')) {
            $this->info('Clearing vocab.concept_tree...');
            DB::connection('omop')->table('concept_tree')->delete();
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
