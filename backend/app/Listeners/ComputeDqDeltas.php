<?php

namespace App\Listeners;

use App\Events\ReleaseCreated;
use App\Services\Ares\DqHistoryService;
use Illuminate\Contracts\Queue\ShouldQueue;

class ComputeDqDeltas implements ShouldQueue
{
    public function __construct(
        private readonly DqHistoryService $dqHistoryService,
    ) {}

    public function handle(ReleaseCreated $event): void
    {
        $this->dqHistoryService->computeDeltas($event->release);
    }
}
