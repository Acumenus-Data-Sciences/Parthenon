<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Models\App\FinnGen\Run;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Orchestrates the FinnGen run lifecycle (spec §3.2, §5).
 *
 *   create()        — POST /finngen/runs → creates row + dispatches Horizon job
 *   requestCancel() — POST /finngen/runs/{id}/cancel → flips to 'canceling'
 *   pin/unpin       — toggles the 90-day GC exemption
 *
 * Horizon job calls:
 *   markRunning()
 *   markSucceeded()
 *   markFailed()
 *   markCanceled()
 *   updateProgress()
 */
class FinnGenRunService
{
    public function __construct(
        private readonly FinnGenAnalysisModuleRegistry $registry,
    ) {}

    /**
     * @param  array<string, mixed>  $params
     *
     * @throws HttpException (503) when dispatch is paused
     */
    public function create(int $userId, string $sourceKey, string $analysisType, array $params): Run
    {
        // Cache override (set by `php artisan finngen:pause-dispatch`) takes
        // precedence over the env-driven config default. Spec §7.3.
        $paused = (bool) Cache::get('finngen.pause_dispatch', (bool) config('finngen.pause_dispatch'));
        if ($paused) {
            abort(503, 'FinnGen dispatch is paused by admin.');
        }

        // Validates existence of analysis_type + (SP3 future) params shape.
        $this->registry->validateParams($analysisType, $params);

        return DB::transaction(function () use ($userId, $sourceKey, $analysisType, $params) {
            $run = Run::create([
                'user_id' => $userId,
                'source_key' => $sourceKey,
                'analysis_type' => $analysisType,
                'params' => $params,
                'status' => Run::STATUS_QUEUED,
            ]);

            RunFinnGenAnalysisJob::dispatch($run->id)->onQueue('finngen');

            return $run;
        });
    }

    /** Idempotent on terminal state. */
    public function requestCancel(Run $run): Run
    {
        if ($run->isTerminal()) {
            return $run;
        }
        $run->update(['status' => Run::STATUS_CANCELING]);

        return $run->fresh();
    }

    public function pin(Run $run): Run
    {
        $run->update(['pinned' => true]);

        return $run->fresh();
    }

    public function unpin(Run $run): Run
    {
        $run->update(['pinned' => false]);

        return $run->fresh();
    }

    public function markRunning(Run $run): void
    {
        $run->update([
            'status' => Run::STATUS_RUNNING,
            'started_at' => now(),
        ]);
    }

    /**
     * @param  array<string, string>  $artifacts
     * @param  array<string, mixed>|null  $summary
     */
    public function markSucceeded(Run $run, array $artifacts, ?array $summary): void
    {
        $run->update([
            'status' => Run::STATUS_SUCCEEDED,
            'artifacts' => $artifacts,
            'summary' => $summary,
            'finished_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $errorDetail
     */
    public function markFailed(Run $run, string $code, ?string $category, array $errorDetail): void
    {
        $run->update([
            'status' => Run::STATUS_FAILED,
            'error' => array_merge(['code' => $code, 'category' => $category], $errorDetail),
            'finished_at' => now(),
        ]);
    }

    public function markCanceled(Run $run, bool $forced = false): void
    {
        $run->update([
            'status' => Run::STATUS_CANCELED,
            'error' => [
                'code' => 'DARKSTAR_R_CANCELED',
                'category' => 'CANCELED',
                'forced' => $forced,
            ],
            'finished_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $progress
     */
    public function updateProgress(Run $run, array $progress): void
    {
        $run->update(['progress' => $progress]);
    }
}
