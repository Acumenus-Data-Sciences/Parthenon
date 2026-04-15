<?php

namespace App\Services\Analysis;

use App\Enums\ExecutionStatus;
use App\Models\App\CohortPhenotypeValidation;
use App\Services\RService;
use Illuminate\Support\Facades\Log;

class PhenotypeValidationService
{
    public function __construct(
        private readonly RService $rService,
    ) {}

    public function execute(CohortPhenotypeValidation $validation): void
    {
        $validation->loadMissing(['cohortDefinition', 'source.daimons']);

        $validation->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
            'fail_message' => null,
        ]);

        try {
            $settings = $validation->settings_json ?? [];
            $counts = $settings['counts'] ?? null;

            if (! is_array($counts)) {
                throw new \RuntimeException('Phenotype validation requires adjudicated count inputs.');
            }

            $spec = [
                'mode' => 'counts',
                'input_mode' => $validation->mode,
                'analysis_id' => $validation->id,
                'source' => HadesBridgeService::buildSourceSpec($validation->source),
                'cohort' => [
                    'cohort_definition_id' => $validation->cohort_definition_id,
                    'cohort_name' => $validation->cohortDefinition->name,
                ],
                'counts' => $counts,
                'notes' => $settings['notes'] ?? null,
            ];

            $result = $this->rService->runPhenotypeValidation($spec);

            if (($result['status'] ?? null) === 'error') {
                throw new \RuntimeException((string) ($result['message'] ?? 'PheValuator runtime failed.'));
            }

            $validation->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
                'result_json' => $result,
            ]);

            Log::info('Phenotype validation completed', [
                'validation_id' => $validation->id,
                'cohort_definition_id' => $validation->cohort_definition_id,
            ]);
        } catch (\Throwable $e) {
            $validation->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            Log::error('Phenotype validation failed', [
                'validation_id' => $validation->id,
                'cohort_definition_id' => $validation->cohort_definition_id,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
