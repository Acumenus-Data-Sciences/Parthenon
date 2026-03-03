<?php

namespace App\Jobs\Analysis;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Services\Analysis\EvidenceSynthesisService;
use App\Traits\NotifiesOnCompletion;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunEvidenceSynthesisJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    use NotifiesOnCompletion;

    public int $timeout = 14400;

    public int $tries = 1;

    public function __construct(
        public readonly EvidenceSynthesisAnalysis $evidenceSynthesisAnalysis,
        public readonly AnalysisExecution $execution,
    ) {
        $this->queue = 'r-analysis';
    }

    public function handle(EvidenceSynthesisService $service): void
    {
        Log::info('RunEvidenceSynthesisJob started', [
            'analysis_id' => $this->evidenceSynthesisAnalysis->id,
            'execution_id' => $this->execution->id,
        ]);

        try {
            $service->execute(
                $this->evidenceSynthesisAnalysis,
                $this->execution,
            );

            Log::info('RunEvidenceSynthesisJob finished', [
                'analysis_id' => $this->evidenceSynthesisAnalysis->id,
                'execution_id' => $this->execution->id,
                'status' => $this->execution->fresh()->status->value,
            ]);

            $this->notifyAuthor($this->execution->fresh());
        } catch (\Throwable $e) {
            Log::error('RunEvidenceSynthesisJob failed', [
                'analysis_id' => $this->evidenceSynthesisAnalysis->id,
                'execution_id' => $this->execution->id,
                'error' => $e->getMessage(),
            ]);

            $this->execution->update([
                'status' => ExecutionStatus::Failed,
                'completed_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            $this->notifyAuthor($this->execution->fresh());
        }
    }
}
