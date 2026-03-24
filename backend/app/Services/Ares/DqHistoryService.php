<?php

namespace App\Services\Ares;

use App\Models\App\SourceRelease;
use Illuminate\Support\Facades\Log;

class DqHistoryService
{
    /**
     * Compute DQ deltas between the given release and its predecessor.
     *
     * Phase 1 stub — full implementation in Phase 2.
     */
    public function computeDeltas(SourceRelease $release): void
    {
        Log::info('DqHistoryService::computeDeltas stub called', [
            'release_id' => $release->id,
            'source_id' => $release->source_id,
        ]);
    }
}
