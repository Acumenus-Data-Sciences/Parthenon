<?php

namespace App\Observers;

use App\Models\App\StudyActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;

/**
 * Universal observer for study sub-resource models.
 *
 * Automatically logs created/updated/deleted events to the study_activity_log
 * table for any model that has a study_id attribute.
 */
class StudySubResourceObserver
{
    public function created(Model $model): void
    {
        $this->log($model, $this->entityAction($model, 'added'));
    }

    public function updated(Model $model): void
    {
        $dirty = $model->getDirty();

        // Skip if only timestamps changed
        $meaningful = array_diff(array_keys($dirty), ['updated_at', 'created_at']);
        if (empty($meaningful)) {
            return;
        }

        $oldValues = [];
        $newValues = [];
        foreach ($meaningful as $key) {
            $oldValues[$key] = $model->getOriginal($key);
            $newValues[$key] = $dirty[$key];
        }

        $this->log(
            $model,
            $this->entityAction($model, 'updated'),
            $oldValues,
            $newValues,
        );
    }

    public function deleted(Model $model): void
    {
        $this->log($model, $this->entityAction($model, 'removed'));
    }

    /**
     * Derive a human-readable action from the model class name.
     * e.g. StudySite → "site_added", StudyTeamMember → "member_added"
     */
    private function entityAction(Model $model, string $verb): string
    {
        $class = class_basename($model);

        // Strip "Study" prefix to get the entity name
        $entity = Str::after($class, 'Study');
        if ($entity === $class) {
            // No "Study" prefix — use class name directly
            $entity = $class;
        }

        return Str::snake($entity).'_'.$verb;
    }

    private function log(
        Model $model,
        string $action,
        ?array $oldValue = null,
        ?array $newValue = null,
    ): void {
        $studyId = $model->getAttribute('study_id');
        if (! $studyId) {
            return;
        }

        StudyActivityLog::create([
            'study_id' => $studyId,
            'user_id' => Auth::id(),
            'action' => $action,
            'entity_type' => class_basename($model),
            'entity_id' => $model->getKey(),
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'ip_address' => Request::ip(),
            'occurred_at' => now(),
        ]);
    }
}
