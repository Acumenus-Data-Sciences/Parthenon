<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\FinnGenRunService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Reconcile runs whose Horizon worker crashed or whose Darkstar state drifted.
 * Spec §5.7.
 *
 *   - boot mode: updated_at > now - 1h  (fresh orphans at worker pool startup)
 *   - periodic mode: updated_at < now - 2m (stale — poller should have moved them)
 *
 * Re-dispatches Job with resumeMode=true on still-running Darkstar jobs.
 * Caps reconciled_count at 3 to prevent dispatch loops on Darkstar misreport.
 */
class ReconcileOrphansCommand extends Command
{
    protected $signature = 'finngen:reconcile-orphans {--mode=periodic : periodic|boot} {--dry-run}';

    protected $description = 'Reconcile FinnGen runs whose polling loop died or drifted';

    private const MAX_RECONCILE_COUNT = 3;

    private const LOCK_NAME = 'finngen:reconcile-orphans';

    public function handle(FinnGenClient $client, FinnGenRunService $runs): int
    {
        $mode = (string) $this->option('mode');
        $dryRun = (bool) $this->option('dry-run');

        $lock = Cache::lock(self::LOCK_NAME, 60);
        if (! $lock->get()) {
            $this->warn('Another reconcile is running — skipping.');

            return self::SUCCESS;
        }

        try {
            $base = Run::query()->active();
            if ($mode === 'boot') {
                $base->where('updated_at', '>', now()->subHour());
            } else {
                $base->where('updated_at', '<', now()->subMinutes(2));
            }

            $total = $base->count();
            $this->info("Reconciling {$total} orphan(s) [mode={$mode}".($dryRun ? ', dry-run' : '').']');

            $reconciled = 0;
            $base->chunkById(100, function ($chunk) use ($client, $runs, $dryRun, &$reconciled) {
                foreach ($chunk as $run) {
                    if ($this->reconcileOne($client, $runs, $run, $dryRun)) {
                        $reconciled++;
                    }
                }
            });

            $this->info("Reconciled {$reconciled} run(s)");
            Log::info('finngen.orphan.reconciled', [
                'mode' => $mode,
                'count' => $reconciled,
                'total_stale' => $total,
                'dry_run' => $dryRun,
            ]);
        } finally {
            optional($lock)->release();
        }

        return self::SUCCESS;
    }

    private function reconcileOne(FinnGenClient $client, FinnGenRunService $runs, Run $run, bool $dryRun): bool
    {
        if ($run->reconciled_count >= self::MAX_RECONCILE_COUNT) {
            if (! $dryRun) {
                $runs->markFailed($run, 'FINNGEN_RECONCILE_LIMIT_EXCEEDED', null, [
                    'reconciled_count' => $run->reconciled_count,
                    'message' => 'Reconciler retry limit exceeded',
                ]);
            }

            return true;
        }

        if (! $run->darkstar_job_id) {
            if (! $dryRun) {
                $runs->markFailed($run, 'FINNGEN_WORKER_INTERRUPTED', null, [
                    'message' => 'Orphaned before Darkstar dispatch',
                ]);
            }

            return true;
        }

        try {
            $state = $client->pollJob($run->darkstar_job_id);
        } catch (Throwable $e) {
            if (! $dryRun) {
                $run->increment('reconciled_count');
                Log::warning('finngen.orphan.poll_failed', ['run_id' => $run->id, 'error' => $e->getMessage()]);
            }

            return false;
        }

        $status = (string) ($state['status'] ?? '');

        if ($dryRun) {
            $this->line("  would reconcile {$run->id}: Darkstar status={$status}");

            return true;
        }

        return match ($status) {
            'completed' => $this->handleCompleted($runs, $run, $state),
            'failed' => $this->markTransportlessFail($runs, $run, 'MIRAI_TASK_CRASHED', $state),
            'cancelled', 'canceled' => tap(true, function () use ($runs, $run) {
                $runs->markCanceled($run);
            }),
            'not_found' => $this->markTransportlessFail($runs, $run, 'MIRAI_TASK_CRASHED', ['reason' => 'Darkstar lost the job']),
            default => $this->redispatchPoll($run),
        };
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function handleCompleted(FinnGenRunService $runs, Run $run, array $state): bool
    {
        $result = is_array($state['result'] ?? null) ? $state['result'] : [];
        $ok = (bool) ($result['ok'] ?? false);

        if ($ok) {
            $summary = is_array($result['result'] ?? null) ? $result['result'] : null;
            $runs->markSucceeded($run, $run->artifacts ?? [], $summary);
        } else {
            $rError = is_array($result['error'] ?? null) ? $result['error'] : [];
            $category = (string) ($rError['category'] ?? 'ANALYSIS_EXCEPTION');
            $runs->markFailed($run, "DARKSTAR_R_{$category}", $category, $rError);
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $detail
     */
    private function markTransportlessFail(FinnGenRunService $runs, Run $run, string $category, array $detail): bool
    {
        $runs->markFailed($run, "DARKSTAR_R_{$category}", $category, $detail);

        return true;
    }

    private function redispatchPoll(Run $run): bool
    {
        $run->increment('reconciled_count');
        RunFinnGenAnalysisJob::dispatch($run->id, resumeMode: true)->onQueue('finngen');

        return true;
    }
}
