<?php

namespace App\Jobs\CareBundles;

use App\Models\App\ConditionBundle;
use App\Models\App\Source;
use App\Models\User;
use App\Services\CareBundles\CareBundleMaterializationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class MaterializeCareBundleJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 7200;

    public int $tries = 1;

    public function __construct(
        public readonly ConditionBundle $bundle,
        public readonly Source $source,
        public readonly ?User $triggeredBy = null,
        public readonly string $trigger = 'manual',
    ) {
        $this->queue = 'cohort';
    }

    public function handle(CareBundleMaterializationService $service): void
    {
        Log::info('MaterializeCareBundleJob started', [
            'bundle' => $this->bundle->bundle_code,
            'source_id' => $this->source->id,
            'trigger' => $this->trigger,
        ]);

        $run = $service->materialize(
            $this->bundle,
            $this->source,
            $this->triggeredBy,
            $this->trigger,
        );

        Log::info('MaterializeCareBundleJob finished', [
            'run_id' => $run->id,
            'status' => $run->status,
            'qualified_person_count' => $run->qualified_person_count,
        ]);
    }
}
