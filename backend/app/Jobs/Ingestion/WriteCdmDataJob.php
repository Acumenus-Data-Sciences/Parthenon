<?php

namespace App\Jobs\Ingestion;

use App\Enums\ExecutionStatus;
use App\Enums\IngestionStep;
use App\Models\App\IngestionJob;
use App\Services\Ingestion\CdmWriterService;
use App\Services\Ingestion\ObservationPeriodCalculator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class WriteCdmDataJob implements ShouldQueue
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
        public readonly IngestionJob $ingestionJob,
    ) {
        $this->queue = 'ingestion';
    }

    public function handle(
        CdmWriterService $cdmWriter,
        ObservationPeriodCalculator $observationPeriodCalculator,
    ): void {
        // Update job status to running
        $this->ingestionJob->update([
            'status' => ExecutionStatus::Running,
            'current_step' => IngestionStep::CdmWriting,
        ]);

        // Write source records to CDM tables
        $writeCounts = $cdmWriter->writeRecords($this->ingestionJob);

        // Calculate observation periods
        $observationPeriodCount = $observationPeriodCalculator->calculate();

        // Update job progress (5/6 steps done = ~83%)
        $existingStats = $this->ingestionJob->stats_json ?? [];
        $existingStats['cdm_writing'] = [
            'tables_written' => $writeCounts,
            'observation_periods' => $observationPeriodCount,
            'completed_at' => now()->toIso8601String(),
        ];

        $this->ingestionJob->update([
            'progress_percentage' => 83,
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
            'error_message' => $exception?->getMessage() ?? 'Unknown error during CDM writing.',
        ]);
    }
}
