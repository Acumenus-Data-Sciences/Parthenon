<?php

namespace App\Services\Analysis;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\ExecutionLog;
use App\Models\App\SelfControlledCohortAnalysis;
use App\Models\App\Source;
use App\Services\RService;
use App\Support\SccsResultNormalizer;
use Illuminate\Support\Facades\Log;

class SelfControlledCohortService
{
    public function __construct(
        private readonly RService $rService,
    ) {}

    public function execute(
        SelfControlledCohortAnalysis $analysis,
        Source $source,
        AnalysisExecution $execution,
    ): void {
        $execution->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        $this->log($execution, 'info', 'Self-Controlled Cohort execution started', [
            'analysis_id' => $analysis->id,
            'source_id' => $source->id,
        ]);

        try {
            $design = $analysis->design_json;
            $exposureCohortId = $design['exposureCohortId'] ?? null;
            $outcomeCohortId = $design['outcomeCohortId'] ?? null;

            if ($exposureCohortId === null || $outcomeCohortId === null) {
                throw new \RuntimeException(
                    'Self-Controlled Cohort design requires exposureCohortId and outcomeCohortId.'
                );
            }

            $studyPopulation = $design['studyPopulation'] ?? [];
            $exposedWindow = $design['exposedWindow'] ?? $this->firstRiskWindow($design) ?? [];
            $unexposedWindow = $design['unexposedWindow'] ?? [];

            $spec = [
                'source' => HadesBridgeService::buildSourceSpec($source),
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
                'description' => $analysis->description ?? $analysis->name,
                'cohorts' => [
                    'exposure_cohort_id' => $exposureCohortId,
                    'outcome_cohort_id' => $outcomeCohortId,
                ],
                'first_exposure_only' => $design['firstExposureOnly'] ?? true,
                'first_outcome_only' => $studyPopulation['firstOutcomeOnly'] ?? true,
                'min_age' => $studyPopulation['minAge'] ?? '',
                'max_age' => $studyPopulation['maxAge'] ?? '',
                'risk_window_start_exposed' => $exposedWindow['start'] ?? 1,
                'risk_window_end_exposed' => $exposedWindow['end'] ?? 30,
                'add_length_of_exposure_exposed' => $exposedWindow['addLengthOfExposure'] ?? true,
                'risk_window_start_unexposed' => $unexposedWindow['start'] ?? -30,
                'risk_window_end_unexposed' => $unexposedWindow['end'] ?? -1,
                'add_length_of_exposure_unexposed' => $unexposedWindow['addLengthOfExposure'] ?? true,
                'has_full_time_at_risk' => $design['hasFullTimeAtRisk'] ?? false,
                'washout_period' => $studyPopulation['naivePeriod'] ?? $design['washoutPeriod'] ?? 0,
                'followup_period' => $design['followupPeriod'] ?? 0,
                'compute_tar_distribution' => $design['computeTarDistribution'] ?? false,
            ];

            $this->log($execution, 'info', 'Calling R sidecar for Self-Controlled Cohort analysis', [
                'exposure_cohort_id' => $exposureCohortId,
                'outcome_cohort_id' => $outcomeCohortId,
            ]);

            $result = $this->rService->runSelfControlledCohort($spec);

            if (($result['status'] ?? null) === 'error') {
                throw new \RuntimeException((string) ($result['message'] ?? 'Self-Controlled Cohort runtime failed.'));
            }

            $execution->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
                'result_json' => SccsResultNormalizer::normalize([
                    ...$result,
                    'engine' => 'self_controlled_cohort',
                    'package' => $result['package'] ?? 'SelfControlledCohort',
                ]),
            ]);

            $this->log($execution, 'info', 'Self-Controlled Cohort execution completed');

            Log::info('Self-Controlled Cohort execution completed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
            ]);
        } catch (\Throwable $e) {
            $this->log($execution, 'error', 'Self-Controlled Cohort execution failed', [
                'error' => $e->getMessage(),
            ]);

            $execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            Log::error('Self-Controlled Cohort execution failed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * @param  array<string, mixed>  $design
     * @return array<string, mixed>|null
     */
    private function firstRiskWindow(array $design): ?array
    {
        $riskWindows = $design['riskWindows'] ?? [];

        if (is_array($riskWindows) && is_array($riskWindows[0] ?? null)) {
            return $riskWindows[0];
        }

        return null;
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
