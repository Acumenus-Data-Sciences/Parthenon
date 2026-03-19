<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunCharacterizationJob;
use App\Jobs\Analysis\RunEstimationJob;
use App\Jobs\Analysis\RunEvidenceSynthesisJob;
use App\Jobs\Analysis\RunIncidenceRateJob;
use App\Jobs\Analysis\RunPathwayJob;
use App\Jobs\Analysis\RunPredictionJob;
use App\Jobs\Analysis\RunSccsJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\Characterization;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\FhirExportJob;
use App\Models\App\GenomicUpload;
use App\Models\App\GisImport;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\IngestionJob;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\App\DqdResult;
use App\Models\App\VocabularyImport;
use App\Models\Results\AchillesHeelResult;
use App\Services\Achilles\Heel\AchillesHeelRuleRegistry;
use App\Services\Dqd\DqdCheckRegistry;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

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
        $perPage = $request->integer('per_page', 50);

        $allJobs = collect();

        // 1. Analysis executions (existing)
        if (! $typeFilter || in_array($typeFilter, ['characterization', 'incidence_rate', 'pathway', 'estimation', 'prediction', 'sccs', 'evidence_synthesis', 'analysis', 'cohort_generation'], true)) {
            $allJobs = $allJobs->merge($this->getAnalysisJobs($userId, $statusFilter));
        }

        // 2. Ingestion jobs
        if (! $typeFilter || $typeFilter === 'ingestion') {
            $allJobs = $allJobs->merge($this->getIngestionJobs($userId, $statusFilter));
        }

        // 3. FHIR export jobs
        if (! $typeFilter || $typeFilter === 'fhir_export') {
            $allJobs = $allJobs->merge($this->getFhirExportJobs($userId, $statusFilter));
        }

        // 4. GIS import jobs
        if (! $typeFilter || $typeFilter === 'gis_import') {
            $allJobs = $allJobs->merge($this->getGisImportJobs($userId, $statusFilter));
        }

        // 5. Genomic upload/parse jobs
        if (! $typeFilter || $typeFilter === 'genomic_parse') {
            $allJobs = $allJobs->merge($this->getGenomicParseJobs($userId, $statusFilter));
        }

        // 6. Vocabulary import jobs
        if (! $typeFilter || $typeFilter === 'vocabulary_load') {
            $allJobs = $allJobs->merge($this->getVocabularyImportJobs($userId, $statusFilter));
        }

        // 7. DQD runs (system-level, not user-scoped)
        if (! $typeFilter || $typeFilter === 'dqd') {
            $allJobs = $allJobs->merge($this->getDqdJobs($statusFilter));
        }

        // 8. Heel runs (system-level, not user-scoped)
        if (! $typeFilter || $typeFilter === 'heel') {
            $allJobs = $allJobs->merge($this->getHeelJobs($statusFilter));
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
        $paged = $sorted->slice(($page - 1) * $perPage, $perPage)->values();

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

    public function show(Request $request, AnalysisExecution $job): JsonResponse
    {
        $job->load(['analysis', 'source', 'logs']);
        $this->assertOwnership($job, $request->user()->id);

        return response()->json($this->transformAnalysisJob($job, true));
    }

    public function retry(Request $request, AnalysisExecution $job): JsonResponse
    {
        $job->load(['analysis', 'source']);
        $this->assertOwnership($job, $request->user()->id);

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
            default => throw new \RuntimeException('Retry not supported for this job type.'),
        };

        $newExecution->load(['analysis', 'source']);

        return response()->json($this->transformAnalysisJob($newExecution));
    }

    public function cancel(Request $request, AnalysisExecution $job): JsonResponse
    {
        $job->load(['analysis', 'source']);
        $this->assertOwnership($job, $request->user()->id);

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

        return response()->json($this->transformAnalysisJob($job->fresh(['analysis', 'source'])));
    }

    // ─── Job collectors ──────────────────────────────────────────────────

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getAnalysisJobs(int $userId, ?string $statusFilter): Collection
    {
        $query = AnalysisExecution::query()
            ->with(['analysis', 'source'])
            ->whereHasMorph(
                'analysis',
                self::ANALYSIS_MODELS,
                fn (Builder $q) => $q->where('author_id', $userId),
            )
            ->orderByDesc('created_at');

        if ($statusFilter) {
            $query->where('status', $statusFilter);
        }

        return $query->limit(100)->get()->map(fn (AnalysisExecution $e) => $this->transformAnalysisJob($e));
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

        return $query->limit(50)->get()->map(function (IngestionJob $job) {
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
            $query->where('status', $statusFilter);
        }

        return $query->limit(50)->get()->map(function (FhirExportJob $job) {
            $types = is_array($job->resource_types) ? implode(', ', $job->resource_types) : '';

            return [
                'id' => $job->id,
                'type' => 'fhir_export',
                'name' => 'FHIR Export'.($types ? " — {$types}" : ''),
                'status' => (string) $job->status,
                'source_name' => null,
                'triggered_by' => null,
                'progress' => $job->status === 'completed' ? 100 : ($job->status === 'processing' ? 50 : 0),
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

        return $query->limit(50)->get()->map(function (GisImport $job) {
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

        return $query->limit(50)->get()->map(function (GenomicUpload $upload) {
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

        return $query->limit(50)->get()->map(function (VocabularyImport $job) {
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
        $totalExpected = app(DqdCheckRegistry::class)->count();

        $runs = \Illuminate\Support\Facades\DB::table('app.dqd_results')
            ->selectRaw("run_id, source_id, COUNT(*) as total_checks, SUM(CASE WHEN passed = true THEN 1 ELSE 0 END)::int as passed_count, MIN(created_at) as started_at, MAX(created_at) as completed_at, SUM(execution_time_ms) as total_ms")
            ->groupBy('run_id', 'source_id')
            ->orderByDesc('started_at')
            ->limit(50)
            ->get();

        return $runs->map(function ($run) use ($totalExpected) {
            $source = \App\Models\App\Source::find($run->source_id);
            $completed = (int) $run->total_checks;
            $passed = (int) $run->passed_count;
            $failed = $completed - $passed;
            $isRunning = $completed < $totalExpected;
            $pct = $totalExpected > 0 ? round(($completed / $totalExpected) * 100) : 100;

            return [
                'id' => crc32($run->run_id),
                'type' => 'dqd',
                'name' => 'Data Quality — '.($source?->source_name ?? 'Unknown source'),
                'status' => $isRunning ? 'running' : 'completed',
                'source_name' => $source?->source_name,
                'triggered_by' => null,
                'progress' => $isRunning ? $pct : 100,
                'started_at' => $run->started_at,
                'completed_at' => $isRunning ? null : $run->completed_at,
                'duration' => null,
                'error_message' => $failed > 0 ? "{$failed} of {$completed} checks failed" : null,
                'log_output' => $isRunning
                    ? "{$completed}/{$totalExpected} checks ({$pct}%)"
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
        $totalRules = app(AchillesHeelRuleRegistry::class)->count();

        $runs = \Illuminate\Support\Facades\DB::table('achilles_heel_results')
            ->whereNotNull('run_id')
            ->selectRaw("run_id, source_id, COUNT(*) as total_results, COUNT(DISTINCT rule_id) as rules_completed, MIN(created_at) as started_at, MAX(created_at) as completed_at")
            ->groupBy('run_id', 'source_id')
            ->orderByDesc('started_at')
            ->limit(20)
            ->get();

        return $runs->map(function ($run) use ($totalRules) {
            $source = \App\Models\App\Source::find($run->source_id);
            $rulesCompleted = (int) $run->rules_completed;
            $isRunning = $rulesCompleted < $totalRules;
            $pct = $totalRules > 0 ? round(($rulesCompleted / $totalRules) * 100) : 100;

            return [
                'id' => crc32($run->run_id),
                'type' => 'heel',
                'name' => 'Heel Checks — '.($source?->source_name ?? 'Unknown source'),
                'status' => $isRunning ? 'running' : 'completed',
                'source_name' => $source?->source_name,
                'triggered_by' => null,
                'progress' => $isRunning ? $pct : 100,
                'started_at' => $run->started_at,
                'completed_at' => $isRunning ? null : $run->completed_at,
                'duration' => null,
                'error_message' => null,
                'log_output' => $isRunning
                    ? "{$rulesCompleted}/{$totalRules} rules ({$pct}%)"
                    : "{$rulesCompleted} rules, {$run->total_results} issues found",
                'created_at' => $run->started_at,
            ];
        })->when($statusFilter, function (Collection $jobs, string $filter) {
            return $jobs->filter(fn (array $job) => $job['status'] === $filter);
        });
    }

    // ─── Analysis job helpers ────────────────────────────────────────────

    private function assertOwnership(AnalysisExecution $job, int $userId): void
    {
        $authorId = $job->analysis?->author_id;
        abort_unless($authorId === $userId, 404);
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
            'progress' => $this->progressForStatus($execution->status),
            'started_at' => $execution->started_at?->toIso8601String(),
            'completed_at' => $execution->completed_at?->toIso8601String(),
            'duration' => null,
            'error_message' => $execution->fail_message,
            'log_output' => $logOutput,
            'created_at' => $execution->created_at?->toIso8601String(),
        ];
    }

    private function progressForStatus(ExecutionStatus $status): int
    {
        return match ($status) {
            ExecutionStatus::Pending => 0,
            ExecutionStatus::Queued => 5,
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
     * @return list<string>|null
     */
    private function mapGenomicStatusToFilter(string $filter): ?array
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
}
