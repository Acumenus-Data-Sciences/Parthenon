<?php

namespace App\Observers;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Services\Studies\StudyResultProjector;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * When an analysis execution completes, project its result into study_results
 * for any study that links the analysis. This is the generic bridge between the
 * analysis pipeline (which writes analysis_executions.result_json) and the study
 * Results tab / package builder (which read study_results), independent of which
 * Run*Job produced the execution.
 *
 * Every DB write is wrapped in a savepoint and try-catch (CLAUDE.md Gotcha #12 —
 * PostgreSQL transaction poisoning): a projection failure rolls back to the
 * savepoint and is logged, never aborting the parent analysis transaction.
 */
class AnalysisExecutionObserver
{
    public function saved(AnalysisExecution $execution): void
    {
        if (! $this->justCompleted($execution) || ! is_array($execution->result_json)) {
            return;
        }

        try {
            DB::transaction(function () use ($execution): void {
                app(StudyResultProjector::class)->projectExecution($execution);
            });
        } catch (\Throwable $e) {
            Log::warning('StudyResultProjector failed to project execution', [
                'execution_id' => $execution->id,
                'analysis_type' => $execution->analysis_type,
                'analysis_id' => $execution->analysis_id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * True when this save transitioned the execution into the completed state —
     * either created already-completed or its status just changed to completed.
     */
    private function justCompleted(AnalysisExecution $execution): bool
    {
        if ($execution->status !== ExecutionStatus::Completed) {
            return false;
        }

        return $execution->wasRecentlyCreated || $execution->wasChanged('status');
    }
}
