<?php

namespace App\Jobs\CareBundles;

use App\Models\App\ConditionBundle;
use App\Models\App\Source;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Fan-out job: dispatches one MaterializeCareBundleJob per (active bundle × active source).
 *
 * Called by:
 *   - nightly scheduled task (trigger='scheduled')
 *   - "Refresh all" button in the workbench (trigger='manual')
 */
class MaterializeAllCareBundlesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 120;

    public int $tries = 1;

    public function __construct(
        public readonly ?User $triggeredBy = null,
        public readonly string $trigger = 'scheduled',
    ) {
        $this->queue = 'default';
    }

    public function handle(): void
    {
        $bundles = ConditionBundle::where('is_active', true)->get();
        $sources = Source::query()->get();

        $dispatched = 0;

        foreach ($bundles as $bundle) {
            foreach ($sources as $source) {
                MaterializeCareBundleJob::dispatch(
                    $bundle,
                    $source,
                    $this->triggeredBy,
                    $this->trigger,
                );
                $dispatched++;
            }
        }

        Log::info('MaterializeAllCareBundlesJob dispatched fan-out', [
            'bundles' => $bundles->count(),
            'sources' => $sources->count(),
            'dispatched_jobs' => $dispatched,
            'trigger' => $this->trigger,
        ]);
    }
}
