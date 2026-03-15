<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\ExecutionLog;
use App\Models\App\SccsAnalysis;
use App\Models\App\Source;
use App\Services\RService;
use App\Support\SccsResultNormalizer;
use Illuminate\Support\Facades\Log;

class SccsService
{
    public function __construct(
        private readonly RService $rService,
    ) {}

    /**
     * Execute a Self-Controlled Case Series analysis.
     */
    public function execute(
        SccsAnalysis $analysis,
        Source $source,
        AnalysisExecution $execution,
    ): void {
        $execution->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        $this->log($execution, 'info', 'SCCS execution started', [
            'analysis_id' => $analysis->id,
            'source_id' => $source->id,
        ]);

        try {
            $design = $analysis->design_json;

            $exposureCohortId = $design['exposureCohortId'] ?? null;
            $outcomeCohortId = $design['outcomeCohortId'] ?? null;

            if ($exposureCohortId === null || $outcomeCohortId === null) {
                throw new \RuntimeException(
                    'SCCS design requires exposureCohortId and outcomeCohortId.'
                );
            }

            $source->load('daimons');
            $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
            $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
            $resultsSchema = $source->getTableQualifier(DaimonType::Results);

            if ($cdmSchema === null || $resultsSchema === null) {
                throw new \RuntimeException(
                    'Source is missing required CDM or Results schema configuration.'
                );
            }

            $spec = [
                'source' => HadesBridgeService::buildSourceSpec($source),
                'cohorts' => [
                    'exposure_cohort_id' => $exposureCohortId,
                    'outcome_cohort_id' => $outcomeCohortId,
                ],
                'risk_windows' => $design['riskWindows'] ?? [],
                'naive_period' => $design['naivePeriod'] ?? 180,
                'first_outcome_only' => $design['firstOutcomeOnly'] ?? true,
                'event_dependent_observation' => $design['eventDependentObservation'] ?? true,
                'covariate_settings' => $design['covariateSettings'] ?? [],
            ];

            $this->log($execution, 'info', 'Calling R sidecar for SCCS analysis', [
                'exposure_cohort_id' => $exposureCohortId,
                'outcome_cohort_id' => $outcomeCohortId,
            ]);

            $result = $this->rService->runSccs($spec);

            if ($this->isNotImplemented($result)) {
                $this->log($execution, 'warning', 'R SCCS package not yet implemented, storing placeholder result');

                $execution->update([
                    'status' => ExecutionStatus::Completed,
                    'completed_at' => now(),
                    'result_json' => SccsResultNormalizer::normalize([
                        'status' => 'r_not_implemented',
                        'message' => 'R SelfControlledCaseSeries package not yet configured.',
                        'design_validated' => true,
                    ]),
                ]);

                return;
            }

            $execution->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
                'result_json' => SccsResultNormalizer::normalize($result),
            ]);

            $this->log($execution, 'info', 'SCCS execution completed');

            Log::info('SCCS execution completed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
            ]);
        } catch (\Throwable $e) {
            $this->log($execution, 'error', 'SCCS execution failed', [
                'error' => $e->getMessage(),
            ]);

            $execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            Log::error('SCCS execution failed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * @param  array<string, mixed>  $result
     */
    private function isNotImplemented(array $result): bool
    {
        if (isset($result['status']) && $result['status'] === 'not_implemented') {
            return true;
        }

        if (isset($result['message']) && str_contains((string) $result['message'], 'Not yet implemented')) {
            return true;
        }

        return false;
    }

    /**
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
