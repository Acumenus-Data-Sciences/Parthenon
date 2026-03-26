<?php

namespace App\Jobs\Ingestion;

use App\Enums\ExecutionStatus;
use App\Models\App\IngestionJob;
use App\Models\App\IngestionProject;
use App\Models\App\FieldProfile;
use App\Models\App\SourceProfile;
use App\Services\Ingestion\StagingService;
use App\Services\Ingestion\StagingSourceService;
use App\Services\Profiler\PiiDetectionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class StageFileJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 1800;

    public int $tries = 2;

    public int $backoff = 30;

    public function __construct(
        public IngestionProject $project,
        public IngestionJob $ingestionJob,
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
            'job_id' => $this->ingestionJob->id,
            'table' => $this->tableName,
        ]);

        $this->ingestionJob->update(['status' => ExecutionStatus::Running, 'started_at' => now()]);

        $rowCount = $staging->stageFile(
            $this->project,
            $this->ingestionJob,
            $this->filePath,
            $this->tableName,
            $this->format,
        );

        // Profile the staged table
        $profile = $this->profileStagedTable($staging, $rowCount);

        // Run PII detection
        if ($profile) {
            app(PiiDetectionService::class)->detectAndFlag($profile);
        }

        $this->ingestionJob->update([
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
        $this->ingestionJob->update([
            'status' => ExecutionStatus::Failed,
            'completed_at' => now(),
            'error_message' => $exception?->getMessage(),
        ]);

        $this->recomputeProjectStatus();

        Log::error('StageFileJob failed', [
            'project_id' => $this->project->id,
            'job_id' => $this->ingestionJob->id,
            'error' => $exception?->getMessage(),
        ]);
    }

    /**
     * Profile the staged table — compute column stats from the actual data.
     */
    private function profileStagedTable(StagingService $staging, int $rowCount): ?SourceProfile
    {
        $schema = $this->project->staging_schema;

        // Get column info from the staging table
        $columns = DB::connection('pgsql')->select(
            "SELECT column_name, data_type FROM information_schema.columns
             WHERE table_schema = ? AND table_name = ? AND column_name != '__row_id'
             ORDER BY ordinal_position",
            [$schema, $this->tableName],
        );

        if (empty($columns)) {
            return null;
        }

        // Find or create the SourceProfile for this job
        $existingProfile = $this->ingestionJob->profiles()->first();
        $profile = $existingProfile ?? SourceProfile::create([
            'ingestion_job_id' => $this->ingestionJob->id,
            'scan_type' => 'ingestion',
            'table_count' => 1,
            'column_count' => count($columns),
            'row_count' => $rowCount,
            'total_rows' => $rowCount,
        ]);

        // Update existing profile if it exists
        if ($existingProfile) {
            $existingProfile->update([
                'scan_type' => 'ingestion',
                'table_count' => 1,
                'column_count' => count($columns),
                'row_count' => $rowCount,
                'total_rows' => $rowCount,
            ]);
        }

        // Compute per-column stats from the staging table
        $qualifiedTable = $this->quoteId($schema).'.'.$this->quoteId($this->tableName);

        foreach ($columns as $idx => $col) {
            $colName = $col->column_name;
            $quotedCol = $this->quoteId($colName);

            // Compute null count and distinct count
            $stats = DB::connection('pgsql')->selectOne(
                "SELECT
                    COUNT(*) FILTER (WHERE {$quotedCol} IS NULL OR TRIM({$quotedCol}) = '') AS null_count,
                    COUNT(DISTINCT {$quotedCol}) AS distinct_count
                FROM {$qualifiedTable}",
            );

            $nullCount = (int) ($stats->null_count ?? 0);
            $distinctCount = (int) ($stats->distinct_count ?? 0);
            $nullPct = $rowCount > 0 ? round($nullCount / $rowCount * 100, 2) : 0;
            $distinctPct = $rowCount > 0 ? round($distinctCount / $rowCount * 100, 2) : 0;

            // Get top 5 sample values
            $samples = DB::connection('pgsql')->select(
                "SELECT {$quotedCol} AS val, COUNT(*) AS freq
                FROM {$qualifiedTable}
                WHERE {$quotedCol} IS NOT NULL AND TRIM({$quotedCol}) != ''
                GROUP BY {$quotedCol}
                ORDER BY freq DESC
                LIMIT 5",
            );

            $sampleValues = [];
            foreach ($samples as $s) {
                $sampleValues[$s->val] = (int) $s->freq;
            }

            FieldProfile::updateOrCreate(
                ['source_profile_id' => $profile->id, 'column_name' => $colName],
                [
                    'table_name' => $this->tableName,
                    'row_count' => $rowCount,
                    'column_index' => $idx,
                    'inferred_type' => 'text',
                    'non_null_count' => $rowCount - $nullCount,
                    'null_count' => $nullCount,
                    'null_percentage' => $nullPct,
                    'distinct_count' => $distinctCount,
                    'distinct_percentage' => $distinctPct,
                    'sample_values' => $sampleValues,
                ],
            );
        }

        return $profile->fresh();
    }

    private function quoteId(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
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
            // Auto-create staging source for Aqueduct integration
            app(StagingSourceService::class)->createStagingSource($project);
        } else {
            $project->update(['status' => 'profiling']);
        }
    }
}
