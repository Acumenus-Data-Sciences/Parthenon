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
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function index(Request $request): JsonResponse
    {
        $query = AnalysisExecution::query()
            ->with(['analysis', 'source'])
            ->whereHasMorph(
                'analysis',
                self::ANALYSIS_MODELS,
                fn (Builder $q) => $q->where('author_id', $request->user()->id),
            )
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        $executions = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => $executions->getCollection()->map(fn (AnalysisExecution $execution) => $this->transformJob($execution))->values(),
            'meta' => [
                'total' => $executions->total(),
                'per_page' => $executions->perPage(),
                'current_page' => $executions->currentPage(),
                'last_page' => $executions->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, AnalysisExecution $job): JsonResponse
    {
        $job->load(['analysis', 'source', 'logs']);
        $this->assertOwnership($job, $request->user()->id);

        return response()->json($this->transformJob($job, true));
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

        return response()->json($this->transformJob($newExecution));
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

        return response()->json($this->transformJob($job->fresh(['analysis', 'source'])));
    }

    private function assertOwnership(AnalysisExecution $job, int $userId): void
    {
        $authorId = $job->analysis?->author_id;
        abort_unless($authorId === $userId, 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function transformJob(AnalysisExecution $execution, bool $includeLogs = false): array
    {
        $execution->loadMissing(['analysis', 'source']);
        if ($execution->analysis) {
            $execution->analysis->loadMissing('author');
        }

        $analysis = $execution->analysis;
        $startedAt = $execution->started_at;
        $completedAt = $execution->completed_at;
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
            'started_at' => $startedAt?->toIso8601String(),
            'completed_at' => $completedAt?->toIso8601String(),
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
}
