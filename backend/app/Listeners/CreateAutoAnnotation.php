<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\DqdRunCompleted;
use App\Events\ReleaseCreated;
use App\Services\Ares\AutoAnnotationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CreateAutoAnnotation
{
    public function __construct(
        private readonly AutoAnnotationService $autoAnnotationService,
    ) {}

    /**
     * Handle both ReleaseCreated and DqdRunCompleted events.
     * Uses a savepoint so failures don't poison the parent transaction.
     */
    public function handle(ReleaseCreated|DqdRunCompleted $event): void
    {
        try {
            DB::beginTransaction();

            if ($event instanceof ReleaseCreated) {
                $this->handleRelease($event);
            }

            if ($event instanceof DqdRunCompleted) {
                $this->handleDqd($event);
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::warning("CreateAutoAnnotation: failed — {$e->getMessage()}");
        }
    }

    private function handleRelease(ReleaseCreated $event): void
    {
        $release = $event->release;

        $this->autoAnnotationService->createSystemAnnotation(
            sourceId: $release->source_id,
            chartType: 'dq_history',
            xValue: $release->created_at->toDateString(),
            text: "Release created: {$release->release_name}",
            tag: 'data_event',
        );
    }

    private function handleDqd(DqdRunCompleted $event): void
    {
        $release = $event->release;

        if (! $release) {
            return;
        }

        $this->autoAnnotationService->createSystemAnnotation(
            sourceId: $release->source_id,
            chartType: 'dq_history',
            xValue: $release->created_at->toDateString(),
            text: "DQD run completed for release {$release->release_name}",
            tag: 'system',
        );
    }
}
