<?php

namespace App\Console\Commands;

use App\Jobs\Dqd\RunDqdJob;
use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Services\Dqd\DqdCheckRegistry;
use App\Services\Dqd\DqdEngineService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class RunDqdCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'parthenon:run-dqd
        {source : Source ID}
        {--category= : Run only one category (completeness/conformance/plausibility)}
        {--table= : Run only checks for a specific CDM table}
        {--sync : Run synchronously instead of dispatching to queue}
        {--fresh : Delete previous results for this source before running}';

    /**
     * @var string
     */
    protected $description = 'Run Data Quality Dashboard checks on a CDM source';

    public function handle(DqdEngineService $engine, DqdCheckRegistry $registry): int
    {
        $sourceId = $this->argument('source');
        $source = Source::find($sourceId);

        if (! $source) {
            $this->error("Source with ID {$sourceId} not found.");

            return self::FAILURE;
        }

        $category = $this->option('category');
        $table = $this->option('table');
        $sync = $this->option('sync');
        $fresh = $this->option('fresh');

        // Validate category
        if ($category && ! in_array($category, ['completeness', 'conformance', 'plausibility'])) {
            $this->error("Invalid category '{$category}'. Must be one of: completeness, conformance, plausibility.");

            return self::FAILURE;
        }

        // Show check info
        $totalChecks = $registry->count();
        $this->info("DQD Check Registry: {$totalChecks} checks registered.");
        $this->table(
            ['Category', 'Checks'],
            collect($registry->categories())->map(fn ($cat) => [$cat, count($registry->byCategory($cat))])->toArray(),
        );

        // Determine which checks will run
        if ($category) {
            $checksToRun = count($registry->byCategory($category));
            $this->info("Running {$checksToRun} checks for category: {$category}");
        } elseif ($table) {
            $checksToRun = count($registry->byTable($table));
            if ($checksToRun === 0) {
                $this->warn("No checks found for table '{$table}'. Available tables: ".implode(', ', $registry->tables()));

                return self::FAILURE;
            }
            $this->info("Running {$checksToRun} checks for table: {$table}");
        } else {
            $checksToRun = $totalChecks;
            $this->info("Running all {$checksToRun} checks.");
        }

        $runId = (string) Str::uuid();
        $this->info("Run ID: {$runId}");

        // Optionally clear previous results
        if ($fresh) {
            $deleted = DqdResult::where('source_id', $source->id)->delete();
            $this->info("Deleted {$deleted} previous DQD results for source {$source->id}.");
        }

        if ($sync) {
            $this->info('Running synchronously...');
            $this->newLine();

            $startTime = microtime(true);

            if ($category) {
                $result = $engine->runCategory($source, $category, $runId);
            } elseif ($table) {
                $result = $engine->runForTable($source, $table, $runId);
            } else {
                $result = $engine->runAll($source, $runId);
            }

            $elapsed = round(microtime(true) - $startTime, 2);

            $this->newLine();
            $this->info("Completed in {$elapsed}s");
            $this->info("Checks completed: {$result['completed']}");
            $this->info("Checks failed (error): {$result['failed']}");

            // Show summary
            $summary = $engine->getSummary($runId);
            $this->newLine();
            $this->info('=== Summary ===');
            $this->info("Total: {$summary['total_checks']} | Passed: {$summary['passed']} | Failed: {$summary['failed']}");
            $this->info("Warnings: {$summary['warnings']} | Errors: {$summary['errors']}");

            if (! empty($summary['by_category'])) {
                $this->newLine();
                $this->table(
                    ['Category', 'Total', 'Passed', 'Failed', 'Pass Rate'],
                    collect($summary['by_category'])->map(fn ($cat) => [
                        $cat['category'],
                        $cat['total'],
                        $cat['passed'],
                        $cat['failed'],
                        $cat['pass_rate'].'%',
                    ])->toArray(),
                );
            }

            // Show failing checks
            $failingChecks = DqdResult::where('run_id', $runId)
                ->where('passed', false)
                ->orderBy('severity')
                ->limit(20)
                ->get();

            if ($failingChecks->isNotEmpty()) {
                $this->newLine();
                $this->warn('=== Failing Checks (top 20) ===');
                $this->table(
                    ['Check ID', 'Table', 'Severity', 'Violation %', 'Description'],
                    $failingChecks->map(fn ($r) => [
                        Str::limit($r->check_id, 45),
                        $r->cdm_table,
                        $r->severity,
                        $r->violation_percentage !== null ? round($r->violation_percentage, 2).'%' : 'ERROR',
                        Str::limit($r->description, 50),
                    ])->toArray(),
                );
            }
        } else {
            RunDqdJob::dispatch($source, $category, $table, $runId);
            $this->info('DQD job dispatched to the achilles queue.');
            $this->info('Monitor progress: php artisan queue:work --queue=achilles');
        }

        return self::SUCCESS;
    }
}
