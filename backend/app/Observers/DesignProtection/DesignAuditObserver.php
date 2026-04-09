<?php

namespace App\Observers\DesignProtection;

use App\Models\App\DesignAuditLog;
use App\Services\DesignProtection\DesignFixtureExporter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

abstract class DesignAuditObserver
{
    /**
     * Returns the entity_type string for the audit log.
     * e.g. 'cohort_definition', 'concept_set', 'estimation_analysis'
     */
    abstract protected function entityType(): string;

    // Stash old state before the UPDATE so it's available in updated().
    // Keyed on "ClassName:id" to avoid collisions between entity types sharing the same integer id.
    // Static so state persists across observer instances (Laravel resolves a new instance per event).
    protected static array $pendingOld = [];

    // ──────────────────────────────────────────────────────────────────────────
    // Create
    // ──────────────────────────────────────────────────────────────────────────

    public function created(Model $model): void
    {
        $this->writeAuditRow($model, 'created', null, $model->toArray());
        $this->exportFixture($model);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Update
    // ──────────────────────────────────────────────────────────────────────────

    public function updating(Model $model): void
    {
        $key = get_class($model).':'.$model->getKey();
        static::$pendingOld[$key] = $model->getOriginal();
    }

    public function updated(Model $model): void
    {
        $key = get_class($model).':'.$model->getKey();
        $old = static::$pendingOld[$key] ?? null;
        unset(static::$pendingOld[$key]);

        $this->writeAuditRow($model, 'updated', $old, $model->toArray());
        $this->exportFixture($model);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Delete (soft or hard)
    // ──────────────────────────────────────────────────────────────────────────

    public function deleting(Model $model): void
    {
        $key = get_class($model).':'.$model->getKey();
        static::$pendingOld[$key] = $model->getOriginal();
    }

    public function deleted(Model $model): void
    {
        $key = get_class($model).':'.$model->getKey();
        $old = static::$pendingOld[$key] ?? $model->toArray();
        unset(static::$pendingOld[$key]);

        $this->writeAuditRow($model, 'deleted', $old, null);
        // Soft-delete: update the fixture file to reflect deleted_at being set.
        // Hard-delete: remove the fixture file entirely.
        if (method_exists($model, 'trashed') && $model->trashed()) {
            $this->exportFixture($model);
        } else {
            $this->deleteFixture($model);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Restore
    // ──────────────────────────────────────────────────────────────────────────

    public function restored(Model $model): void
    {
        $this->writeAuditRow($model, 'restored', null, $model->toArray());
        $this->exportFixture($model);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function writeAuditRow(Model $model, string $action, ?array $old, ?array $new): void
    {
        try {
            $actor = $this->captureActor();

            DesignAuditLog::insert([
                'entity_type' => $this->entityType(),
                'entity_id' => $model->getKey(),
                'entity_name' => $model->getAttribute('name') ?? $this->entityType().'-'.$model->getKey(),
                'action' => $action,
                'actor_id' => $actor['actor_id'],
                'actor_email' => $actor['actor_email'],
                'old_json' => $old !== null ? json_encode($old) : null,
                'new_json' => $new !== null ? json_encode($new) : null,
                'changed_fields' => (($cf = $this->computeChangedFields($old, $new)) !== null)
                    ? json_encode($cf)
                    : null,
                'ip_address' => $this->captureIp(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('DesignAuditObserver: failed to write audit row', [
                'entity_type' => $this->entityType(),
                'entity_id' => $model->getKey(),
                'action' => $action,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function exportFixture(Model $model): void
    {
        // Skip filesystem writes during tests. Pest's RefreshDatabase rolls back
        // the DB transaction, but observer-driven file_put_contents() would
        // otherwise leak faker/test cohort fixtures into backend/database/fixtures/designs.
        if (app()->runningUnitTests()) {
            return;
        }

        try {
            app(DesignFixtureExporter::class)->exportEntity($this->entityType(), (int) $model->getKey());
        } catch (\Throwable $e) {
            Log::warning('DesignAuditObserver: fixture export failed (DB write succeeded)', [
                'entity_type' => $this->entityType(),
                'entity_id' => $model->getKey(),
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function deleteFixture(Model $model): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        try {
            app(DesignFixtureExporter::class)->deleteEntityFile($this->entityType(), (int) $model->getKey());
        } catch (\Throwable $e) {
            Log::warning('DesignAuditObserver: fixture delete failed', [
                'entity_type' => $this->entityType(),
                'entity_id' => $model->getKey(),
                'error' => $e->getMessage(),
            ]);
        }
    }

    /** @return array{actor_id: int|null, actor_email: string|null} */
    private function captureActor(): array
    {
        $user = auth()->user();

        return [
            'actor_id' => $user?->id,
            'actor_email' => $user?->email,
        ];
    }

    private function captureIp(): ?string
    {
        if (app()->runningInConsole()) {
            return null;
        }

        return request()->ip();
    }

    /** @return list<string>|null */
    private function computeChangedFields(?array $old, ?array $new): ?array
    {
        if ($old === null || $new === null) {
            return null;
        }
        $allKeys = array_unique(array_merge(array_keys($old), array_keys($new)));
        $changed = [];
        foreach ($allKeys as $key) {
            if (($old[$key] ?? null) !== ($new[$key] ?? null)) {
                $changed[] = $key;
            }
        }

        return $changed ?: null;
    }
}
