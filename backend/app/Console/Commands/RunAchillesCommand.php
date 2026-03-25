<?php

namespace App\Console\Commands;

use App\Jobs\Achilles\RunAchillesJob;
use App\Models\App\Source;
use App\Services\Achilles\AchillesAnalysisRegistry;
use App\Services\Achilles\AchillesEngineService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class RunAchillesCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'parthenon:run-achilles
        {source : Source ID}
        {--categories= : Comma-separated categories (Person,Visit,Condition,...)}
        {--analyses= : Comma-separated analysis IDs}
        {--fresh : Clear existing results before running}
        {--sync : Run synchronously instead of dispatching to queue}';

    /**
     * @var string
     */
    protected $description = 'Run Achilles characterization analyses on a CDM source';

    public function handle(AchillesEngineService $engine, AchillesAnalysisRegistry $registry): int
    {
        $source = Source::findOrFail($this->argument('source'));

        $categories = $this->option('categories')
            ? array_map('trim', explode(',', (string) $this->option('categories')))
            : null;

        $analysisIds = $this->option('analyses')
            ? array_map('intval', explode(',', (string) $this->option('analyses')))
            : null;

        // Show what will run
        if ($analysisIds) {
            $this->info('Running '.count($analysisIds).' specific analyses...');
        } elseif ($categories) {
            $count = collect($categories)->sum(fn (string $c) => count($registry->byCategory($c)));
            $this->info("Running {$count} analyses in categories: ".implode(', ', $categories));
        } else {
            $this->info("Running all {$registry->count()} analyses...");
        }

        // List available categories for reference
        $this->info('Available categories: '.implode(', ', $registry->categories()));

        if ($this->option('sync')) {
            return $this->runSync($engine, $source, $categories, $analysisIds);
        }

        // Dispatch to queue
        $runId = (string) Str::uuid();
        RunAchillesJob::dispatch($source, $categories, $analysisIds, (bool) $this->option('fresh'), $runId);
        $this->info("Achilles job dispatched to queue (run_id: {$runId}).");

        return self::SUCCESS;
    }

    /**
     * @param  list<string>|null  $categories
     * @param  list<int>|null  $analysisIds
     */
    private function runSync(
        AchillesEngineService $engine,
        Source $source,
        ?array $categories,
        ?array $analysisIds,
    ): int {
        if ($this->option('fresh')) {
            $this->info('Clearing existing results...');
            $engine->clearResults($analysisIds);
        }

        $result = $analysisIds
            ? $engine->runAnalyses($source, $analysisIds)
            : $engine->runAll($source, $categories);

        $this->newLine();
        $this->info("Completed: {$result['completed']}, Failed: {$result['failed']}");

        // Show individual results
        foreach ($result['results'] as $r) {
            if ($r['status'] === 'completed') {
                $this->line("  Analysis {$r['analysis_id']}: completed in {$r['elapsed_seconds']}s");
            } else {
                $this->error("  Analysis {$r['analysis_id']}: FAILED - {$r['error']}");
            }
        }

        return $result['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
