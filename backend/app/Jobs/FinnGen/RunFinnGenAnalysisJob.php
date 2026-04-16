<?php

declare(strict_types=1);

namespace App\Jobs\FinnGen;

use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarRejectedException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarTimeoutException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarUnreachableException;
use App\Services\FinnGen\FinnGenAnalysisModuleRegistry;
use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\FinnGenSourceContextBuilder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Horizon job that drives a FinnGen run through dispatch → poll → terminal.
 *
 * Retry policy (spec §5.4):
 *   - Transport failures (Unreachable/Timeout) → 3 tries with backoff
 *   - Darkstar 4xx (Rejected) → no retry; fail fast
 *   - R errors inside the callr task → no retry; terminal FAILED
 *
 * Cancellation (spec §5.6):
 *   - Laravel flips status to 'canceling'
 *   - Each poll iteration checks fresh DB state; on 'canceling', calls
 *     Darkstar cancelJob() and transitions to CANCELED.
 *
 * Darkstar async_jobs.R returns:
 *   - status = "running"    → continue polling
 *   - status = "completed"  → inspect result.ok for success vs R-classified error
 *   - status = "failed"     → callr process-level crash (MIRAI_TASK_CRASHED)
 *   - status = "not_found"  → Darkstar lost the job (restart, TTL eviction)
 *   - status = "cancelled"  → returned by cancelJob(); treat as canceled
 */
class RunFinnGenAnalysisJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $timeout = 7200;

    public bool $failOnTimeout = true;

    /** @return list<int> */
    public function backoff(): array
    {
        return [5, 30, 120];
    }

    public function __construct(
        public readonly string $runId,
        public readonly bool $resumeMode = false,
    ) {}

    public function handle(
        FinnGenClient $client,
        FinnGenRunService $runs,
        FinnGenSourceContextBuilder $sourceBuilder,
        FinnGenAnalysisModuleRegistry $registry,
    ): void {
        $run = Run::find($this->runId);
        if (! $run) {
            Log::warning('finngen.run.not_found', ['run_id' => $this->runId]);

            return;
        }
        if ($run->isTerminal()) {
            Log::info('finngen.run.already_terminal', ['run_id' => $run->id, 'status' => $run->status]);

            return;
        }

        $module = $registry->assertEnabled($run->analysis_type);
        $role = $this->roleForAnalysisType($run->analysis_type);
        $source = $sourceBuilder->build($run->source_key, $role);

        if (! $this->resumeMode) {
            $runs->markRunning($run);

            try {
                $dispatch = $client->postAsyncDispatch($module->darkstar_endpoint, [
                    'source' => $source,
                    'run_id' => $run->id,
                    'params' => $run->params,
                    'analysis_settings' => $run->params,
                ]);
            } catch (FinnGenDarkstarRejectedException $e) {
                $runs->markFailed($run, 'FINNGEN_DARKSTAR_REJECTED', null, [
                    'darkstar_error' => $e->darkstarError,
                    'status' => $e->status,
                ]);

                return;
            }

            $jobId = is_string($dispatch['job_id'] ?? null) ? $dispatch['job_id'] : '';
            $run->update(['darkstar_job_id' => $jobId]);
            $run->refresh();
        }

        if (! $run->darkstar_job_id) {
            $runs->markFailed($run, 'FINNGEN_DARKSTAR_MALFORMED_RESPONSE', null, [
                'reason' => 'Darkstar dispatch response missing job_id',
            ]);

            return;
        }

        $this->pollUntilTerminal($run, $client, $runs);
    }

    private function pollUntilTerminal(Run $run, FinnGenClient $client, FinnGenRunService $runs): void
    {
        $startedAt = (int) ($run->started_at?->timestamp ?? time());

        while (true) {
            $fresh = $run->fresh();
            if (! $fresh || $fresh->isTerminal()) {
                return;
            }

            $jobId = (string) $fresh->darkstar_job_id;

            // Cooperative cancellation — Laravel flipped status to 'canceling'.
            if ($fresh->status === Run::STATUS_CANCELING) {
                $forced = false;
                try {
                    $cancelResult = $client->cancelJob($jobId);
                    $forced = (bool) ($cancelResult['forced'] ?? false);
                } catch (Throwable $e) {
                    Log::warning('finngen.cancel.darkstar_error', [
                        'run_id' => $fresh->id,
                        'error' => $e->getMessage(),
                    ]);
                }
                $runs->markCanceled($fresh, forced: $forced);

                return;
            }

            $state = $client->pollJob($jobId);
            $status = (string) ($state['status'] ?? '');

            if ($status === 'completed') {
                $this->handleTerminalCompleted($fresh, $runs, $state);

                return;
            }
            if ($status === 'failed') {
                $runs->markFailed($fresh, 'DARKSTAR_R_MIRAI_TASK_CRASHED', 'MIRAI_TASK_CRASHED', [
                    'callr_error' => $state['error'] ?? 'unknown',
                ]);

                return;
            }
            if ($status === 'not_found') {
                $runs->markFailed($fresh, 'DARKSTAR_R_MIRAI_TASK_CRASHED', 'MIRAI_TASK_CRASHED', [
                    'reason' => 'Darkstar lost track of the job (process crash or eviction)',
                ]);

                return;
            }
            if ($status === 'cancelled' || $status === 'canceled') {
                $runs->markCanceled($fresh);

                return;
            }

            // still running — emit progress if present and either sleep (prod) or bail (test).
            if (isset($state['progress']) && is_array($state['progress'])) {
                $runs->updateProgress($fresh, $state['progress']);
            }

            if ($this->isInTest()) {
                return;
            }

            $elapsed = time() - $startedAt;
            $sleep = $elapsed < 30 ? 2 : 5;
            sleep($sleep);
        }
    }

    /** @param array<string, mixed> $state */
    private function handleTerminalCompleted(Run $run, FinnGenRunService $runs, array $state): void
    {
        $result = is_array($state['result'] ?? null) ? $state['result'] : [];
        $ok = (bool) ($result['ok'] ?? false);

        if ($ok) {
            $artifacts = $this->extractArtifacts($run);
            $summary = is_array($result['result'] ?? null) ? $result['result'] : null;
            $runs->markSucceeded($run, $artifacts, $summary);

            return;
        }

        $rError = is_array($result['error'] ?? null) ? $result['error'] : [];
        $category = is_string($rError['category'] ?? null) ? $rError['category'] : 'ANALYSIS_EXCEPTION';
        $code = 'DARKSTAR_R_'.$category;

        $runs->markFailed($run, $code, $category, [
            'r_class' => $rError['class'] ?? null,
            'message' => $rError['message'] ?? null,
            'call' => $rError['call'] ?? null,
            'stack' => $rError['stack'] ?? null,
            'reproducer_params_path' => $rError['reproducer_params_path'] ?? null,
        ]);
    }

    /**
     * Inspect the shared artifact volume for known output files and return
     * the run.artifacts JSON map. Paths are relative to the volume root so
     * the API controller can resolve them against FINNGEN_ARTIFACTS_PATH.
     *
     * @return array<string, string>
     */
    private function extractArtifacts(Run $run): array
    {
        $basePath = (string) config('finngen.artifacts_path');
        $runDir = rtrim($basePath, '/').'/runs/'.$run->id;

        $candidates = [
            'results_db' => 'results.duckdb',
            'summary' => 'summary.json',
            'log' => 'log.txt',
            'report' => 'report.html',
            'progress' => 'progress.json',
            'params' => 'params.json',
            'result' => 'result.json',
        ];

        $artifacts = [];
        foreach ($candidates as $key => $filename) {
            if (is_file($runDir.'/'.$filename)) {
                $artifacts[$key] = "runs/{$run->id}/{$filename}";
            }
        }

        return $artifacts;
    }

    private function roleForAnalysisType(string $type): string
    {
        // romopapi.setup writes stratified_code_counts to *_results and needs RW.
        // Other romopapi.* and hades.* are pure reads.
        if ($type === 'romopapi.setup') {
            return FinnGenSourceContextBuilder::ROLE_RW;
        }

        return (str_starts_with($type, 'romopapi.') || str_starts_with($type, 'hades.'))
            ? FinnGenSourceContextBuilder::ROLE_RO
            : FinnGenSourceContextBuilder::ROLE_RW;
    }

    private function isInTest(): bool
    {
        return app()->environment('testing');
    }

    public function failed(Throwable $e): void
    {
        $run = Run::find($this->runId);
        if (! $run || $run->isTerminal()) {
            return;
        }

        $code = match (true) {
            $e instanceof FinnGenDarkstarTimeoutException => 'FINNGEN_DARKSTAR_TIMEOUT',
            $e instanceof FinnGenDarkstarUnreachableException => 'FINNGEN_DARKSTAR_UNREACHABLE',
            default => 'FINNGEN_WORKER_INTERRUPTED',
        };

        app(FinnGenRunService::class)->markFailed($run, $code, null, [
            'exception' => get_class($e),
            'message' => $e->getMessage(),
        ]);
    }
}
