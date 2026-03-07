<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\EstimationAnalysis;
use App\Models\App\ExecutionLog;
use App\Models\App\Source;
use App\Services\RService;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\Log;

class EstimationService
{
    public function __construct(
        private readonly RService $rService,
        private readonly SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Execute a population-level estimation analysis.
     */
    public function execute(
        EstimationAnalysis $analysis,
        Source $source,
        AnalysisExecution $execution,
    ): void {
        $execution->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        $this->log($execution, 'info', 'Estimation execution started', [
            'analysis_id' => $analysis->id,
            'source_id' => $source->id,
        ]);

        try {
            $design = $analysis->design_json;

            // Parse design_json
            $targetCohortId = $design['targetCohortId'] ?? null;
            $comparatorCohortId = $design['comparatorCohortId'] ?? null;
            $outcomeCohortIds = $design['outcomeCohortIds'] ?? [];
            $model = $design['model'] ?? [];
            $propensityScore = $design['propensityScore'] ?? [];
            $covariateSettings = $design['covariateSettings'] ?? [];
            $negativeControlOutcomes = $design['negativeControlOutcomes'] ?? [];

            if ($targetCohortId === null || $comparatorCohortId === null || empty($outcomeCohortIds)) {
                throw new \RuntimeException(
                    'Estimation design requires targetCohortId, comparatorCohortId, and at least one outcomeCohortId.'
                );
            }

            // Resolve schemas from source daimons
            $source->load('daimons');
            $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
            $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
            $resultsSchema = $source->getTableQualifier(DaimonType::Results);

            if ($cdmSchema === null || $resultsSchema === null) {
                throw new \RuntimeException(
                    'Source is missing required CDM or Results schema configuration.'
                );
            }

            // Resolve outcome names from cohort definitions
            $outcomeNames = [];
            $cohortNames = \App\Models\App\CohortDefinition::whereIn('id', $outcomeCohortIds)
                ->pluck('name', 'id');
            foreach ($outcomeCohortIds as $oid) {
                $outcomeNames[(string) $oid] = $cohortNames[$oid] ?? "Outcome {$oid}";
            }

            // Build the spec for R sidecar call
            $spec = [
                'source' => HadesBridgeService::buildSourceSpec($source),
                'cohorts' => [
                    'target_cohort_id' => $targetCohortId,
                    'comparator_cohort_id' => $comparatorCohortId,
                    'outcome_cohort_ids' => $outcomeCohortIds,
                    'outcome_names' => $outcomeNames,
                ],
                'model' => $model,
                'propensity_score' => $propensityScore,
                'covariate_settings' => $covariateSettings,
                'negative_control_outcomes' => $negativeControlOutcomes,
            ];

            $this->log($execution, 'info', 'Calling R sidecar for CohortMethod estimation', [
                'target_cohort_id' => $targetCohortId,
                'comparator_cohort_id' => $comparatorCohortId,
                'outcome_count' => count($outcomeCohortIds),
            ]);

            // Call R sidecar
            $result = $this->rService->runEstimation($spec);

            // Check if R returned a 501 (not yet implemented)
            if ($this->isNotImplemented($result)) {
                $this->log($execution, 'warning', 'R CohortMethod package not yet implemented, storing placeholder result');

                $execution->update([
                    'status' => ExecutionStatus::Completed,
                    'completed_at' => now(),
                    'result_json' => [
                        'status' => 'r_not_implemented',
                        'message' => 'R CohortMethod package not yet configured. Results will be available once the R sidecar is fully implemented.',
                        'design_validated' => true,
                        'design_summary' => [
                            'target_cohort_id' => $targetCohortId,
                            'comparator_cohort_id' => $comparatorCohortId,
                            'outcome_cohort_ids' => $outcomeCohortIds,
                            'model_type' => $model['type'] ?? 'cox',
                            'propensity_score_enabled' => $propensityScore['enabled'] ?? false,
                            'covariate_count' => count(array_filter($covariateSettings, fn ($v) => $v === true)),
                        ],
                    ],
                ]);

                $this->log($execution, 'info', 'Estimation execution completed with placeholder result');

                return;
            }

            // Store actual R results
            $execution->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
                'result_json' => $result,
            ]);

            $this->log($execution, 'info', 'Estimation execution completed');

            Log::info('Estimation execution completed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
            ]);
        } catch (\Throwable $e) {
            $this->log($execution, 'error', 'Estimation execution failed', [
                'error' => $e->getMessage(),
            ]);

            $execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            Log::error('Estimation execution failed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Determine if the R sidecar response indicates a 501 not-implemented status.
     *
     * @param  array<string, mixed>  $result
     */
    private function isNotImplemented(array $result): bool
    {
        // The R stub returns a message indicating not implemented
        if (isset($result['status']) && $result['status'] === 'not_implemented') {
            return true;
        }

        // Also check for the legacy stub message pattern
        if (isset($result['message']) && str_contains((string) $result['message'], 'Not yet implemented')) {
            return true;
        }

        return false;
    }

    /**
     * Log a message to the execution logs.
     *
     * @param  array<string, mixed>  $context
     */
    private function log(
        AnalysisExecution $execution,
        string $level,
        string $message,
        array $context = [],
    ): void {
        ExecutionLog::create([
            'execution_id' => $execution->id,
            'level' => $level,
            'message' => $message,
            'context' => ! empty($context) ? $context : null,
        ]);
    }
}
