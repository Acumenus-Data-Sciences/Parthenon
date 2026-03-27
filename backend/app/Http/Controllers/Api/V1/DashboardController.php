<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Models\App\AnalysisExecution;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\DqdResult;
use App\Models\App\FhirExportJob;
use App\Models\App\GenomicUpload;
use App\Models\App\GisImport;
use App\Models\App\IngestionJob;
use App\Models\App\Source;
use App\Models\App\VocabularyImport;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Dashboard
 */
class DashboardController extends Controller
{
    /**
     * Unified dashboard statistics — single endpoint replaces 3+N frontend calls.
     */
    public function stats(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $userId = $user->id;

        // All queries run against the app DB — fast
        $sources = Source::visibleToUser($user)->get();
        $cohortCount = CohortDefinition::count();
        $conceptSetCount = ConceptSet::count();

        $recentCohorts = CohortDefinition::orderByDesc('updated_at')
            ->limit(5)
            ->get(['id', 'name', 'tags', 'updated_at'])
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'tags' => $c->tags,
                'updated_at' => $c->updated_at,
            ]);

        // Aggregate DQD failures: get latest run per source, count failures
        $dqdFailures = 0;
        foreach ($sources as $source) {
            $latestRunId = DqdResult::where('source_id', $source->id)
                ->orderByDesc('created_at')
                ->value('run_id');

            if ($latestRunId) {
                $dqdFailures += (int) DqdResult::where('run_id', $latestRunId)
                    ->where('passed', false)
                    ->count();
            }
        }

        // Active job count — running or queued across all job types
        $activeJobCount = $this->countActiveJobs($userId);

        // Recent jobs — last 5 across all job types
        $recentJobs = $this->getRecentJobs($userId, 5);

        return response()->json([
            'data' => [
                'sources' => $sources,
                'cohort_count' => $cohortCount,
                'concept_set_count' => $conceptSetCount,
                'dqd_failures' => $dqdFailures,
                'active_job_count' => $activeJobCount,
                'recent_cohorts' => $recentCohorts,
                'recent_jobs' => $recentJobs,
            ],
        ]);
    }

    private function countActiveJobs(int $userId): int
    {
        $activeStatuses = [ExecutionStatus::Running, ExecutionStatus::Queued, ExecutionStatus::Pending];

        $count = AnalysisExecution::whereIn('status', $activeStatuses)->count();

        $count += IngestionJob::where('created_by', $userId)
            ->whereIn('status', $activeStatuses)
            ->count();

        $count += GenomicUpload::where('created_by', $userId)
            ->where('status', 'parsing')
            ->count();

        $count += FhirExportJob::where('user_id', $userId)
            ->where('status', 'processing')
            ->count();

        $count += GisImport::where('user_id', $userId)
            ->whereIn('status', ['importing', 'processing'])
            ->count();

        $count += VocabularyImport::where('user_id', $userId)
            ->whereIn('status', $activeStatuses)
            ->count();

        return $count;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function getRecentJobs(int $userId, int $limit): array
    {
        $jobs = collect();

        // Analysis executions
        $jobs = $jobs->merge(
            AnalysisExecution::with('analysis')
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(fn (AnalysisExecution $e) => [
                    'id' => $e->id,
                    'name' => $e->analysis?->name ?? 'Analysis',
                    'type' => $this->analysisType($e->analysis_type),
                    'status' => $e->status->value,
                    'progress' => $this->progressForStatus($e->status),
                    'started_at' => $e->started_at?->toIso8601String(),
                    'duration' => null,
                    'created_at' => $e->created_at?->toIso8601String(),
                ])
        );

        // Ingestion jobs
        $jobs = $jobs->merge(
            IngestionJob::where('created_by', $userId)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(fn (IngestionJob $j) => [
                    'id' => $j->id,
                    'name' => 'Data Ingestion',
                    'type' => 'ingestion',
                    'status' => $j->status instanceof ExecutionStatus ? $j->status->value : (string) $j->status,
                    'progress' => $j->progress_percentage ?? 0,
                    'started_at' => $j->started_at?->toIso8601String(),
                    'duration' => null,
                    'created_at' => $j->created_at?->toIso8601String(),
                ])
        );

        // Genomic uploads
        $jobs = $jobs->merge(
            GenomicUpload::where('created_by', $userId)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(function (GenomicUpload $u) {
                    $variants = $u->total_variants ?? 0;
                    $sizeMb = $u->file_size_bytes ? round($u->file_size_bytes / 1024 / 1024, 1) : null;
                    $name = 'Genomic Parse — '.($u->filename ?? 'Unknown');
                    if ($variants > 0) {
                        $name .= ' ('.number_format($variants).' variants)';
                    }

                    return [
                        'id' => $u->id,
                        'name' => $name,
                        'type' => 'genomic_parse',
                        'status' => $this->normalizeGenomicStatus($u->status),
                        'progress' => $u->status === 'parsing' ? 50 : ($u->status === 'failed' ? 0 : 100),
                        'started_at' => $u->created_at?->toIso8601String(),
                        'duration' => null,
                        'created_at' => $u->created_at?->toIso8601String(),
                    ];
                })
        );

        // FHIR exports
        $jobs = $jobs->merge(
            FhirExportJob::where('user_id', $userId)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(fn (FhirExportJob $j) => [
                    'id' => $j->id,
                    'name' => 'FHIR Export',
                    'type' => 'fhir_export',
                    'status' => (string) $j->status,
                    'progress' => $j->status === 'completed' ? 100 : ($j->status === 'processing' ? 50 : 0),
                    'started_at' => $j->started_at?->toIso8601String(),
                    'duration' => null,
                    'created_at' => $j->created_at?->toIso8601String(),
                ])
        );

        // GIS imports
        $jobs = $jobs->merge(
            GisImport::where('user_id', $userId)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(fn (GisImport $j) => [
                    'id' => $j->id,
                    'name' => 'GIS Import — '.($j->filename ?? 'Unknown'),
                    'type' => 'gis_import',
                    'status' => in_array($j->status, ['importing', 'processing']) ? 'running' : (string) $j->status,
                    'progress' => $j->progress_percentage ?? 0,
                    'started_at' => $j->started_at?->toIso8601String(),
                    'duration' => null,
                    'created_at' => $j->created_at?->toIso8601String(),
                ])
        );

        // Vocabulary imports
        $jobs = $jobs->merge(
            VocabularyImport::where('user_id', $userId)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(fn (VocabularyImport $j) => [
                    'id' => $j->id,
                    'name' => 'Vocabulary Import — '.($j->file_name ?? 'Unknown'),
                    'type' => 'vocabulary_load',
                    'status' => (string) $j->status,
                    'progress' => $j->progress_percentage ?? 0,
                    'started_at' => $j->started_at?->toIso8601String(),
                    'duration' => null,
                    'created_at' => $j->created_at?->toIso8601String(),
                ])
        );

        return $jobs->sortByDesc('created_at')->take($limit)->values()->all();
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

    private function analysisType(string $class): string
    {
        $short = class_basename($class);

        return match ($short) {
            'Characterization' => 'characterization',
            'IncidenceRateAnalysis' => 'incidence_rate',
            'PathwayAnalysis' => 'pathway',
            'EstimationAnalysis' => 'estimation',
            'PredictionAnalysis' => 'prediction',
            'SccsAnalysis' => 'sccs',
            'EvidenceSynthesisAnalysis' => 'evidence_synthesis',
            default => 'analysis',
        };
    }

    private function normalizeGenomicStatus(?string $status): string
    {
        return match ($status) {
            'parsing' => 'running',
            'mapped', 'review', 'imported' => 'completed',
            'failed' => 'failed',
            default => 'pending',
        };
    }
}
