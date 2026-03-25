<?php

namespace App\Listeners;

use App\Events\ReleaseCreated;
use App\Services\Ares\DqHistoryService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;

class ComputeDqDeltas implements ShouldQueue
{
    public function __construct(
        private readonly DqHistoryService $dqHistoryService,
    ) {}

    /**
     * Flush cache keys matching a wildcard pattern via Redis SCAN.
     */
    private function flushKeysByPattern(string $pattern): void
    {
        $prefix = config('database.redis.options.prefix', '');
        $cursor = null;

        do {
            $scanCursor = $cursor ?? 0;
            $result = Redis::scan($scanCursor, ['match' => $prefix.$pattern, 'count' => 100]);
            if ($result === false) {
                break;
            }
            [$cursor, $keys] = $result;

            if (! empty($keys)) {
                Redis::del(...array_map(fn ($k) => str_replace($prefix, '', $k), $keys));
            }
        } while ($cursor != 0);
    }

    public function handle(ReleaseCreated $event): void
    {
        $this->dqHistoryService->computeDeltas($event->release);

        // Invalidate all cached network aggregations
        Cache::forget('ares:network:overview');
        Cache::forget('ares:network:coverage');
        Cache::forget('ares:network:coverage:extended');
        Cache::forget('ares:network:diversity');
        Cache::forget('ares:network:geographic-diversity');
        Cache::forget('ares:network:dq-summary');
        Cache::forget('ares:network:cost');
        Cache::forget('ares:network:cost-compare');

        // Flush dynamic cost-compare-detailed keys (domain-specific)
        $this->flushKeysByPattern('ares:network:cost-compare-detailed:*');
    }
}
