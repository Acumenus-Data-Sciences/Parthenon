<?php

namespace App\Jobs\Analysis;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\Characterization;
use App\Models\App\Source;
use App\Services\Analysis\CharacterizationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunCharacterizationJob implements ShouldQueue
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

    public function __construct(
        public readonly Characterization $characterization,
        public readonly Source $source,
        public readonly AnalysisExecution $execution,
    ) {
        $this->queue = 'analysis';
    }

    public function handle(CharacterizationService $service): void
    {
        Log::info('RunCharacterizationJob started', [
            'characterization_id' => $this->characterization->id,
            'source_id' => $this->source->id,
            'execution_id' => $this->execution->id,
        ]);

        try {
            $service->execute(
                $this->characterization,
                $this->source,
                $this->execution,
            );

            Log::info('RunCharacterizationJob finished', [
                'characterization_id' => $this->characterization->id,
                'execution_id' => $this->execution->id,
                'status' => $this->execution->fresh()->status->value,
            ]);
        } catch (\Throwable $e) {
            Log::error('RunCharacterizationJob failed', [
                'characterization_id' => $this->characterization->id,
                'execution_id' => $this->execution->id,
                'error' => $e->getMessage(),
            ]);

            // Ensure execution is marked as failed
            $this->execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);
        }
    }
}
