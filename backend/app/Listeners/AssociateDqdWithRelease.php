<?php

namespace App\Listeners;

use App\Events\DqdRunCompleted;
use App\Models\App\DqdResult;
use App\Models\App\SourceRelease;

class AssociateDqdWithRelease
{
    public function handle(DqdRunCompleted $event): void
    {
        $latestRelease = SourceRelease::where('source_id', $event->sourceId)
            ->latest()
            ->first();

        if (! $latestRelease) {
            return;
        }

        DqdResult::where('source_id', $event->sourceId)
            ->where('run_id', $event->runId)
            ->whereNull('release_id')
            ->update(['release_id' => $latestRelease->id]);
    }
}
