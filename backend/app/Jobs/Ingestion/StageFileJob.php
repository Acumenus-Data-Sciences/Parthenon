<?php

namespace App\Jobs\Ingestion;

use App\Enums\ExecutionStatus;
use App\Models\App\IngestionJob;
use App\Models\App\IngestionProject;
use App\Services\Ingestion\StagingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class StageFileJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 1800;

    public int $tries = 2;

    public int $backoff = 30;

    public function __construct(
        public IngestionProject $project,
        public IngestionJob $job,
        public string $filePath,
        public string $tableName,
        public string $format,
    ) {
        $this->queue = 'ingestion';
    }

    public function handle(StagingService $staging): void
    {
        Log::info('StageFileJob started', [
            'project_id' => $this->project->id,
            'job_id' => $this->job->id,
            'table' => $this->tableName,
        ]);

        $this->job->update(['status' => ExecutionStatus::Running, 'started_at' => now()]);

        $rowCount = $staging->stageFile(
            $this->project,
            $this->job,
            $this->filePath,
            $this->tableName,
            $this->format,
        );

        $this->job->update([
            'status' => ExecutionStatus::Completed,
            'staging_table_name' => $this->tableName,
            'completed_at' => now(),
            'stats_json' => ['row_count' => $rowCount],
        ]);

        $this->recomputeProjectStatus();

        Log::info('StageFileJob completed', [
            'project_id' => $this->project->id,
            'table' => $this->tableName,
            'rows' => $rowCount,
        ]);
    }

    public function failed(?\Throwable $exception): void
    {
        $this->job->update([
            'status' => ExecutionStatus::Failed,
            'completed_at' => now(),
            'error_message' => $exception?->getMessage(),
        ]);

        $this->recomputeProjectStatus();

        Log::error('StageFileJob failed', [
            'project_id' => $this->project->id,
            'job_id' => $this->job->id,
            'error' => $exception?->getMessage(),
        ]);
    }

    private function recomputeProjectStatus(): void
    {
        $project = $this->project->fresh();
        if (! $project) {
            return;
        }

        $jobs = $project->jobs()->get();
        $total = $jobs->count();

        if ($total === 0) {
            $project->update(['status' => 'draft']);

            return;
        }

        $completed = $jobs->where('status', ExecutionStatus::Completed)->count();
        $failed = $jobs->where('status', ExecutionStatus::Failed)->count();

        if ($failed > 0) {
            $project->update(['status' => 'failed']);
        } elseif ($completed === $total) {
            $project->update(['status' => 'ready']);
        } else {
            $project->update(['status' => 'profiling']);
        }
    }
}
