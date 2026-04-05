<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Enums\IngestionStep;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunCharacterizationJob;
use App\Jobs\Analysis\RunEstimationJob;
use App\Jobs\Analysis\RunEvidenceSynthesisJob;
use App\Jobs\Analysis\RunIncidenceRateJob;
use App\Jobs\Analysis\RunPathwayJob;
use App\Jobs\Analysis\RunPredictionJob;
use App\Jobs\Analysis\RunSccsJob;
use App\Jobs\Ingestion\ProfileSourceJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\CareGapEvaluation;
use App\Models\App\Characterization;
use App\Models\App\CohortGeneration;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\ExecutionLog;
use App\Models\App\FhirExportJob;
use App\Models\App\FhirSyncRun;
use App\Models\App\GenomicUpload;
use App\Models\App\GisDataset;
use App\Models\App\GisImport;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\IngestionJob;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PoseidonRun;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\App\Source;
use App\Models\App\VocabularyImport;
use App\Models\Results\AchillesHeelRun;
use App\Models\Results\AchillesRun;
use App\Services\Dqd\DqdCheckRegistry;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * @group System
 */
class JobController extends Controller
{
    /**
     * @var list<class-string>
     */
    private const ANALYSIS_MODELS = [
        Characterization::class,
        IncidenceRateAnalysis::class,
        PathwayAnalysis::class,
        EstimationAnalysis::class,
        PredictionAnalysis::class,
        SccsAnalysis::class,
        EvidenceSynthesisAnalysis::class,
    ];

