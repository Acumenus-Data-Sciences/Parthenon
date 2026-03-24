<?php

namespace App\Jobs\Achilles;

use App\Models\App\Source;
use App\Models\Results\AchillesRun;
use App\Services\Achilles\AchillesEngineService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RunAchillesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 3600;

    public int $tries = 1;

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

    public function handle(AchillesEngineService $engine): void
    {
        // Generate run_id if not provided (backward compat with CLI)
        $this->runId ??= (string) Str::uuid();

        Log::info('Achilles job started', [
            'source_id' => $this->source->id,
            'run_id' => $this->runId,
            'categories' => $this->categories,
            'analysis_ids' => $this->analysisIds,
            'fresh' => $this->fresh,
        ]);

        // Create the run record
        AchillesRun::create([
            'source_id' => $this->source->id,
            'run_id' => $this->runId,
            'categories' => $this->categories,
        ]);

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
    }
}
