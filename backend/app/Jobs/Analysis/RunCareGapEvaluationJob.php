<?php

namespace App\Jobs\Analysis;

use App\Models\App\CareGapEvaluation;
use App\Models\App\ConditionBundle;
use App\Models\App\Source;
use App\Services\Analysis\CareGapService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunCareGapEvaluationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 3600;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    public function __construct(
        public readonly ConditionBundle $bundle,
        public readonly Source $source,
        public readonly CareGapEvaluation $evaluation,
        public readonly ?int $cohortDefinitionId = null,
    ) {
        $this->queue = 'analysis';
    }

    public function handle(CareGapService $service): void
    {
        Log::info('RunCareGapEvaluationJob started', [
            'bundle_id' => $this->bundle->id,
            'source_id' => $this->source->id,
            'evaluation_id' => $this->evaluation->id,
            'cohort_definition_id' => $this->cohortDefinitionId,
        ]);

        try {
            $service->evaluate(
                $this->bundle,
                $this->source,
                $this->cohortDefinitionId,
                $this->evaluation,
            );

            Log::info('RunCareGapEvaluationJob finished', [
                'bundle_id' => $this->bundle->id,
                'evaluation_id' => $this->evaluation->id,
                'status' => $this->evaluation->fresh()->status,
            ]);
        } catch (\Throwable $e) {
            Log::error('RunCareGapEvaluationJob failed', [
                'bundle_id' => $this->bundle->id,
                'evaluation_id' => $this->evaluation->id,
                'error' => $e->getMessage(),
            ]);

            // Ensure evaluation is marked as failed
            $this->evaluation->update([
                'status' => 'failed',
                'evaluated_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);
        }
    }
}
