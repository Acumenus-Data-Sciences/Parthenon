<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\ExecutionLog;
use App\Models\App\PredictionAnalysis;
use App\Models\App\Source;
use App\Services\RService;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\Log;

class PredictionService
{
    public function __construct(
        private readonly RService $rService,
        private readonly SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Execute a patient-level prediction analysis.
     */
    public function execute(
        PredictionAnalysis $analysis,
        Source $source,
        AnalysisExecution $execution,
    ): void {
        $execution->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        $this->log($execution, 'info', 'Prediction execution started', [
            'analysis_id' => $analysis->id,
            'source_id' => $source->id,
        ]);

        try {
            $design = $analysis->design_json;

            // Parse design_json
            $targetCohortId = $design['targetCohortId'] ?? null;
            $outcomeCohortId = $design['outcomeCohortId'] ?? null;
            $model = $design['model'] ?? [];
            $timeAtRisk = $design['timeAtRisk'] ?? [];
            $covariateSettings = $design['covariateSettings'] ?? [];
            $populationSettings = $design['populationSettings'] ?? [];
            $splitSettings = $design['splitSettings'] ?? [];

            if ($targetCohortId === null || $outcomeCohortId === null) {
                throw new \RuntimeException(
                    'Prediction design requires targetCohortId and outcomeCohortId.'
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

            // Build the spec for R sidecar call
            $spec = [
                'source' => [
                    'dialect' => $source->source_dialect ?? 'postgresql',
                    'connection' => $source->source_connection ?? 'cdm',
                    'cdm_schema' => $cdmSchema,
                    'vocab_schema' => $vocabSchema,
                    'results_schema' => $resultsSchema,
                    'cohort_table' => "{$resultsSchema}.cohort",
                ],
                'cohorts' => [
                    'target_cohort_id' => $targetCohortId,
                    'outcome_cohort_id' => $outcomeCohortId,
                ],
                'model' => $model,
                'time_at_risk' => $timeAtRisk,
                'covariate_settings' => $covariateSettings,
                'population_settings' => $populationSettings,
                'split_settings' => $splitSettings,
            ];

            $this->log($execution, 'info', 'Calling R sidecar for PatientLevelPrediction', [
                'target_cohort_id' => $targetCohortId,
                'outcome_cohort_id' => $outcomeCohortId,
                'model_type' => $model['type'] ?? 'lasso_logistic_regression',
            ]);

            // Call R sidecar
            $result = $this->rService->runPrediction($spec);

            // Check if R returned a 501 (not yet implemented)
            if ($this->isNotImplemented($result)) {
                $this->log($execution, 'warning', 'R PatientLevelPrediction package not yet implemented, storing placeholder result');

                $execution->update([
                    'status' => ExecutionStatus::Completed,
                    'completed_at' => now(),
                    'result_json' => [
                        'status' => 'r_not_implemented',
                        'message' => 'R PatientLevelPrediction package not yet configured. Results will be available once the R sidecar is fully implemented.',
                        'design_validated' => true,
                        'design_summary' => [
                            'target_cohort_id' => $targetCohortId,
                            'outcome_cohort_id' => $outcomeCohortId,
                            'model_type' => $model['type'] ?? 'lasso_logistic_regression',
                            'time_at_risk_start' => $timeAtRisk['start'] ?? 1,
                            'time_at_risk_end' => $timeAtRisk['end'] ?? 365,
                            'test_fraction' => $splitSettings['testFraction'] ?? 0.25,
                            'covariate_count' => count(array_filter($covariateSettings, fn ($v) => $v === true)),
                        ],
                    ],
                ]);

                $this->log($execution, 'info', 'Prediction execution completed with placeholder result');

                return;
            }

            // Store actual R results
            $execution->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
                'result_json' => $result,
            ]);

            $this->log($execution, 'info', 'Prediction execution completed');

            Log::info('Prediction execution completed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
            ]);
        } catch (\Throwable $e) {
            $this->log($execution, 'error', 'Prediction execution failed', [
                'error' => $e->getMessage(),
            ]);

            $execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            Log::error('Prediction execution failed', [
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
