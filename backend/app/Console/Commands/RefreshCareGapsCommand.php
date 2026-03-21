<?php

namespace App\Console\Commands;

use App\Enums\DaimonType;
use App\Jobs\Analysis\CareGapNightlyRefreshJob;
use App\Models\App\ConditionBundle;
use App\Models\App\Source;
use App\Services\Analysis\CareGapRefreshService;
use Illuminate\Console\Command;

class RefreshCareGapsCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'care-gaps:refresh
        {--source= : Source ID or source_key to refresh (default: all sources)}
        {--bundle= : Bundle code to refresh (default: all active bundles)}
        {--queue : Dispatch as a queued job instead of running synchronously}';

    /**
     * @var string
     */
    protected $description = 'Refresh care gap materialized tables (patient enrollment + measure compliance)';

    public function handle(CareGapRefreshService $refreshService): int
    {
        if ($this->option('queue')) {
            CareGapNightlyRefreshJob::dispatch();
            $this->info('CareGapNightlyRefreshJob dispatched to analysis queue.');

            return self::SUCCESS;
        }

        // Resolve sources
        $sourceOpt = $this->option('source');
        if ($sourceOpt !== null) {
            $source = is_numeric($sourceOpt)
                ? Source::findOrFail((int) $sourceOpt)
                : Source::where('source_key', $sourceOpt)->firstOrFail();
            $sources = collect([$source]);
        } else {
            $sources = Source::all();
        }

        // Resolve bundles
        $bundleOpt = $this->option('bundle');
        if ($bundleOpt !== null) {
            $bundles = ConditionBundle::where('bundle_code', $bundleOpt)
                ->where('is_active', true)
                ->with('measures')
                ->get();
            if ($bundles->isEmpty()) {
                $this->error("No active bundle found with code: {$bundleOpt}");

                return self::FAILURE;
            }
        } else {
            $bundles = null; // null = all active bundles (handled by refreshSource)
        }

        foreach ($sources as $source) {
            $this->info("Refreshing source: {$source->source_name} ({$source->source_key})");
            $source->load('daimons');

            $started = microtime(true);

            if ($bundles !== null) {
                // Single-bundle mode
                $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
                if ($cdmSchema === null) {
                    $this->warn('  → No CDM daimon configured — skipping.');

                    continue;
                }
                $totalPatients = 0;
                foreach ($bundles as $bundle) {
                    $this->line("  → Bundle: {$bundle->bundle_code} ({$bundle->condition_name})");
                    $count = $refreshService->refreshBundle($source, $bundle, $cdmSchema);
                    $this->line("     Enrolled: {$count} patients");
                    $totalPatients += $count;
                }
            } else {
                // Full refresh mode
                $result = $refreshService->refreshSource($source);
                $totalPatients = $result['patients_total'];
                $this->line("  → Bundles: {$result['bundles']}, Patients: {$result['patients_total']}, Time: {$result['duration_ms']}ms");
            }

            $elapsed = round((microtime(true) - $started) * 1000);
            $this->info("  Done in {$elapsed}ms");
        }

        $this->info('Care gap refresh complete.');

        return self::SUCCESS;
    }
}
