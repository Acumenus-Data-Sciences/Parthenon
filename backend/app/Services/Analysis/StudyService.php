<?php

namespace App\Services\Analysis;

use App\Enums\ExecutionStatus;
use App\Jobs\Analysis\RunCharacterizationJob;
use App\Jobs\Analysis\RunEstimationJob;
use App\Jobs\Analysis\RunIncidenceRateJob;
use App\Jobs\Analysis\RunPathwayJob;
use App\Jobs\Analysis\RunPredictionJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\Characterization;
use App\Models\App\EstimationAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use Illuminate\Support\Facades\Log;

class StudyService
{
    /**
     * Execution order for analysis types.
     * Lower number = executed first.
     *
     * @var array<string, int>
     */
    private const EXECUTION_ORDER = [
        Characterization::class => 1,
        IncidenceRateAnalysis::class => 2,
        PathwayAnalysis::class => 3,
        EstimationAnalysis::class => 4,
        PredictionAnalysis::class => 5,
    ];

    /**
     * Execute all analyses within a study.
     */
    public function executeAll(Study $study, Source $source): void
    {
        $studyAnalyses = $study->analyses()
            ->with('analysis')
            ->get();

        if ($studyAnalyses->isEmpty()) {
            throw new \RuntimeException('Study has no analyses to execute.');
        }

        // Group by type and build execution order
        $grouped = $studyAnalyses->sortBy(function (StudyAnalysis $sa) {
            return self::EXECUTION_ORDER[$sa->analysis_type] ?? 99;
        });

        // Dispatch jobs for each analysis
        foreach ($grouped as $studyAnalysis) {
            $analysis = $studyAnalysis->analysis;

            if ($analysis === null) {
                Log::warning('StudyService: analysis not found for StudyAnalysis', [
                    'study_analysis_id' => $studyAnalysis->id,
                    'analysis_type' => $studyAnalysis->analysis_type,
                    'analysis_id' => $studyAnalysis->analysis_id,
                ]);

                continue;
            }

            // Create execution record
            $execution = AnalysisExecution::create([
                'analysis_type' => $studyAnalysis->analysis_type,
                'analysis_id' => $studyAnalysis->analysis_id,
                'source_id' => $source->id,
                'status' => ExecutionStatus::Queued,
                'started_at' => now(),
            ]);

            // Dispatch the appropriate job
            $this->dispatchJob($studyAnalysis->analysis_type, $analysis, $source, $execution);
        }

        // Update study status to running
        $study->update(['status' => 'running']);

        Log::info('Study execution started', [
            'study_id' => $study->id,
            'source_id' => $source->id,
            'analysis_count' => $studyAnalyses->count(),
        ]);
    }

    /**
     * Dispatch the appropriate job for an analysis type.
     */
    private function dispatchJob(
        string $analysisType,
        mixed $analysis,
        Source $source,
        AnalysisExecution $execution,
    ): void {
        match ($analysisType) {
            Characterization::class => RunCharacterizationJob::dispatch($analysis, $source, $execution),
            IncidenceRateAnalysis::class => RunIncidenceRateJob::dispatch($analysis, $source, $execution),
            PathwayAnalysis::class => RunPathwayJob::dispatch($analysis, $source, $execution),
            EstimationAnalysis::class => RunEstimationJob::dispatch($analysis, $source, $execution),
            PredictionAnalysis::class => RunPredictionJob::dispatch($analysis, $source, $execution),
            default => Log::warning('StudyService: unknown analysis type', [
                'analysis_type' => $analysisType,
                'execution_id' => $execution->id,
            ]),
        };
    }

    /**
     * Get execution progress for a study.
     *
     * @return array<string, mixed>
     */
    public function getProgress(Study $study): array
    {
        $studyAnalyses = $study->analyses()->get();

        if ($studyAnalyses->isEmpty()) {
            return [
                'total' => 0,
                'pending' => 0,
                'queued' => 0,
                'running' => 0,
                'completed' => 0,
                'failed' => 0,
                'overall_status' => 'no_analyses',
            ];
        }

        // Gather the latest execution for each study analysis
        $statusCounts = [
            'pending' => 0,
            'queued' => 0,
            'running' => 0,
            'completed' => 0,
            'failed' => 0,
        ];

        foreach ($studyAnalyses as $studyAnalysis) {
            $latestExecution = AnalysisExecution::where('analysis_type', $studyAnalysis->analysis_type)
                ->where('analysis_id', $studyAnalysis->analysis_id)
                ->orderByDesc('created_at')
                ->first();

            if ($latestExecution === null) {
                $statusCounts['pending']++;
            } else {
                $status = $latestExecution->status->value;
                if (isset($statusCounts[$status])) {
                    $statusCounts[$status]++;
                }
            }
        }

        $total = $studyAnalyses->count();

        // Determine overall study status
        $overallStatus = 'pending';
        if ($statusCounts['failed'] > 0) {
            $overallStatus = 'has_failures';
        } elseif ($statusCounts['completed'] === $total) {
            $overallStatus = 'completed';
        } elseif ($statusCounts['running'] > 0 || $statusCounts['queued'] > 0) {
            $overallStatus = 'running';
        }

        return [
            'total' => $total,
            'pending' => $statusCounts['pending'],
            'queued' => $statusCounts['queued'],
            'running' => $statusCounts['running'],
            'completed' => $statusCounts['completed'],
            'failed' => $statusCounts['failed'],
            'overall_status' => $overallStatus,
        ];
    }

    /**
     * Add an analysis to a study.
     */
    public function addAnalysis(Study $study, string $analysisType, int $analysisId): StudyAnalysis
    {
        // Validate the analysis type is known
        $validTypes = [
            'characterization' => Characterization::class,
            'incidence_rate' => IncidenceRateAnalysis::class,
            'pathway' => PathwayAnalysis::class,
            'estimation' => EstimationAnalysis::class,
            'prediction' => PredictionAnalysis::class,
        ];

        $modelClass = $validTypes[$analysisType] ?? null;

        if ($modelClass === null) {
            throw new \InvalidArgumentException("Unknown analysis type: {$analysisType}");
        }

        // Validate the analysis exists
        $analysis = $modelClass::find($analysisId);

        if ($analysis === null) {
            throw new \RuntimeException("Analysis not found: {$analysisType} #{$analysisId}");
        }

        // Check for duplicate
        $existing = $study->analyses()
            ->where('analysis_type', $modelClass)
            ->where('analysis_id', $analysisId)
            ->first();

        if ($existing !== null) {
            throw new \RuntimeException('This analysis is already part of the study.');
        }

        return StudyAnalysis::create([
            'study_id' => $study->id,
            'analysis_type' => $modelClass,
            'analysis_id' => $analysisId,
        ]);
    }

    /**
     * Remove an analysis from a study.
     */
    public function removeAnalysis(Study $study, int $studyAnalysisId): void
    {
        $studyAnalysis = $study->analyses()->findOrFail($studyAnalysisId);
        $studyAnalysis->delete();
    }
}
