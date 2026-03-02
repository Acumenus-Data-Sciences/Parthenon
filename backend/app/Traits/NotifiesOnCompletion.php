<?php

namespace App\Traits;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Notifications\AnalysisCompletedNotification;
use App\Notifications\AnalysisFailedNotification;

trait NotifiesOnCompletion
{
    protected function notifyAuthor(AnalysisExecution $execution): void
    {
        $analysis = $execution->analysis;
        if (!$analysis || !method_exists($analysis, 'author')) {
            return;
        }

        $author = $analysis->author;
        if (!$author) {
            return;
        }

        $prefs = $author->notification_preferences ?? [];

        if ($execution->status === ExecutionStatus::Completed) {
            if ($prefs['analysis_completed'] ?? true) {
                $author->notify(new AnalysisCompletedNotification($execution));
            }
        } elseif ($execution->status === ExecutionStatus::Failed) {
            if ($prefs['analysis_failed'] ?? true) {
                $author->notify(new AnalysisFailedNotification($execution));
            }
        }
    }
}
