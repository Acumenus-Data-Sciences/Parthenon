<?php

namespace App\Jobs\Analysis;

use App\Enums\ExecutionStatus;
use App\Models\App\CohortPhenotypeValidation;
use App\Services\Analysis\PhenotypeValidationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunPhenotypeValidationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 7200;

    public int $tries = 1;

    public function __construct(
        public readonly CohortPhenotypeValidation $validation,
    ) {
        $this->queue = 'r-analysis';
    }

    public function handle(PhenotypeValidationService $service): void
    {
        Log::info('RunPhenotypeValidationJob started', [
            'validation_id' => $this->validation->id,
            'cohort_definition_id' => $this->validation->cohort_definition_id,
            'source_id' => $this->validation->source_id,
        ]);

        try {
            $service->execute($this->validation);

            Log::info('RunPhenotypeValidationJob finished', [
                'validation_id' => $this->validation->id,
                'status' => $this->validation->fresh()->status->value,
            ]);
        } catch (\Throwable $e) {
            Log::error('RunPhenotypeValidationJob failed', [
                'validation_id' => $this->validation->id,
                'error' => $e->getMessage(),
            ]);

            $this->validation->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);
        }
    }
}
