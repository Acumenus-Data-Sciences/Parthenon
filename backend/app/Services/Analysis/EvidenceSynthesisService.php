<?php

namespace App\Services\Analysis;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\ExecutionLog;
use App\Services\RService;
use App\Support\EvidenceSynthesisResultNormalizer;
use Illuminate\Support\Facades\Log;

class EvidenceSynthesisService
{
    public function __construct(
        private readonly RService $rService,
    ) {}

    /**
     * Execute a cross-database evidence synthesis meta-analysis.
     */
    public function execute(
        EvidenceSynthesisAnalysis $analysis,
        AnalysisExecution $execution,
    ): void {
        $execution->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        $this->log($execution, 'info', 'Evidence synthesis execution started', [
            'analysis_id' => $analysis->id,
        ]);

        try {
            $design = $analysis->design_json;

            $estimates = $design['estimates'] ?? [];
            if (count($estimates) < 2) {
                throw new \RuntimeException(
                    'Evidence synthesis requires at least 2 site estimates.'
                );
            }

            $spec = [
                'estimates' => $estimates,
                'method' => $design['method'] ?? 'bayesian',
            ];

            $this->log($execution, 'info', 'Calling R sidecar for evidence synthesis', [
                'n_sites' => count($estimates),
                'method' => $spec['method'],
            ]);

            $result = $this->rService->runEvidenceSynthesis($spec);

            if ($this->isNotImplemented($result)) {
                $this->log($execution, 'warning', 'R EvidenceSynthesis package not yet implemented');

                $execution->update([
                    'status' => ExecutionStatus::Completed,
                    'completed_at' => now(),
                    'result_json' => EvidenceSynthesisResultNormalizer::normalize([
                        'status' => 'r_not_implemented',
                        'message' => 'R EvidenceSynthesis package not yet configured.',
                        'design_validated' => true,
                    ]),
                ]);

                return;
            }

            $execution->update([
                'status' => ExecutionStatus::Completed,
                'completed_at' => now(),
                'result_json' => EvidenceSynthesisResultNormalizer::normalize($result),
            ]);

            $this->log($execution, 'info', 'Evidence synthesis execution completed');

            Log::info('Evidence synthesis execution completed', [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
            ]);
        } catch (\Throwable $e) {
            $this->log($execution, 'error', 'Evidence synthesis execution failed', [
                'error' => $e->getMessage(),
            ]);

            $execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            Log::error('Evidence synthesis execution failed', [
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
