<?php

namespace App\Jobs\Ingestion;

use App\Enums\ExecutionStatus;
use App\Enums\IngestionStep;
use App\Models\App\IngestionJob;
use App\Services\Ingestion\CsvProfilerService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ProfileSourceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 600;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 2;

    public function __construct(
        public readonly IngestionJob $ingestionJob,
    ) {
        $this->queue = 'ingestion';
    }

    public function handle(CsvProfilerService $csvProfiler): void
    {
        // Update job status to running
        $this->ingestionJob->update([
            'status' => ExecutionStatus::Running,
            'current_step' => IngestionStep::Profiling,
            'started_at' => now(),
        ]);

        // Get the first source profile for this job
        $sourceProfile = $this->ingestionJob->profiles()->first();

        if (! $sourceProfile) {
            $this->ingestionJob->update([
                'status' => ExecutionStatus::Failed,
                'error_message' => 'No source profile found for this ingestion job.',
            ]);

            return;
        }

        // Read the file from storage using the ingestion disk
        $filePath = Storage::disk('ingestion')->path($sourceProfile->storage_path);

        // Get the CSV delimiter from format_metadata
        /** @var array<string, mixed>|null $formatMetadata */
        $formatMetadata = $sourceProfile->format_metadata;
        $delimiter = $formatMetadata['delimiter'] ?? ',';

        // Profile the CSV file
        $columnResults = $csvProfiler->profile($filePath, $delimiter);

        // Create FieldProfile records for each column
        foreach ($columnResults as $columnData) {
            $sourceProfile->fields()->create([
                'column_name' => $columnData['column_name'],
                'column_index' => $columnData['column_index'],
                'inferred_type' => $columnData['inferred_type'],
                'non_null_count' => $columnData['non_null_count'],
                'null_count' => $columnData['null_count'],
                'null_percentage' => $columnData['null_percentage'],
                'distinct_count' => $columnData['distinct_count'],
                'distinct_percentage' => $columnData['distinct_percentage'],
                'top_values' => $columnData['top_values'],
                'sample_values' => $columnData['sample_values'],
                'statistics' => $columnData['statistics'],
                'is_potential_pii' => $columnData['is_potential_pii'],
                'pii_type' => $columnData['pii_type'],
            ]);
        }

        // Update source profile with row_count and column_count
        $rowCount = $csvProfiler->getRowCount($filePath, $delimiter);
        $sourceProfile->update([
            'row_count' => $rowCount,
            'column_count' => count($columnResults),
        ]);

        // Update ingestion job progress (1/6 steps done = ~16%)
        $this->ingestionJob->update([
            'progress_percentage' => 16,
            'stats_json' => [
                'profiling' => [
                    'row_count' => $rowCount,
                    'column_count' => count($columnResults),
                    'completed_at' => now()->toIso8601String(),
                ],
            ],
        ]);
    }

    /**
     * Handle a job failure.
     */
    public function failed(?Throwable $exception): void
    {
        $this->ingestionJob->update([
            'status' => ExecutionStatus::Failed,
            'error_message' => $exception?->getMessage() ?? 'Unknown error during profiling.',
        ]);
    }
}
