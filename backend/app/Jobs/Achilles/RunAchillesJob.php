<?php

namespace App\Jobs\Achilles;

use App\Models\App\Source;
use App\Services\Achilles\AchillesEngineService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunAchillesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 3600;

    /**
     * The number of times the job may be attempted.
     */
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
    ) {
        $this->queue = 'achilles';
    }

    public function handle(AchillesEngineService $engine): void
    {
        Log::info('Achilles job started', [
            'source_id' => $this->source->id,
            'categories' => $this->categories,
            'analysis_ids' => $this->analysisIds,
            'fresh' => $this->fresh,
        ]);

        if ($this->fresh) {
            $engine->clearResults($this->analysisIds);
        }

        if ($this->analysisIds) {
            $result = $engine->runAnalyses($this->source, $this->analysisIds);
        } else {
            $result = $engine->runAll($this->source, $this->categories);
        }

        Log::info('Achilles job completed', [
            'source_id' => $this->source->id,
            'completed' => $result['completed'],
            'failed' => $result['failed'],
        ]);
    }
}