    /**
     * List jobs.
     *
     * @queryParam scope string  "recent" (default) = last 24h + all non-completed, "archived" = completed >24h ago
     * @queryParam status string  Filter by normalized status (running, completed, failed, queued, pending)
     * @queryParam type string    Filter by job type (characterization, genomic_parse, ingestion, etc.)
     */
    public function index(Request $request): JsonResponse
    {
        $statusFilter = $request->string('status')->toString() ?: null;
        $typeFilter = $request->string('type')->toString() ?: null;
        $scope = $request->string('scope')->toString() ?: 'recent';
        $userId = $request->user()->id;
        $perPage = min(max($request->integer('per_page', 50), 1), 100);

        $allJobs = collect();

        // 1. Analysis executions (existing)
        if (! $typeFilter || in_array($typeFilter, ['characterization', 'incidence_rate', 'pathway', 'estimation', 'prediction', 'sccs', 'evidence_synthesis', 'analysis'], true)) {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getAnalysisJobs($userId, null, $typeFilter)));
        }

        // 1b. Cohort generation jobs
        if (! $typeFilter || $typeFilter === 'cohort_generation') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getCohortGenerationJobs(null)));
        }

        // 2. Ingestion jobs
        if (! $typeFilter || $typeFilter === 'ingestion') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getIngestionJobs($userId, null)));
        }

        // 3. FHIR export jobs
        if (! $typeFilter || $typeFilter === 'fhir_export') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getFhirExportJobs($userId, null)));
        }

        // 4. GIS import jobs (table may not exist in test environments)
        if (! $typeFilter || $typeFilter === 'gis_import') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getGisImportJobs($userId, null)));
        }

        // 5. Genomic upload/parse jobs
        if (! $typeFilter || $typeFilter === 'genomic_parse') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getGenomicParseJobs($userId, null)));
        }

        // 6. Vocabulary import jobs
        if (! $typeFilter || $typeFilter === 'vocabulary_load') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getVocabularyImportJobs($userId, null)));
        }

        // 7. DQD runs (system-level, not user-scoped)
        if (! $typeFilter || $typeFilter === 'dqd') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getDqdJobs(null)));
        }

        // 8. Heel runs (system-level, not user-scoped)
        if (! $typeFilter || $typeFilter === 'heel') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getHeelJobs(null)));
        }

        // 9. Achilles measurement runs (system-level, not user-scoped)
        if (! $typeFilter || $typeFilter === 'achilles') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getAchillesJobs(null)));
        }

        // 10. FHIR Sync runs (system-level)
        if (! $typeFilter || $typeFilter === 'fhir_sync') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getFhirSyncJobs(null)));
        }

        // 11. Care Gap evaluations (user-scoped)
        if (! $typeFilter || $typeFilter === 'care_gap') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getCareGapJobs($userId, null)));
        }

        // 12. GIS Boundary loads (user-scoped, table may not exist in test environments)
        if (! $typeFilter || $typeFilter === 'gis_boundary') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getGisBoundaryJobs($userId, null)));
        }

        // 13. Poseidon ETL runs (system-level)
        if (! $typeFilter || $typeFilter === 'poseidon') {
            $allJobs = $allJobs->merge($this->safeCollectJobs(fn () => $this->getPoseidonJobs(null)));
        }

        $allJobs = $allJobs->map(fn (array $job) => $this->normalizeJobPayload($job));

        if ($statusFilter) {
            $allJobs = $allJobs->filter(fn (array $job) => $job['status'] === $statusFilter);
        }

        // Apply scope filter: recent (last 24h + non-completed) vs archived (completed >24h ago)
        $cutoff = now()->subHours(24)->toIso8601String();
        $doneStatuses = ['completed', 'failed', 'cancelled'];

        if ($scope === 'archived') {
            // Only completed/failed/cancelled jobs older than 24h
            $allJobs = $allJobs->filter(function (array $job) use ($cutoff, $doneStatuses) {
                return in_array($job['status'], $doneStatuses, true)
                    && ($job['created_at'] ?? '') < $cutoff;
            });
        } elseif ($scope === 'recent') {
            // All non-completed jobs + completed jobs within last 24h
            $allJobs = $allJobs->filter(function (array $job) use ($cutoff, $doneStatuses) {
                if (! in_array($job['status'], $doneStatuses, true)) {
                    return true; // always show running/queued/pending
                }

                return ($job['created_at'] ?? '') >= $cutoff;
            });
        }
        // scope=all → no filtering

        // Sort all by created_at descending
        $sorted = $allJobs->sortByDesc('created_at')->values();

        // Manual pagination
        $page = $request->integer('page', 1);
        $total = $sorted->count();
        $paged = $sorted->forPage($page, $perPage)->values();

        return response()->json([
            'data' => $paged,
            'meta' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => (int) ceil($total / $perPage) ?: 1,
                'scope' => $scope,
            ],
        ]);
    }

    public function show(Request $request, int $jobId): JsonResponse
    {
        $type = $request->string('type')->toString();

        $detail = match ($type) {
            'characterization', 'incidence_rate', 'pathway', 'estimation',
            'prediction', 'sccs', 'evidence_synthesis', 'analysis' => $this->showAnalysisJob($jobId, $request->user()->id),
            'cohort_generation' => $this->showCohortGenerationJob($jobId),
            'ingestion' => $this->showIngestionJob($jobId, $request->user()->id),
            'fhir_export' => $this->showFhirExportJob($jobId, $request->user()->id),
            'fhir_sync' => $this->showFhirSyncJob($jobId),
            'gis_import' => $this->showGisImportJob($jobId, $request->user()->id),
            'gis_boundary' => $this->showGisBoundaryJob($jobId, $request->user()->id),
            'genomic_parse' => $this->showGenomicParseJob($jobId, $request->user()->id),
            'vocabulary_load' => $this->showVocabularyImportJob($jobId, $request->user()->id),
            'dqd' => $this->showDqdJob($jobId),
            'heel' => $this->showHeelJob($jobId),
            'achilles' => $this->showAchillesJob($jobId),
            'care_gap' => $this->showCareGapJob($jobId, $request->user()->id),
            'poseidon' => $this->showPoseidonJob($jobId),
            default => null,
        };

        if (! $detail) {
            abort(404, 'Job not found');
        }

        return response()->json($this->normalizeJobPayload($detail));
    }

    public function retry(Request $request, int $jobId): JsonResponse
    {
        $type = $request->string('type')->toString();
        $userId = $request->user()->id;

        return match ($type) {
            'characterization', 'incidence_rate', 'pathway', 'estimation',
            'prediction', 'sccs', 'evidence_synthesis', 'analysis' => $this->retryAnalysisJob($jobId, $userId),
            'ingestion' => $this->retryIngestionJob($jobId, $userId),
            default => response()->json([
                'message' => 'Retry is not supported for this job type.',
            ], 422),
        };
    }

    public function cancel(Request $request, int $jobId): JsonResponse
    {
        $type = $request->string('type')->toString();
        $userId = $request->user()->id;

        return match ($type) {
            'characterization', 'incidence_rate', 'pathway', 'estimation',
            'prediction', 'sccs', 'evidence_synthesis', 'analysis' => $this->cancelAnalysisJob($jobId, $userId),
            default => response()->json([
                'message' => 'Cancel is not supported for this job type.',
            ], 422),
        };
    }

    // ─── Job detail builders ────────────────────────────────────────────

    /**
     * @return array<string, mixed>|null
     */
    private function showAnalysisJob(int $id, int $userId): ?array
    {
        $job = AnalysisExecution::with(['analysis', 'source', 'logs'])->find($id);
        if (! $job || $job->analysis?->author_id !== $userId) {
            return null;
        }

        $base = $this->transformAnalysisJob($job, true);
        $analysis = $job->analysis;

        $base['details'] = [
            'analysis_name' => $analysis?->name,
            'analysis_description' => $analysis?->description,
            'created_by' => $analysis?->author?->name,
            'parameters' => method_exists($analysis, 'getParameters') ? $analysis->getParameters() : null,
        ];

        // Execution timeline from logs
        $base['timeline'] = $job->logs->map(fn (ExecutionLog $log) => [
            'timestamp' => $log->created_at?->toIso8601String(),
            'level' => strtoupper((string) $log->level),
            'message' => (string) $log->message,
        ])->values()->all();

        return $base;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showCohortGenerationJob(int $id): ?array
    {
        $gen = CohortGeneration::with(['cohortDefinition', 'source'])->find($id);
        if (! $gen) {
            return null;
        }

        $isStale = in_array($gen->status, [ExecutionStatus::Queued, ExecutionStatus::Running, ExecutionStatus::Pending], true)
            && $gen->started_at
            && $gen->started_at->diffInMinutes(now()) > 60;
        $displayStatus = $isStale ? ExecutionStatus::Failed : $gen->status;

        return [
            'id' => $gen->id,
            'type' => 'cohort_generation',
            'name' => 'Cohort Generation — '.($gen->cohortDefinition?->name ?? 'Unknown'),
            'status' => $displayStatus instanceof ExecutionStatus ? $displayStatus->value : (string) $displayStatus,
            'source_name' => $gen->source?->source_name,
            'triggered_by' => null,
            'progress' => $displayStatus === ExecutionStatus::Completed ? 100 : ($displayStatus === ExecutionStatus::Running ? 50 : 0),
            'started_at' => $gen->started_at?->toIso8601String(),
            'completed_at' => $gen->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $isStale ? 'Job stalled — exceeded 1 hour without completing' : $gen->fail_message,
            'log_output' => $gen->person_count !== null ? number_format($gen->person_count).' persons generated' : null,
            'created_at' => $gen->created_at?->toIso8601String(),
            'details' => [
                'cohort_name' => $gen->cohortDefinition?->name,
                'cohort_description' => $gen->cohortDefinition?->description,
                'person_count' => $gen->person_count,
                'source_name' => $gen->source?->source_name,
                'source_key' => $gen->source?->source_key,
                'is_stale' => $isStale,
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showIngestionJob(int $id, int $userId): ?array
    {
        $job = IngestionJob::with(['source', 'creator', 'project'])->find($id);
        if (! $job || $job->created_by !== $userId) {
            return null;
        }

        return [
            'id' => $job->id,
            'type' => 'ingestion',
            'name' => 'Data Ingestion — '.($job->source?->source_name ?? 'Unknown source'),
            'status' => $job->status instanceof ExecutionStatus ? $job->status->value : (string) $job->status,
            'source_name' => $job->source?->source_name,
            'triggered_by' => $job->creator?->name,
            'progress' => $job->progress_percentage ?? 0,
            'started_at' => $job->started_at?->toIso8601String(),
            'completed_at' => $job->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $job->error_message,
            'log_output' => $job->log_output,
            'created_at' => $job->created_at?->toIso8601String(),
            'details' => [
                'pipeline_stage' => $job->pipeline_stage,
                'file_name' => $job->file_name,
                'file_size_bytes' => $job->file_size_bytes,
                'records_total' => $job->records_total,
                'records_processed' => $job->records_processed,
                'records_failed' => $job->records_failed,
                'mapping_coverage' => $job->mapping_coverage,
                'project_name' => $job->project?->name,
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showFhirExportJob(int $id, int $userId): ?array
    {
        $job = FhirExportJob::find($id);
        if (! $job || $job->user_id !== $userId) {
            return null;
        }

        $types = is_array($job->resource_types) ? implode(', ', $job->resource_types) : '';

        return [
            'id' => $job->id,
            'type' => 'fhir_export',
            'name' => 'FHIR Export'.($types ? " — {$types}" : ''),
            'status' => $this->normalizeFhirExportStatus((string) $job->status),
            'source_name' => null,
            'triggered_by' => null,
            'progress' => $job->status === 'completed' ? 100 : ($job->status === 'processing' ? 50 : 0),
            'started_at' => $job->started_at?->toIso8601String(),
            'completed_at' => $job->finished_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $job->error_message,
            'log_output' => null,
            'created_at' => $job->created_at?->toIso8601String(),
            'details' => [
                'resource_types' => $job->resource_types,
                'output_format' => $job->output_format ?? 'ndjson',
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showFhirSyncJob(int $id): ?array
    {
        $job = FhirSyncRun::with(['connection', 'triggeredBy'])->find($id);
        if (! $job) {
            return null;
        }

        $normalized = $this->normalizeFhirSyncStatus($job->status);

        return [
            'id' => $job->id,
            'type' => 'fhir_sync',
            'name' => 'FHIR Sync — '.($job->connection?->name ?? 'Unknown'),
            'status' => $normalized,
            'source_name' => $job->connection?->name,
            'triggered_by' => $job->triggeredBy?->name,
            'progress' => $normalized === 'running' ? 50 : ($normalized === 'completed' ? 100 : 0),
            'started_at' => $job->started_at?->toIso8601String(),
            'completed_at' => $job->finished_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $job->error_message,
            'log_output' => null,
            'created_at' => $job->created_at?->toIso8601String(),
            'details' => [
                'resource_types' => $job->resource_types,
                'files_downloaded' => $job->files_downloaded,
                'records_extracted' => $job->records_extracted,
                'records_mapped' => $job->records_mapped,
                'records_written' => $job->records_written,
                'records_failed' => $job->records_failed,
                'mapping_coverage' => $job->mapping_coverage,
                'export_url' => $job->export_url,
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showGisImportJob(int $id, int $userId): ?array
    {
        $job = GisImport::with(['user'])->find($id);
        if (! $job || $job->user_id !== $userId) {
            return null;
        }

        return [
            'id' => $job->id,
            'type' => 'gis_import',
            'name' => 'GIS Import — '.($job->filename ?? 'Unknown file'),
            'status' => $this->normalizeGisStatus((string) $job->status),
            'source_name' => null,
            'triggered_by' => $job->user?->name,
            'progress' => $job->progress_percentage ?? 0,
            'started_at' => $job->started_at?->toIso8601String(),
            'completed_at' => $job->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => is_array($job->error_log) ? implode("\n", $job->error_log) : null,
            'log_output' => $job->log_output,
            'created_at' => $job->created_at?->toIso8601String(),
            'details' => [
                'filename' => $job->filename,
                'file_size_bytes' => $job->file_size_bytes,
                'feature_count' => $job->feature_count,
                'geometry_type' => $job->geometry_type,
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showGisBoundaryJob(int $id, int $userId): ?array
    {
        $job = GisDataset::find($id);
        if (! $job || $job->user_id !== $userId) {
            return null;
        }

        return [
            'id' => $job->id,
            'type' => 'gis_boundary',
            'name' => 'GIS Boundaries — '.($job->name ?? 'Unknown dataset'),
            'status' => $this->normalizeGisBoundaryStatus($job->status),
            'source_name' => null,
            'triggered_by' => $job->user?->name,
            'progress' => $job->progress_percentage ?? (in_array($this->normalizeGisBoundaryStatus($job->status), ['completed', 'failed'], true) ? 100 : 0),
            'started_at' => $job->started_at?->toIso8601String(),
            'completed_at' => $job->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $job->error_message,
            'log_output' => $job->log_output,
            'created_at' => $job->created_at?->toIso8601String(),
            'details' => [
                'dataset_name' => $job->name,
                'data_type' => $job->data_type,
                'geometry_type' => $job->geometry_type,
                'feature_count' => $job->feature_count,
                'source_name' => $job->source,
                'source_version' => $job->source_version,
                'levels_requested' => $job->levels_requested,
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showGenomicParseJob(int $id, int $userId): ?array
    {
        $job = GenomicUpload::with(['source', 'creator'])->find($id);
        if (! $job || $job->created_by !== $userId) {
            return null;
        }

        return [
            'id' => $job->id,
            'type' => 'genomic_parse',
            'name' => 'Genomic Parse — '.($job->filename ?? 'Unknown file'),
            'status' => $this->normalizeGenomicStatus($job->status),
            'source_name' => $job->source?->source_name,
            'triggered_by' => $job->creator?->name,
            'progress' => $this->genomicProgress($job->status, $job->total_variants, $job->file_size_bytes),
            'started_at' => $job->created_at?->toIso8601String(),
            'completed_at' => $job->parsed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $job->error_message,
            'log_output' => null,
            'created_at' => $job->created_at?->toIso8601String(),
            'details' => [
                'filename' => $job->filename,
                'file_size_bytes' => $job->file_size_bytes,
                'file_format' => $job->file_format,
                'total_variants' => $job->total_variants,
                'mapped_variants' => $job->mapped_variants,
                'sample_count' => $job->sample_count,
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showVocabularyImportJob(int $id, int $userId): ?array
    {
        $job = VocabularyImport::with(['source'])->find($id);
        if (! $job || $job->user_id !== $userId) {
            return null;
        }

        return [
            'id' => $job->id,
            'type' => 'vocabulary_load',
            'name' => 'Vocabulary Import — '.($job->file_name ?? 'Unknown file'),
            'status' => (string) $job->status,
            'source_name' => $job->source?->source_name,
            'triggered_by' => $job->user?->name,
            'progress' => $job->progress_percentage ?? 0,
            'started_at' => $job->started_at?->toIso8601String(),
            'completed_at' => $job->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $job->error_message,
            'log_output' => $job->log_output,
            'created_at' => $job->created_at?->toIso8601String(),
            'details' => [
                'file_name' => $job->file_name,
                'vocabulary_version' => $job->vocabulary_version,
                'tables_loaded' => $job->tables_loaded,
                'records_loaded' => $job->records_loaded,
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showDqdJob(int $id): ?array
    {
        $totalExpected = app(DqdCheckRegistry::class)->count();

        // id is crc32(run_id) — find the matching run
        $runs = DB::table('app.dqd_results')
            ->selectRaw('run_id, source_id, COUNT(*) as total_checks, SUM(CASE WHEN passed = true THEN 1 ELSE 0 END)::int as passed_count, SUM(CASE WHEN passed = false THEN 1 ELSE 0 END)::int as failed_count, MIN(created_at) as started_at, MAX(created_at) as completed_at, SUM(execution_time_ms) as total_ms')
            ->groupBy('run_id', 'source_id')
            ->orderByDesc('started_at')
            ->get();

        $run = $runs->first(fn ($r) => crc32($r->run_id) === $id);
        if (! $run) {
            return null;
        }

        $source = Source::find($run->source_id);
        $completed = (int) $run->total_checks;
        $passed = (int) $run->passed_count;
        $failed = (int) $run->failed_count;
        $lastCheckAge = $run->completed_at ? abs(now()->diffInSeconds(Carbon::parse($run->completed_at))) : PHP_INT_MAX;
        $isRunning = $completed < $totalExpected && $lastCheckAge < 300;

        // Get top failing checks for detail
        $topFailures = DB::table('app.dqd_results')
            ->where('run_id', $run->run_id)
            ->where('passed', false)
            ->select('check_id', 'category', 'subcategory', 'severity', 'description', 'cdm_table')
            ->orderBy('severity')
            ->orderBy('category')
            ->limit(20)
            ->get();

        return [
            'id' => $id,
            'type' => 'dqd',
            'name' => 'Data Quality — '.($source?->source_name ?? 'Unknown source'),
            'status' => $isRunning ? 'running' : 'completed',
            'source_name' => $source?->source_name,
            'triggered_by' => null,
            'progress' => $isRunning ? round(($completed / max($totalExpected, 1)) * 100) : 100,
            'started_at' => $run->started_at,
            'completed_at' => $isRunning ? null : $run->completed_at,
            'duration' => null,
            'error_message' => $failed > 0 ? "{$failed} of {$completed} checks failed" : null,
            'log_output' => "{$completed} checks: {$passed} passed, {$failed} failed",
            'created_at' => $run->started_at,
            'details' => [
                'total_expected' => $totalExpected,
                'checks_completed' => $completed,
                'checks_passed' => $passed,
                'checks_failed' => $failed,
                'pass_rate' => $completed > 0 ? round(($passed / $completed) * 100, 1) : 0,
                'total_execution_ms' => (int) ($run->total_ms ?? 0),
                'top_failures' => $topFailures->map(fn ($f) => [
                    'check' => $f->check_id,
                    'category' => $f->category,
                    'subcategory' => $f->subcategory,
                    'severity' => $f->severity,
                    'description' => $f->description,
                    'table' => $f->cdm_table,
                ])->all(),
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showHeelJob(int $id): ?array
    {
        $run = AchillesHeelRun::with('source')->find($id);
        if (! $run) {
            return null;
        }

        $status = $run->status ?? 'pending';
        $totalRules = max((int) $run->total_rules, 1);
        $isRunning = $status === 'running';

        // Get violations grouped by severity
        $violations = DB::table('app.achilles_heel_results')
            ->where('run_id', $run->run_id)
            ->select('rule_id', 'rule_name', 'severity', 'record_count', 'attribute_name')
            ->orderByDesc('record_count')
            ->limit(25)
            ->get();

        return [
            'id' => $run->id,
            'type' => 'heel',
            'name' => 'Heel Checks — '.($run->source?->source_name ?? 'Unknown source'),
            'status' => $status,
            'source_name' => $run->source?->source_name,
            'triggered_by' => null,
            'progress' => $isRunning ? min((int) round((($run->completed_rules + $run->failed_rules) / $totalRules) * 100), 99) : 100,
            'started_at' => $run->started_at?->toIso8601String(),
            'completed_at' => $run->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $run->error_message,
            'log_output' => "{$run->completed_rules}/{$totalRules} rules completed, {$violations->count()} issues found",
            'created_at' => $run->created_at?->toIso8601String(),
            'details' => [
                'total_rules' => $run->total_rules,
                'rules_triggered' => (int) $violations->pluck('rule_id')->unique()->count(),
                'total_violations' => (int) $violations->count(),
                'violations' => $violations->map(fn ($v) => [
                    'rule_id' => $v->rule_id,
                    'rule_name' => $v->rule_name,
                    'severity' => $v->severity,
                    'record_count' => $v->record_count,
                    'attribute' => $v->attribute_name,
                ])->all(),
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showAchillesJob(int $id): ?array
    {
        $run = AchillesRun::with('steps')->find($id);
        if (! $run) {
            return null;
        }

        $source = Source::find($run->source_id);
        $isRunning = $run->status === 'running';
        $total = $run->total_analyses ?: 1;
        $pct = $isRunning ? min((int) round(($run->completed_analyses / $total) * 100), 99) : 100;

        // Group steps by category for breakdown
        $stepsByCategory = $run->steps->groupBy('category')->map(function ($steps, $category) {
            return [
                'category' => $category,
                'total' => $steps->count(),
                'completed' => $steps->where('status', 'completed')->count(),
                'failed' => $steps->where('status', 'failed')->count(),
                'running' => $steps->where('status', 'running')->count(),
            ];
        })->values()->all();

        // Recent failed steps
        $failedSteps = $run->steps->where('status', 'failed')->map(fn ($s) => [
            'analysis_id' => $s->analysis_id,
            'analysis_name' => $s->analysis_name,
            'category' => $s->category,
            'error' => $s->error_message,
            'elapsed_seconds' => $s->elapsed_seconds,
        ])->values()->all();

        return [
            'id' => $run->id,
            'type' => 'achilles',
            'name' => 'Achilles — '.($source?->source_name ?? 'Unknown source'),
            'status' => $run->status,
            'source_name' => $source?->source_name,
            'triggered_by' => null,
            'progress' => $isRunning ? $pct : ($run->status === 'completed' ? 100 : 0),
            'started_at' => $run->started_at?->toIso8601String(),
            'completed_at' => $run->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $run->failed_analyses > 0 ? "{$run->failed_analyses} of {$total} analyses failed" : null,
            'log_output' => "{$run->completed_analyses}/{$total} analyses completed",
            'created_at' => $run->created_at?->toIso8601String(),
            'details' => [
                'total_analyses' => $run->total_analyses,
                'completed_analyses' => $run->completed_analyses,
                'failed_analyses' => $run->failed_analyses,
                'categories' => $run->categories,
                'category_breakdown' => $stepsByCategory,
                'failed_steps' => $failedSteps,
            ],
            'timeline' => $run->steps
                ->sortBy('started_at')
                ->filter(fn ($s) => $s->started_at)
                ->map(fn ($s) => [
                    'timestamp' => $s->started_at->toIso8601String(),
                    'level' => $s->status === 'failed' ? 'ERROR' : 'INFO',
                    'message' => "[{$s->category}] {$s->analysis_name} — {$s->status}"
                        .($s->elapsed_seconds ? " ({$s->elapsed_seconds}s)" : ''),
                ])->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showCareGapJob(int $id, int $userId): ?array
    {
        $job = CareGapEvaluation::with(['bundle', 'source', 'author'])->find($id);
        if (! $job || $job->author_id !== $userId) {
            return null;
        }

        return [
            'id' => $job->id,
            'type' => 'care_gap',
            'name' => 'Care Gap — '.($job->bundle?->name ?? 'Unknown bundle'),
            'status' => $job->status ?? 'pending',
            'source_name' => $job->source?->source_name,
            'triggered_by' => $job->author?->name,
            'progress' => in_array($job->status, ['completed', 'failed'], true) ? 100 : 0,
            'started_at' => $job->created_at?->toIso8601String(),
            'completed_at' => $job->evaluated_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $job->fail_message,
            'log_output' => $job->person_count ? number_format($job->person_count).' persons evaluated' : null,
            'created_at' => $job->created_at?->toIso8601String(),
            'details' => [
                'bundle_name' => $job->bundle?->name,
                'person_count' => $job->person_count,
                'compliance_summary' => $job->compliance_summary,
                'cohort_definition' => $job->cohortDefinition?->name,
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function showPoseidonJob(int $id): ?array
    {
        $job = PoseidonRun::with(['source', 'creator'])->find($id);
        if (! $job) {
            return null;
        }

        $stats = is_array($job->stats) ? $job->stats : [];

        return [
            'id' => $job->id,
            'type' => 'poseidon',
            'name' => 'Poseidon ETL — '.($job->source?->source_name ?? 'Unknown source'),
            'status' => $job->status ?? 'pending',
            'source_name' => $job->source?->source_name,
            'triggered_by' => $job->creator?->name,
            'progress' => $job->isRunning() ? 50 : (in_array($job->status, ['success', 'completed', 'failed', 'cancelled'], true) ? 100 : 0),
            'started_at' => $job->started_at?->toIso8601String(),
            'completed_at' => $job->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $job->error_message,
            'log_output' => null,
            'created_at' => $job->created_at?->toIso8601String(),
            'details' => [
                'run_type' => $job->run_type,
                'dagster_run_id' => $job->dagster_run_id,
                'stats' => $stats,
            ],
            'timeline' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    // ─── Job collectors ──────────────────────────────────────────────────

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getAnalysisJobs(int $userId, ?string $statusFilter, ?string $typeFilter = null): Collection
    {
        // Map type filter to specific morph class
        $morphModels = self::ANALYSIS_MODELS;
        if ($typeFilter && $typeFilter !== 'analysis') {
            $modelClass = $this->analysisModelForType($typeFilter);
            if ($modelClass) {
                $morphModels = [$modelClass];
            }
        }

        $query = AnalysisExecution::query()
            ->with(['analysis', 'source'])
            ->whereHasMorph(
                'analysis',
                $morphModels,
                fn (Builder $q) => $q->where('author_id', $userId),
            )
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->where('status', $statusFilter);
        }

        return $query->get()->map(fn (AnalysisExecution $e) => $this->transformAnalysisJob($e));
    }

    /**
     * @return class-string|null
     */
    private function analysisModelForType(string $type): ?string
    {
        return match ($type) {
            'characterization' => Characterization::class,
            'incidence_rate' => IncidenceRateAnalysis::class,
            'pathway' => PathwayAnalysis::class,
            'estimation' => EstimationAnalysis::class,
            'prediction' => PredictionAnalysis::class,
            'sccs' => SccsAnalysis::class,
            'evidence_synthesis' => EvidenceSynthesisAnalysis::class,
            default => null,
        };
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getCohortGenerationJobs(?string $statusFilter): Collection
    {
        $staleEligible = [ExecutionStatus::Queued, ExecutionStatus::Running, ExecutionStatus::Pending];

        $query = CohortGeneration::query()
            ->with(['cohortDefinition', 'source'])
            ->orderByDesc('created_at');

        if ($statusFilter) {
            // When filtering by 'failed', also fetch stale-eligible DB statuses
            // (they may display as 'failed' after stale detection)
            if ($statusFilter === 'failed') {
                $query->where(function ($q) use ($staleEligible) {
                    $q->where('status', ExecutionStatus::Failed)
                        ->orWhereIn('status', $staleEligible);
                });
            } elseif (in_array($statusFilter, ['queued', 'running', 'pending'], true)) {
                // These filters should only return genuinely active jobs, not stale ones
                $query->where('status', $statusFilter);
            } else {
                $query->where('status', $statusFilter);
            }
        }

        return $query->get()->map(function (CohortGeneration $gen) {
            // Mark stale queued/running jobs (>1 hour old) as failed for display
            $isStale = in_array($gen->status, [ExecutionStatus::Queued, ExecutionStatus::Running, ExecutionStatus::Pending], true)
                && $gen->started_at
                && $gen->started_at->diffInMinutes(now()) > 60;

            $displayStatus = $isStale ? ExecutionStatus::Failed : $gen->status;

            $progress = match ($displayStatus) {
                ExecutionStatus::Pending => 0,
                ExecutionStatus::Queued => 2,
                ExecutionStatus::Running => 50,
                ExecutionStatus::Completed => 100,
                ExecutionStatus::Failed, ExecutionStatus::Cancelled => 0,
                default => 0,
            };

            $logOutput = null;
            if ($gen->status === ExecutionStatus::Completed && $gen->person_count !== null) {
                $logOutput = number_format($gen->person_count).' persons generated';
            }

            return [
                'id' => $gen->id,
                'type' => 'cohort_generation',
                'name' => 'Cohort Generation — '.($gen->cohortDefinition?->name ?? 'Unknown'),
                'status' => $displayStatus instanceof ExecutionStatus ? $displayStatus->value : (string) $displayStatus,
                'source_name' => $gen->source?->source_name,
                'triggered_by' => null,
                'progress' => $progress,
                'started_at' => $gen->started_at?->toIso8601String(),
                'completed_at' => $gen->completed_at?->toIso8601String(),
                'duration' => null,
                'error_message' => $isStale ? 'Job stalled — exceeded 1 hour without completing' : $gen->fail_message,
                'log_output' => $logOutput,
                'created_at' => $gen->created_at?->toIso8601String(),
            ];
        })->when($statusFilter, function (Collection $jobs, string $filter) {
            // Post-filter by display status to ensure consistency
            // (stale jobs may have been fetched for 'failed' but genuinely active ones
            // fetched for 'queued'/'running' should not display as 'failed')
            return $jobs->filter(fn (array $job) => $job['status'] === $filter);
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getIngestionJobs(int $userId, ?string $statusFilter): Collection
    {
        $query = IngestionJob::query()
            ->with(['source', 'creator'])
            ->where('created_by', $userId)
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->where('status', $statusFilter);
        }

        return $query->get()->map(function (IngestionJob $job) {
            return [
                'id' => $job->id,
                'type' => 'ingestion',
                'name' => 'Data Ingestion — '.($job->source?->source_name ?? 'Unknown source'),
                'status' => $job->status instanceof ExecutionStatus ? $job->status->value : (string) $job->status,
                'source_name' => $job->source?->source_name,
                'triggered_by' => $job->creator?->name,
                'progress' => $job->progress_percentage ?? 0,
                'started_at' => $job->started_at?->toIso8601String(),
                'completed_at' => $job->completed_at?->toIso8601String(),
                'duration' => null,
                'error_message' => $job->error_message,
                'log_output' => null,
                'created_at' => $job->created_at?->toIso8601String(),
            ];
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getFhirExportJobs(int $userId, ?string $statusFilter): Collection
    {
        $query = FhirExportJob::query()
            ->where('user_id', $userId)
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $dbStatuses = match ($statusFilter) {
                'running' => ['processing'],
                default => [$statusFilter],
            };
            $query->whereIn('status', $dbStatuses);
        }

        return $query->get()->map(function (FhirExportJob $job) {
            $types = is_array($job->resource_types) ? implode(', ', $job->resource_types) : '';
            $normalized = $this->normalizeFhirExportStatus((string) $job->status);

            return [
                'id' => $job->id,
                'type' => 'fhir_export',
                'name' => 'FHIR Export'.($types ? " — {$types}" : ''),
                'status' => $normalized,
                'source_name' => null,
                'triggered_by' => null,
                'progress' => $normalized === 'completed' ? 100 : ($normalized === 'running' ? 50 : 0),
                'started_at' => $job->started_at?->toIso8601String(),
                'completed_at' => $job->finished_at?->toIso8601String(),
                'duration' => null,
                'error_message' => $job->error_message,
                'log_output' => null,
                'created_at' => $job->created_at?->toIso8601String(),
            ];
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getGisImportJobs(int $userId, ?string $statusFilter): Collection
    {
        $query = GisImport::query()
            ->where('user_id', $userId)
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->whereIn('status', $this->mapGisStatusToFilter($statusFilter));
        }

        return $query->get()->map(function (GisImport $job) {
            return [
                'id' => $job->id,
                'type' => 'gis_import',
                'name' => 'GIS Import — '.($job->filename ?? 'Unknown file'),
                'status' => $this->normalizeGisStatus((string) $job->status),
                'source_name' => null,
                'triggered_by' => $job->user?->name,
                'progress' => $job->progress_percentage ?? 0,
                'started_at' => $job->started_at?->toIso8601String(),
                'completed_at' => $job->completed_at?->toIso8601String(),
                'duration' => null,
                'error_message' => is_array($job->error_log) ? implode("\n", $job->error_log) : null,
                'log_output' => $job->log_output,
                'created_at' => $job->created_at?->toIso8601String(),
            ];
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getGenomicParseJobs(int $userId, ?string $statusFilter): Collection
    {
        $query = GenomicUpload::query()
            ->with(['source', 'creator'])
            ->where('created_by', $userId)
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->whereIn('status', $this->mapGenomicStatusToFilter($statusFilter));
        }

        return $query->get()->map(function (GenomicUpload $upload) {
            $sizeMb = $upload->file_size_bytes ? round($upload->file_size_bytes / 1024 / 1024, 1) : null;
            $variants = $upload->total_variants ?? 0;
            $detail = $sizeMb ? "{$sizeMb} MB" : '';
            if ($variants > 0) {
                $detail .= ($detail ? ' · ' : '').number_format($variants).' variants';
            }

            return [
                'id' => $upload->id,
                'type' => 'genomic_parse',
                'name' => 'Genomic Parse — '.($upload->filename ?? 'Unknown file'),
                'status' => $this->normalizeGenomicStatus($upload->status),
                'source_name' => $upload->source?->source_name,
                'triggered_by' => $upload->creator?->name,
                'progress' => $this->genomicProgress($upload->status, $upload->total_variants, $upload->file_size_bytes),
                'started_at' => $upload->created_at?->toIso8601String(),
                'completed_at' => $upload->parsed_at?->toIso8601String(),
                'duration' => null,
                'error_message' => $upload->error_message,
                'log_output' => $detail ?: null,
                'created_at' => $upload->created_at?->toIso8601String(),
            ];
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getVocabularyImportJobs(int $userId, ?string $statusFilter): Collection
    {
        $query = VocabularyImport::query()
            ->with(['source'])
            ->where('user_id', $userId)
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->where('status', $statusFilter);
        }

        return $query->get()->map(function (VocabularyImport $job) {
            return [
                'id' => $job->id,
                'type' => 'vocabulary_load',
                'name' => 'Vocabulary Import — '.($job->file_name ?? 'Unknown file'),
                'status' => (string) $job->status,
                'source_name' => $job->source?->source_name,
                'triggered_by' => $job->user?->name,
                'progress' => $job->progress_percentage ?? 0,
                'started_at' => $job->started_at?->toIso8601String(),
                'completed_at' => $job->completed_at?->toIso8601String(),
                'duration' => null,
                'error_message' => $job->error_message,
                'log_output' => $job->log_output,
                'created_at' => $job->created_at?->toIso8601String(),
            ];
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getDqdJobs(?string $statusFilter): Collection
    {
        $registry = app(DqdCheckRegistry::class);
        $totalAllChecks = $registry->count();

        $runs = DB::table('app.dqd_results')
            ->selectRaw("run_id, source_id, COUNT(*) as total_checks, SUM(CASE WHEN passed = true THEN 1 ELSE 0 END)::int as passed_count, MIN(created_at) as started_at, MAX(created_at) as completed_at, SUM(execution_time_ms) as total_ms, array_to_string(array_agg(DISTINCT category), ',') as categories")
            ->groupBy('run_id', 'source_id')
            ->orderByDesc('started_at')
            ->get();

        // Pre-compute expected checks per category for accurate completion detection
        $categoryCountCache = [];

        $sourceIds = $runs->pluck('source_id')->unique()->filter();
        $sources = Source::whereIn('id', $sourceIds)->get()->keyBy('id');

        return $runs->map(function ($run) use ($totalAllChecks, $sources, $registry, &$categoryCountCache) {
            $source = $sources->get($run->source_id);
            $completed = (int) $run->total_checks;
            $passed = (int) $run->passed_count;
            $failed = $completed - $passed;

            // Determine if the run is still active (checks being inserted recently)
            $lastCheckAge = $run->completed_at
                ? abs(now()->diffInSeconds(Carbon::parse($run->completed_at)))
                : PHP_INT_MAX;
            $stillActive = $lastCheckAge < 300;

            // Determine expected checks: for completed runs, use actual categories
            // to detect category-specific runs; for active runs, assume full run
            $runCategories = array_filter(explode(',', $run->categories ?? ''));
            $numDistinctCategories = count($runCategories);

            if (! $stillActive && $numDistinctCategories > 0 && $numDistinctCategories < 3) {
                // Completed category-specific run — sum expected for those categories
                $expectedForRun = 0;
                foreach ($runCategories as $cat) {
                    if (! isset($categoryCountCache[$cat])) {
                        $categoryCountCache[$cat] = count($registry->byCategory($cat));
                    }
                    $expectedForRun += $categoryCountCache[$cat];
                }
            } else {
                $expectedForRun = $totalAllChecks;
            }

            $isRunning = $completed < $expectedForRun && $stillActive;
            $pct = $expectedForRun > 0 ? round(($completed / $expectedForRun) * 100) : 100;

            $status = $isRunning ? 'running' : 'completed';

            return [
                'id' => crc32($run->run_id),
                'type' => 'dqd',
                'name' => 'Data Quality — '.($source?->source_name ?? 'Unknown source'),
                'status' => $status,
                'source_name' => $source?->source_name,
                'triggered_by' => null,
                'progress' => $isRunning ? $pct : 100,
                'started_at' => $run->started_at,
                'completed_at' => $isRunning ? null : $run->completed_at,
                'duration' => null,
                'error_message' => $failed > 0 ? "{$failed} of {$completed} checks failed" : null,
                'log_output' => $isRunning
                    ? "{$completed}/{$expectedForRun} checks ({$pct}%)"
                    : "{$completed} checks: {$passed} passed, {$failed} failed",
                'created_at' => $run->started_at,
            ];
        })->when($statusFilter, function (Collection $jobs, string $filter) {
            return $jobs->filter(fn (array $job) => $job['status'] === $filter);
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getHeelJobs(?string $statusFilter): Collection
    {
        return AchillesHeelRun::query()
            ->with('source')
            ->orderByDesc('created_at')
            ->get()
            ->map(function (AchillesHeelRun $run) {
                $totalRules = max((int) $run->total_rules, 1);
                $isRunning = $run->status === 'running';
                $progress = $isRunning
                    ? min((int) round((($run->completed_rules + $run->failed_rules) / $totalRules) * 100), 99)
                    : 100;

                return [
                    'id' => $run->id,
                    'type' => 'heel',
                    'name' => 'Heel Checks — '.($run->source?->source_name ?? 'Unknown source'),
                    'status' => $run->status,
                    'source_name' => $run->source?->source_name,
                    'triggered_by' => null,
                    'progress' => $progress,
                    'started_at' => $run->started_at?->toIso8601String(),
                    'completed_at' => $run->completed_at?->toIso8601String(),
                    'duration' => null,
                    'error_message' => $run->error_message,
                    'log_output' => $isRunning
                        ? "Running {$totalRules} heel rules..."
                        : "{$run->completed_rules}/{$totalRules} rules completed",
                    'created_at' => $run->created_at?->toIso8601String(),
                ];
            });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getAchillesJobs(?string $statusFilter): Collection
    {
        $query = AchillesRun::query()
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->where('status', $statusFilter);
        }

        $achillesRuns = $query->get();
        $sourceIds = $achillesRuns->pluck('source_id')->unique()->filter();
        $sources = Source::whereIn('id', $sourceIds)->get()->keyBy('id');

        return $achillesRuns->map(function (AchillesRun $run) use ($sources) {
            $source = $sources->get($run->source_id);
            $total = $run->total_analyses ?: 1;
            $completed = $run->completed_analyses;
            $failed = $run->failed_analyses;
            $isRunning = $run->status === 'running';
            $pct = $isRunning ? min((int) round(($completed / $total) * 100), 99) : 100;

            $logOutput = $isRunning
                ? "{$completed}/{$total} analyses ({$pct}%)"
                : "{$completed} analyses completed".($failed > 0 ? ", {$failed} failed" : '');

            return [
                'id' => $run->id,
                'type' => 'achilles',
                'name' => 'Achilles — '.($source?->source_name ?? 'Unknown source'),
                'status' => $run->status,
                'source_name' => $source?->source_name,
                'triggered_by' => null,
                'progress' => $isRunning ? $pct : ($run->status === 'completed' ? 100 : 0),
                'started_at' => $run->started_at?->toIso8601String(),
                'completed_at' => $run->completed_at?->toIso8601String(),
                'duration' => null,
                'error_message' => $failed > 0 ? "{$failed} of {$total} analyses failed" : null,
                'log_output' => $logOutput,
                'created_at' => $run->created_at?->toIso8601String(),
            ];
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getFhirSyncJobs(?string $statusFilter): Collection
    {
        $query = FhirSyncRun::query()
            ->with(['connection', 'triggeredBy'])
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->where('status', $this->normalizeFhirSyncStatusReverse($statusFilter));
        }

        return $query->get()->map(function (FhirSyncRun $run) {
            $types = is_array($run->resource_types) ? implode(', ', $run->resource_types) : '';
            $isRunning = in_array($run->status, ['exporting', 'downloading', 'processing'], true);
            $records = ($run->records_written ?? 0) + ($run->records_failed ?? 0);

            return [
                'id' => $run->id,
                'type' => 'fhir_sync',
                'name' => 'FHIR Sync'.($types ? " — {$types}" : ''),
                'status' => $this->normalizeFhirSyncStatus($run->status),
                'source_name' => $run->connection?->name,
                'triggered_by' => $run->triggeredBy?->name,
                'progress' => $isRunning ? 50 : ($run->status === 'completed' ? 100 : 0),
                'started_at' => $run->started_at?->toIso8601String(),
                'completed_at' => $run->finished_at?->toIso8601String(),
                'duration' => null,
                'error_message' => $run->error_message,
                'log_output' => $records > 0
                    ? "{$run->records_written} written, {$run->records_failed} failed"
                    : null,
                'created_at' => $run->created_at?->toIso8601String(),
            ];
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getCareGapJobs(int $userId, ?string $statusFilter): Collection
    {
        $query = CareGapEvaluation::query()
            ->with(['bundle', 'source', 'author'])
            ->where('author_id', $userId)
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->where('status', $statusFilter);
        }

        return $query->get()->map(function (CareGapEvaluation $eval) {
            $bundleName = $eval->bundle?->name ?? 'Unknown bundle';
            $isDone = in_array($eval->status, ['completed', 'failed'], true);

            return [
                'id' => $eval->id,
                'type' => 'care_gap',
                'name' => "Care Gap — {$bundleName}",
                'status' => $eval->status ?? 'pending',
                'source_name' => $eval->source?->source_name,
                'triggered_by' => $eval->author?->name,
                'progress' => $isDone ? 100 : ($eval->status === 'running' ? 50 : 0),
                'started_at' => $eval->created_at?->toIso8601String(),
                'completed_at' => $eval->evaluated_at?->toIso8601String(),
                'duration' => null,
                'error_message' => $eval->fail_message,
                'log_output' => $eval->person_count
                    ? number_format($eval->person_count).' persons evaluated'
                    : null,
                'created_at' => $eval->created_at?->toIso8601String(),
            ];
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getGisBoundaryJobs(int $userId, ?string $statusFilter): Collection
    {
        $query = GisDataset::query()
            ->where('user_id', $userId)
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->where('status', $statusFilter);
        }

        return $query->get()->map(function (GisDataset $ds) {
            $normalizedStatus = $this->normalizeGisBoundaryStatus($ds->status);
            $isRunning = $normalizedStatus === 'running';

            return [
                'id' => $ds->id,
                'type' => 'gis_boundary',
                'name' => 'GIS Boundaries — '.($ds->name ?? 'Unknown dataset'),
                'status' => $normalizedStatus,
                'source_name' => null,
                'triggered_by' => $ds->user?->name,
                'progress' => $ds->progress_percentage ?? ($isRunning ? 50 : (in_array($normalizedStatus, ['completed', 'failed'], true) ? 100 : 0)),
                'started_at' => $ds->started_at?->toIso8601String(),
                'completed_at' => $ds->completed_at?->toIso8601String(),
                'duration' => null,
                'error_message' => $ds->error_message,
                'log_output' => $ds->feature_count
                    ? number_format($ds->feature_count).' features loaded'
                    : null,
                'created_at' => $ds->created_at?->toIso8601String(),
            ];
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getPoseidonJobs(?string $statusFilter): Collection
    {
        $query = PoseidonRun::query()
            ->with(['source', 'creator'])
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->where('status', $statusFilter);
        }

        return $query->get()->map(function (PoseidonRun $run) {
            $isRunning = $run->isRunning();
            /** @var array<string, mixed> $stats */
            $stats = is_array($run->stats) ? $run->stats : [];
            $logParts = [];
            if (isset($stats['rows_loaded']) && $stats['rows_loaded']) {
                $logParts[] = number_format((int) $stats['rows_loaded']).' rows loaded';
            }
            if ($run->run_type) {
                $logParts[] = $run->run_type;
            }

            return [
                'id' => $run->id,
                'type' => 'poseidon',
                'name' => 'Poseidon ETL — '.($run->source?->source_name ?? 'Unknown source'),
                'status' => $run->status ?? 'pending',
                'source_name' => $run->source?->source_name,
                'triggered_by' => $run->creator?->name,
                'progress' => $isRunning ? 50 : (in_array($run->status, ['success', 'completed', 'failed', 'cancelled'], true) ? 100 : 0),
                'started_at' => $run->started_at?->toIso8601String(),
                'completed_at' => $run->completed_at?->toIso8601String(),
                'duration' => null,
                'error_message' => $run->error_message,
                'log_output' => implode(' · ', $logParts) ?: null,
                'created_at' => $run->created_at?->toIso8601String(),
            ];
        });
    }

    // ─── Analysis job helpers ────────────────────────────────────────────

    private function assertOwnership(AnalysisExecution $job, int $userId): void
    {
        $authorId = $job->analysis?->author_id;
        abort_unless($authorId === $userId, 404);
    }

    /**
     * @param  callable(): Collection<int, array<string, mixed>>  $collector
     * @return Collection<int, array<string, mixed>>
     */
    private function safeCollectJobs(callable $collector): Collection
    {
        try {
            return DB::transaction(fn () => $collector());
        } catch (QueryException) {
            return collect();
        }
    }

    private function assertIngestionOwnership(IngestionJob $job, int $userId): void
    {
        abort_unless($job->created_by === $userId, 404);
    }

    public function retryAnalysisJob(int $jobId, int $userId): JsonResponse
    {
        $job = AnalysisExecution::with(['analysis', 'source'])->findOrFail($jobId);
        $this->assertOwnership($job, $userId);

        if (! in_array($job->status, [ExecutionStatus::Failed, ExecutionStatus::Cancelled], true)) {
            return response()->json([
                'message' => 'Only failed or cancelled jobs can be retried.',
            ], 422);
        }

        $analysis = $job->analysis;
        if (! $analysis) {
            return response()->json([
                'message' => 'Analysis definition could not be loaded for retry.',
            ], 422);
        }

        $newExecution = AnalysisExecution::create([
            'analysis_type' => $job->analysis_type,
            'analysis_id' => $job->analysis_id,
            'source_id' => $job->source_id,
            'status' => ExecutionStatus::Queued,
            'started_at' => now(),
        ]);

        match ($job->analysis_type) {
            Characterization::class => RunCharacterizationJob::dispatch($analysis, $job->source, $newExecution),
            IncidenceRateAnalysis::class => RunIncidenceRateJob::dispatch($analysis, $job->source, $newExecution),
            PathwayAnalysis::class => RunPathwayJob::dispatch($analysis, $job->source, $newExecution),
            EstimationAnalysis::class => RunEstimationJob::dispatch($analysis, $job->source, $newExecution),
            PredictionAnalysis::class => RunPredictionJob::dispatch($analysis, $job->source, $newExecution),
            SccsAnalysis::class => RunSccsJob::dispatch($analysis, $job->source, $newExecution),
            EvidenceSynthesisAnalysis::class => RunEvidenceSynthesisJob::dispatch($analysis, $newExecution),
            default => throw new \RuntimeException('Retry not supported for this analysis type.'),
        };

        $newExecution->load(['analysis', 'source']);

        return response()->json($this->normalizeJobPayload($this->transformAnalysisJob($newExecution)));
    }

    public function cancelAnalysisJob(int $jobId, int $userId): JsonResponse
    {
        $job = AnalysisExecution::with(['analysis', 'source'])->findOrFail($jobId);
        $this->assertOwnership($job, $userId);

        if (! in_array($job->status, [ExecutionStatus::Pending, ExecutionStatus::Queued, ExecutionStatus::Running], true)) {
            return response()->json([
                'message' => 'Only pending, queued, or running jobs can be cancelled.',
            ], 422);
        }

        $job->update([
            'status' => ExecutionStatus::Cancelled,
            'completed_at' => now(),
            'fail_message' => $job->fail_message ?: 'Cancelled by user.',
        ]);

        return response()->json($this->normalizeJobPayload($this->transformAnalysisJob($job->fresh(['analysis', 'source']))));
    }

    public function retryIngestionJob(int $jobId, int $userId): JsonResponse
    {
        $job = IngestionJob::with(['source', 'creator'])->findOrFail($jobId);
        $this->assertIngestionOwnership($job, $userId);

        if (! in_array($job->status, [ExecutionStatus::Failed, ExecutionStatus::Cancelled], true)) {
            return response()->json([
                'message' => 'Only failed or cancelled ingestion jobs can be retried.',
            ], 422);
        }

        $job->update([
            'status' => ExecutionStatus::Pending,
            'error_message' => null,
            'completed_at' => null,
            'progress_percentage' => 0,
        ]);

        $step = $job->current_step ?? IngestionStep::Profiling;
        if ($step === IngestionStep::Profiling) {
            ProfileSourceJob::dispatch($job);
        }

        return response()->json($this->normalizeJobPayload([
            'id' => $job->id,
            'type' => 'ingestion',
            'name' => 'Data Ingestion — '.($job->source?->source_name ?? 'Unknown source'),
            'status' => $job->status->value,
            'source_name' => $job->source?->source_name,
            'triggered_by' => $job->creator?->name,
            'progress' => $job->progress_percentage ?? 0,
            'started_at' => $job->started_at?->toIso8601String(),
            'completed_at' => $job->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $job->error_message,
            'log_output' => null,
            'created_at' => $job->created_at?->toIso8601String(),
        ]));
    }

    /**
     * @param  array<string, mixed>  $job
     * @return array<string, mixed>
     */
    private function normalizeJobPayload(array $job): array
    {
        $type = (string) ($job['type'] ?? 'analysis');
        $job['status'] = $this->normalizeJobStatus($type, isset($job['status']) ? (string) $job['status'] : null);
        $job['actions'] = [
            'retry' => $this->canRetryJob($type, (string) $job['status']),
            'cancel' => $this->canCancelJob($type, (string) $job['status']),
        ];

        return $job;
    }

    /**
     * @return array<string, mixed>
     */
    private function transformAnalysisJob(AnalysisExecution $execution, bool $includeLogs = false): array
    {
        $execution->loadMissing(['analysis', 'source']);
        if ($execution->analysis) {
            $execution->analysis->loadMissing('author');
        }

        $analysis = $execution->analysis;
        $logOutput = null;

        if ($includeLogs) {
            $logs = $execution->logs->map(
                fn ($log) => sprintf(
                    '[%s] %s: %s',
                    $log->created_at?->toDateTimeString() ?? 'unknown',
                    strtoupper((string) $log->level),
                    (string) $log->message,
                )
            );
            $logOutput = $logs->implode("\n");
        }

        return [
            'id' => $execution->id,
            'type' => $this->jobType($execution->analysis_type),
            'name' => $analysis?->name ?? 'Untitled job',
            'status' => $execution->status->value,
            'source_name' => $execution->source?->source_name,
            'triggered_by' => $analysis?->author?->name,
            'progress' => $this->analysisProgress($execution),
            'started_at' => $execution->started_at?->toIso8601String(),
            'completed_at' => $execution->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $execution->fail_message,
            'log_output' => $logOutput,
            'created_at' => $execution->created_at?->toIso8601String(),
        ];
    }

    /**
     * Derive progress from execution status and log step keywords.
     */
    private function analysisProgress(AnalysisExecution $execution): int
    {
        if ($execution->status !== ExecutionStatus::Running) {
            return match ($execution->status) {
                ExecutionStatus::Pending => 0,
                ExecutionStatus::Queued => 2,
                ExecutionStatus::Completed => 100,
                ExecutionStatus::Failed, ExecutionStatus::Cancelled => 0,
                default => 0,
            };
        }

        // For running jobs, derive progress from the last log message
        $lastLog = ExecutionLog::where('execution_id', $execution->id)
            ->orderByDesc('id')
            ->value('message');

        if (! $lastLog) {
            return 5;
        }

        $msg = strtolower($lastLog);

        // Estimation pipeline steps (ordered by typical occurrence)
        if (str_contains($msg, 'connecting')) {
            return 10;
        }
        if (str_contains($msg, 'covariate')) {
            return 15;
        }
        if (str_contains($msg, 'extracting')) {
            return 20;
        }
        if (str_contains($msg, 'extraction complete')) {
            return 35;
        }
        if (str_contains($msg, 'propensity score')) {
            return 40;
        }
        if (str_contains($msg, 'balance')) {
            return 60;
        }
        if (str_contains($msg, 'outcome model') || str_contains($msg, 'fitting')) {
            return 70;
        }
        if (str_contains($msg, 'processing outcome')) {
            return 55;
        }

        // Characterization steps
        if (str_contains($msg, 'computing feature')) {
            return 50;
        }

        // Generic steps
        if (str_contains($msg, 'started')) {
            return 5;
        }
        if (str_contains($msg, 'calling r')) {
            return 10;
        }

        return 25; // unknown step — at least show some progress
    }

    private function progressForStatus(ExecutionStatus $status): int
    {
        return match ($status) {
            ExecutionStatus::Pending => 0,
            ExecutionStatus::Queued => 2,
            ExecutionStatus::Running => 50,
            ExecutionStatus::Completed => 100,
            ExecutionStatus::Failed, ExecutionStatus::Cancelled => 0,
        };
    }

    private function jobType(string $analysisType): string
    {
        return match ($analysisType) {
            Characterization::class => 'characterization',
            IncidenceRateAnalysis::class => 'incidence_rate',
            PathwayAnalysis::class => 'pathway',
            EstimationAnalysis::class => 'estimation',
            PredictionAnalysis::class => 'prediction',
            SccsAnalysis::class => 'sccs',
            EvidenceSynthesisAnalysis::class => 'evidence_synthesis',
            default => 'analysis',
        };
    }

    // ─── Status normalization helpers ────────────────────────────────────

    private function normalizeJobStatus(string $type, ?string $status): string
    {
        return match ($type) {
            'gis_import' => $this->normalizeGisStatus((string) $status),
            'genomic_parse' => $this->normalizeGenomicStatus($status),
            'fhir_export' => $this->normalizeFhirExportStatus((string) $status),
            'fhir_sync' => $this->normalizeFhirSyncStatus($status),
            'gis_boundary' => $this->normalizeGisBoundaryStatus($status),
            'poseidon' => $this->normalizePoseidonStatus($status),
            default => $status ?? 'pending',
        };
    }

    private function normalizePoseidonStatus(?string $status): string
    {
        return match ($status) {
            'success' => 'completed',
            null => 'pending',
            default => $status,
        };
    }

    private function canRetryJob(string $type, string $status): bool
    {
        return match ($type) {
            'characterization', 'incidence_rate', 'pathway', 'estimation',
            'prediction', 'sccs', 'evidence_synthesis', 'analysis', 'ingestion' => in_array($status, ['failed', 'cancelled'], true),
            default => false,
        };
    }

    private function canCancelJob(string $type, string $status): bool
    {
        return match ($type) {
            'characterization', 'incidence_rate', 'pathway', 'estimation',
            'prediction', 'sccs', 'evidence_synthesis', 'analysis' => in_array($status, ['pending', 'queued', 'running'], true),
            default => false,
        };
    }

    private function normalizeGisStatus(string $status): string
    {
        return match ($status) {
            'importing', 'processing' => 'running',
            'completed', 'imported' => 'completed',
            'failed', 'error' => 'failed',
            'pending', 'queued' => 'pending',
            default => $status,
        };
    }

    /**
     * @return list<string>|null
     */
    private function mapGisStatusToFilter(string $filter): array
    {
        return match ($filter) {
            'running' => ['importing', 'processing'],
            'completed' => ['completed', 'imported'],
            'failed' => ['failed', 'error'],
            'pending' => ['pending'],
            'queued' => ['queued'],
            default => ['__none__'],
        };
    }

    private function normalizeGenomicStatus(?string $status): string
    {
        return match ($status) {
            'parsing' => 'running',
            'mapped', 'review', 'imported' => 'completed',
            'failed' => 'failed',
            'pending' => 'pending',
            default => $status ?? 'pending',
        };
    }

    private function genomicProgress(?string $status, int $variantsParsed = 0, ?int $fileSize = null): int
    {
        if ($status === 'parsing' && $fileSize && $fileSize > 0) {
            // Estimate progress: ~550 bytes per variant line in a VCF
            $estimatedTotal = max((int) ($fileSize / 550), 1);
            $pct = min((int) (($variantsParsed / $estimatedTotal) * 100), 99);

            return max($pct, 1); // at least 1% once parsing starts
        }

        return match ($status) {
            'pending' => 0,
            'parsing' => 1,
            'mapped', 'review', 'imported' => 100,
            'failed' => 0,
            default => 0,
        };
    }

    /**
     * @return list<string>
     */
    private function mapGenomicStatusToFilter(string $filter): array
    {
        return match ($filter) {
            'running' => ['parsing'],
            'completed' => ['mapped', 'review', 'imported'],
            'failed' => ['failed'],
            'pending' => ['pending'],
            'queued' => ['__none__'], // genomic uploads don't have a queued state — return no results
            'cancelled' => ['__none__'],
            default => ['__none__'], // unknown filter should match nothing, not everything
        };
    }

    private function normalizeFhirExportStatus(string $status): string
    {
        return match ($status) {
            'processing' => 'running',
            'completed' => 'completed',
            'failed' => 'failed',
            'pending' => 'pending',
            default => $status,
        };
    }

    private function normalizeFhirSyncStatus(?string $status): string
    {
        return match ($status) {
            'exporting', 'downloading', 'processing' => 'running',
            'completed' => 'completed',
            'failed' => 'failed',
            'pending' => 'pending',
            default => $status ?? 'pending',
        };
    }

    private function normalizeFhirSyncStatusReverse(string $filter): string
    {
        return match ($filter) {
            'running' => 'processing',
            default => $filter,
        };
    }

    private function normalizeGisBoundaryStatus(?string $status): string
    {
        return match ($status) {
            'loading', 'importing' => 'running',
            'loaded', 'completed' => 'completed',
            'failed', 'error' => 'failed',
            'pending' => 'pending',
            default => $status ?? 'pending',
        };
    }
}
