<?php

namespace App\Jobs\Analysis;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\SccsAnalysis;
use App\Models\App\Source;
use App\Services\Analysis\SccsService;
use App\Traits\NotifiesOnCompletion;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunSccsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    use NotifiesOnCompletion;

    public int $timeout = 14400;

    public int $tries = 1;

    public function __construct(
        public readonly SccsAnalysis $sccsAnalysis,
        public readonly Source $source,
        public readonly AnalysisExecution $execution,
    ) {
        $this->queue = 'r-analysis';
    }

    public function handle(SccsService $service): void
    {
        Log::info('RunSccsJob started', [
            'sccs_analysis_id' => $this->sccsAnalysis->id,
            'source_id' => $this->source->id,
            'execution_id' => $this->execution->id,
        ]);

        try {
            $service->execute(
                $this->sccsAnalysis,
                $this->source,
                $this->execution,
            );

            Log::info('RunSccsJob finished', [
                'sccs_analysis_id' => $this->sccsAnalysis->id,
                'execution_id' => $this->execution->id,
                'status' => $this->execution->fresh()->status->value,
            ]);

            $this->notifyAuthor($this->execution->fresh());
        } catch (\Throwable $e) {
            Log::error('RunSccsJob failed', [
                'sccs_analysis_id' => $this->sccsAnalysis->id,
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
