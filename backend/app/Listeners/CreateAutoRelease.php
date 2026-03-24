<?php

namespace App\Listeners;

use App\Events\AchillesRunCompleted;
use App\Services\Ares\ReleaseService;

class CreateAutoRelease
{
    public function __construct(
        private readonly ReleaseService $releaseService,
    ) {}

    public function handle(AchillesRunCompleted $event): void
    {
        if ($event->source->release_mode !== 'auto') {
            return;
        }

        $this->releaseService->autoSnapshot($event->source, $event->runId);
    }
}
