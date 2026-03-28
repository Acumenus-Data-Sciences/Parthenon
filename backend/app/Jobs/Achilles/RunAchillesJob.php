<?php

namespace App\Jobs\Achilles;

use App\Context\SourceContext;
use App\Events\AchillesRunCompleted;
use App\Models\App\Source;
use App\Models\Results\AchillesRun;
use App\Services\Achilles\AchillesEngineService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RunAchillesJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 10800; // 3 hours — measurement analyses on large tables need this

    public int $tries = 3;

    public int $backoff = 30; // seconds between retries

    /**
     * Unique lock TTL: 4 hours (longer than timeout to cover retries).
     * Prevents a second Achilles job for the SAME source from being dispatched
     * while one is already queued or running.
     */
    public int $uniqueFor = 14400;

    /**
     * @param  list<string>|null  $categories
     * @param  list<int>|null  $analysisIds
     */
    public function __construct(
        public Source $source,
        public ?array $categories = null,
        public ?array $analysisIds = null,
        public bool $fresh = false,
        public ?string $runId = null,
    ) {
        $this->queue = 'achilles';
    }

    /**
     * Unique ID scoped to the source — only one Achilles job per source at a time.
     */
    public function uniqueId(): string
    {
        return 'achilles-source-'.$this->source->id;
    }

    public function handle(AchillesEngineService $engine): void
    {
        // Generate run_id if not provided (backward compat with CLI)
        $this->runId ??= (string) Str::uuid();

        // Guard: abort if another run for this source is already running
        $existingRun = AchillesRun::where('source_id', $this->source->id)
            ->where('status', 'running')
            ->where('run_id', '!=', $this->runId)
            ->first();

        if ($existingRun) {
            Log::warning('Achilles job aborted: another run is active for this source', [
                'source_id' => $this->source->id,
                'this_run_id' => $this->runId,
                'existing_run_id' => $existingRun->run_id,
            ]);

            // Mark this run as failed so it doesn't stay "pending" forever
            AchillesRun::where('run_id', $this->runId)->update([
                'status' => 'failed',
                'completed_at' => now(),
            ]);

            return;
        }

        // Register source context so SourceAware trait can resolve connections
        SourceContext::forSource($this->source);

        $isRetry = $this->attempts() > 1;

        Log::info('Achilles job '.($isRetry ? 'retrying' : 'started'), [
            'source_id' => $this->source->id,
            'run_id' => $this->runId,
            'attempt' => $this->attempts(),
            'categories' => $this->categories,
            'analysis_ids' => $this->analysisIds,
            'fresh' => $this->fresh,
        ]);

        // Create or recover the run record (idempotent for retries)
        $run = AchillesRun::updateOrCreate(
            ['run_id' => $this->runId],
            [
                'source_id' => $this->source->id,
                'categories' => $this->categories,
            ],
        );
        // Reset status on retry (status excluded from $fillable per HIGHSEC §3.1)
        if ($isRetry) {
            $run->update(['status' => 'pending']);
        }

        if ($this->fresh) {
            $engine->clearResults($this->analysisIds);
        }

        if ($this->analysisIds) {
            $result = $engine->runAnalyses($this->source, $this->analysisIds, $this->runId);
        } else {
            $result = $engine->runAll($this->source, $this->categories, $this->runId);
        }

        Log::info('Achilles job completed', [
            'source_id' => $this->source->id,
            'run_id' => $this->runId,
            'completed' => $result['completed'],
            'failed' => $result['failed'],
        ]);

        AchillesRunCompleted::dispatch($this->source->id, $this->runId, $this->source);
    }

    /**
     * Handle job failure — mark the run as failed so it never stays "running" forever.
     */
    public function failed(?\Throwable $exception): void
    {
        if ($this->runId) {
            AchillesRun::where('run_id', $this->runId)
                ->whereNot('status', 'completed')
                ->update([
                    'status' => 'failed',
                    'completed_at' => now(),
                ]);

            Log::error('Achilles job failed permanently', [
                'source_id' => $this->source->id,
                'run_id' => $this->runId,
                'attempt' => $this->attempts(),
                'error' => $exception?->getMessage(),
            ]);
        }
    }
}
