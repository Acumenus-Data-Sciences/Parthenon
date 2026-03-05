<?php

namespace App\Observers;

use App\Models\App\Study;
use App\Models\App\StudyActivityLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Observer for the Study model.
 *
 * Logs lifecycle events: created, status changes, updates, deleted.
 */
class StudyObserver
{
    public function created(Study $study): void
    {
        $this->log($study, 'created');
    }

    public function updated(Study $study): void
    {
        $dirty = $study->getDirty();
        $meaningful = array_diff(array_keys($dirty), ['updated_at', 'created_at']);

        if (empty($meaningful)) {
            return;
        }

        // Status change gets its own action for easy filtering
        if (isset($dirty['status'])) {
            $this->log($study, 'status_changed', [
                'status' => $study->getOriginal('status'),
            ], [
                'status' => $dirty['status'],
            ]);

            $meaningful = array_diff($meaningful, ['status']);
            if (empty($meaningful)) {
                return;
            }
        }

        $oldValues = [];
        $newValues = [];
        foreach ($meaningful as $key) {
            $oldValues[$key] = $study->getOriginal($key);
            $newValues[$key] = $dirty[$key];
        }

        $this->log($study, 'updated', $oldValues, $newValues);
    }

    public function deleted(Study $study): void
    {
        $this->log($study, 'deleted');
    }

    private function log(
        Study $study,
        string $action,
        ?array $oldValue = null,
        ?array $newValue = null,
    ): void {
        StudyActivityLog::create([
            'study_id' => $study->id,
            'user_id' => Auth::id(),
            'action' => $action,
            'entity_type' => 'Study',
            'entity_id' => $study->id,
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'ip_address' => Request::ip(),
            'occurred_at' => now(),
        ]);
    }
}
