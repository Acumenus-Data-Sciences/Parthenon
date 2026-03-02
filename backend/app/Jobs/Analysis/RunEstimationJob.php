<?php

namespace App\Jobs\Analysis;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\EstimationAnalysis;
use App\Models\App\Source;
use App\Services\Analysis\EstimationService;
use App\Traits\NotifiesOnCompletion;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunEstimationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    use NotifiesOnCompletion;

    /**
     * The number of seconds the job can run before timing out.
     * R analyses can be very long-running.
     */
    public int $timeout = 14400;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    public function __construct(
        public readonly EstimationAnalysis $estimationAnalysis,
        public readonly Source $source,
        public readonly AnalysisExecution $execution,
    ) {
        $this->queue = 'r-analysis';
    }

    public function handle(EstimationService $service): void
    {
        Log::info('RunEstimationJob started', [
            'estimation_analysis_id' => $this->estimationAnalysis->id,
            'source_id' => $this->source->id,
            'execution_id' => $this->execution->id,
        ]);

        try {
            $service->execute(
                $this->estimationAnalysis,
                $this->source,
                $this->execution,
            );

            Log::info('RunEstimationJob finished', [
                'estimation_analysis_id' => $this->estimationAnalysis->id,
                'execution_id' => $this->execution->id,
                'status' => $this->execution->fresh()->status->value,
            ]);

            $this->notifyAuthor($this->execution->fresh());
        } catch (\Throwable $e) {
            Log::error('RunEstimationJob failed', [
                'estimation_analysis_id' => $this->estimationAnalysis->id,
                'execution_id' => $this->execution->id,
                'error' => $e->getMessage(),
            ]);

            // Ensure execution is marked as failed
            $this->execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            $this->notifyAuthor($this->execution->fresh());
        }
    }
}
