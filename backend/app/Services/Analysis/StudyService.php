<?php

namespace App\Services\Analysis;

use App\Concerns\HasLibraryLifecycle;
use App\Enums\ExecutionStatus;
use App\Enums\LibraryStatus;
use App\Exceptions\RequiresPromotionException;
use App\Jobs\Analysis\RunCharacterizationJob;
use App\Jobs\Analysis\RunEstimationJob;
use App\Jobs\Analysis\RunIncidenceRateJob;
use App\Jobs\Analysis\RunPathwayJob;
use App\Jobs\Analysis\RunPredictionJob;
use App\Jobs\Analysis\RunSccsJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\Characterization;
use App\Models\App\EstimationAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Scopes\LibraryDefaultScope;
use App\Support\AnalysisTypeMap;
use App\Support\CharacterizationResultNormalizer;
use App\Support\EstimationResultNormalizer;
use App\Support\EvidenceSynthesisResultNormalizer;
use App\Support\IncidenceRateResultNormalizer;
use App\Support\PredictionResultNormalizer;
use App\Support\SccsResultNormalizer;
use Illuminate\Support\Facades\Log;

class StudyService
{
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
        $executionOrder = AnalysisTypeMap::executionOrder();
        $grouped = $studyAnalyses->sortBy(function (StudyAnalysis $sa) use ($executionOrder) {
            return $executionOrder[$sa->analysis_type] ?? 99;
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
            SccsAnalysis::class => RunSccsJob::dispatch($analysis, $source, $execution),
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
        // Validate the analysis type is known (canonical slug => FQCN map)
        $modelClass = AnalysisTypeMap::class($analysisType);

        if ($modelClass === null) {
            throw new \InvalidArgumentException("Unknown analysis type: {$analysisType}");
        }

        // Validate the analysis exists (bypass lifecycle global scope so we can give
        // accurate Draft/Archived error responses).
        $query = $modelClass::query();
        if (in_array(HasLibraryLifecycle::class, class_uses_recursive($modelClass), true)) {
            $query->withoutGlobalScope(LibraryDefaultScope::class);
        }
        $analysis = $query->find($analysisId);

        if ($analysis === null) {
            throw new \RuntimeException("Analysis not found: {$analysisType} #{$analysisId}");
        }

        // Library lifecycle: Draft items require explicit promotion; Archived
        // items cannot be attached.
        if (property_exists($analysis, 'status') || method_exists($analysis, 'getAttribute')) {
            $status = $analysis->getAttribute('status');
            $statusValue = $status instanceof LibraryStatus ? $status->value : $status;

            if ($statusValue === 'draft') {
                $actorId = auth()->id();
                if ($actorId !== null && (int) $analysis->getAttribute('author_id') === (int) $actorId) {
                    throw new RequiresPromotionException(
                        itemType: $analysisType.'_analysis',
                        itemId: (int) $analysis->getAttribute('id'),
                        itemName: (string) ($analysis->getAttribute('name') ?? 'Draft analysis'),
                    );
                }
                throw new \RuntimeException('Cannot attach another user\'s draft analysis.');
            }

            if ($statusValue === 'archived') {
                throw new \RuntimeException("Cannot attach an archived {$analysisType} analysis.");
            }
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

    /**
     * Attach the latest execution (with normalized result_json) to each of the
     * study's analyses as a synthetic `latest_execution` attribute. This is what
     * the Analyses tab, dashboard, and the Manuscript-button gate read — the
     * detail endpoints previously omitted it, so every analysis appeared
     * "Not executed" even when its executions had completed.
     */
    public function attachLatestExecutions(Study $study): void
    {
        $study->loadMissing('analyses.analysis');

        foreach ($study->analyses as $studyAnalysis) {
            $analysis = $studyAnalysis->analysis;
            if ($analysis === null) {
                continue;
            }

            $latest = AnalysisExecution::query()
                ->where('analysis_type', $studyAnalysis->analysis_type)
                ->where('analysis_id', $studyAnalysis->analysis_id)
                ->orderByDesc('created_at')
                ->first();

            if ($latest !== null && is_array($latest->result_json)) {
                $latest->setAttribute(
                    'result_json',
                    $this->normalizeExecutionResult($studyAnalysis->analysis_type, $latest->result_json),
                );
            }

            $analysis->setAttribute('latest_execution', $latest);
        }
    }

    /**
     * Normalize an execution's result_json for the given analysis type. Accepts
     * either the stored FQCN or a short slug (older callers passed the FQCN into
     * a slug-keyed match, which silently skipped normalization).
     *
     * @param  array<string, mixed>  $resultJson
     * @return array<string, mixed>
     */
    public function normalizeExecutionResult(string $analysisType, array $resultJson): array
    {
        return match (AnalysisTypeMap::slug($analysisType)) {
            'characterization' => CharacterizationResultNormalizer::normalize($resultJson),
            'estimation' => EstimationResultNormalizer::normalize($resultJson),
            'prediction' => PredictionResultNormalizer::normalize($resultJson),
            'incidence_rate' => IncidenceRateResultNormalizer::normalize($resultJson),
            'sccs' => SccsResultNormalizer::normalize($resultJson),
            'evidence_synthesis' => EvidenceSynthesisResultNormalizer::normalize($resultJson),
            default => $resultJson,
        };
    }
}
