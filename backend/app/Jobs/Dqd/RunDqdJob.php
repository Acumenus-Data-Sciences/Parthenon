<?php

namespace App\Jobs\Dqd;

use App\Models\App\Source;
use App\Services\Dqd\DqdEngineService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunDqdJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * DQD runs can be very long (711M measurement rows, ~170 checks).
     * Allow up to 2 hours.
     */
    public int $timeout = 7200;

    /**
     * Do not retry automatically — DQD checks are idempotent but expensive.
     */
    public int $tries = 1;

    public function __construct(
        public Source $source,
        public ?string $category = null,
        public ?string $cdmTable = null,
        public ?string $runId = null,
    ) {
        $this->queue = 'achilles';
    }

    /**
     * Execute the DQD run.
     */
    public function handle(DqdEngineService $engine): void
    {
        Log::info('RunDqdJob: Starting DQD execution', [
            'source_id' => $this->source->id,
            'category' => $this->category,
            'cdm_table' => $this->cdmTable,
            'run_id' => $this->runId,
        ]);

        if ($this->category) {
            $result = $engine->runCategory($this->source, $this->category, $this->runId);
        } elseif ($this->cdmTable) {
            $result = $engine->runForTable($this->source, $this->cdmTable, $this->runId);
        } else {
            $result = $engine->runAll($this->source, $this->runId);
        }

        Log::info('RunDqdJob: DQD execution completed', [
            'source_id' => $this->source->id,
            'run_id' => $result['runId'],
            'completed' => $result['completed'],
            'failed' => $result['failed'],
        ]);
    }

    /**
     * Handle a job failure.
     */
    public function failed(?\Throwable $exception): void
    {
        Log::error('RunDqdJob: DQD execution failed', [
            'source_id' => $this->source->id,
            'run_id' => $this->runId,
            'error' => $exception?->getMessage(),
        ]);
    }
}
