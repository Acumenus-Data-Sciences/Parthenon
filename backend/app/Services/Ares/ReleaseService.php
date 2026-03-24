<?php

namespace App\Services\Ares;

use App\Events\ReleaseCreated;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use Illuminate\Support\Facades\Log;

class ReleaseService
{
    /**
     * Create an automatic snapshot release after an Achilles run completes.
     */
    public function autoSnapshot(Source $source, string $runId): SourceRelease
    {
        $releaseKey = 'auto-' . now()->format('Ymd-His');

        $release = SourceRelease::create([
            'source_id' => $source->id,
            'release_key' => $releaseKey,
            'release_name' => 'Auto snapshot ' . now()->format('Y-m-d H:i'),
            'release_type' => 'snapshot',
        ]);

        Log::info('ReleaseService: Auto snapshot created', [
            'release_id' => $release->id,
            'source_id' => $source->id,
            'run_id' => $runId,
        ]);

        ReleaseCreated::dispatch($release);

        return $release;
    }
}
