<?php

namespace App\Listeners;

use App\Events\ReleaseCreated;
use App\Services\Ares\DqHistoryService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Cache;

class ComputeDqDeltas implements ShouldQueue
{
    public function __construct(
        private readonly DqHistoryService $dqHistoryService,
    ) {}

    public function handle(ReleaseCreated $event): void
    {
        $this->dqHistoryService->computeDeltas($event->release);

        // Invalidate cached network aggregations
        Cache::forget('ares:network:overview');
        Cache::forget('ares:network:coverage');
        Cache::forget('ares:network:diversity');
        Cache::forget('ares:network:dq-summary');
        Cache::forget('ares:network:cost');
    }
}
