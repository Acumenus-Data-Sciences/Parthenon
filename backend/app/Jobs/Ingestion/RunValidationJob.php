<?php

namespace App\Jobs\Ingestion;

use App\Enums\ExecutionStatus;
use App\Enums\IngestionStep;
use App\Models\App\IngestionJob;
use App\Services\Ingestion\PostLoadValidationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class RunValidationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The queue this job should be dispatched to.
     */
    public string $queue = 'ingestion';

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 600;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    public function __construct(
        public readonly IngestionJob $ingestionJob,
    ) {}

    public function handle(PostLoadValidationService $validationService): void
    {
        // Update job status to running
        $this->ingestionJob->update([
            'status' => ExecutionStatus::Running,
            'current_step' => IngestionStep::Validation,
        ]);

        // Run all validation checks
        $validationCounts = $validationService->validate($this->ingestionJob);

        // Update job to 100% complete
        $existingStats = $this->ingestionJob->stats_json ?? [];
        $existingStats['validation'] = [
            'total_checks' => $validationCounts['total'],
            'passed' => $validationCounts['passed'],
            'failed' => $validationCounts['failed'],
            'warnings' => $validationCounts['warnings'],
            'completed_at' => now()->toIso8601String(),
        ];

        $this->ingestionJob->update([
            'status' => ExecutionStatus::Completed,
            'progress_percentage' => 100,
            'completed_at' => now(),
            'stats_json' => $existingStats,
        ]);
    }

    /**
     * Handle a job failure.
     */
    public function failed(?Throwable $exception): void
    {
        $this->ingestionJob->update([
            'status' => ExecutionStatus::Failed,
            'error_message' => $exception?->getMessage() ?? 'Unknown error during validation.',
        ]);
    }
}
