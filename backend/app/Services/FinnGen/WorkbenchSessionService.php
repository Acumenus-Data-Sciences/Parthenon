<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Models\App\FinnGen\WorkbenchSession;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;

/**
 * SP4 Phase A — CRUD for cohort-workbench sessions.
 *
 * Ownership is enforced at the service layer: every mutating method requires
 * the caller to pass the acting user_id, and reads are scoped accordingly.
 * The controller layer is responsible for authentication; this service does
 * not look at auth state directly.
 */
class WorkbenchSessionService
{
    /** @return Collection<int, WorkbenchSession> */
    public function listForUser(int $userId, ?string $sourceKey = null): Collection
    {
        $query = WorkbenchSession::query()
            ->where('user_id', $userId)
            ->orderByDesc('last_active_at');

        if ($sourceKey !== null) {
            $query->where('source_key', $sourceKey);
        }

        return $query->get();
    }

    public function findForUser(string $id, int $userId): ?WorkbenchSession
    {
        return WorkbenchSession::query()
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();
    }

    /**
     * @param  array<string, mixed>  $sessionState
     */
    public function create(
        int $userId,
        string $sourceKey,
        string $name,
        ?string $description = null,
        array $sessionState = [],
        int $schemaVersion = 1,
    ): WorkbenchSession {
        return WorkbenchSession::create([
            'user_id' => $userId,
            'source_key' => $sourceKey,
            'name' => $name,
            'description' => $description,
            'session_state' => $sessionState,
            'schema_version' => $schemaVersion,
            'last_active_at' => Carbon::now(),
        ]);
    }

    /**
     * Partial update — fields not in $patch are left untouched. Always bumps
     * last_active_at since any mutation counts as activity.
     *
     * @param  array<string, mixed>  $patch
     */
    public function update(WorkbenchSession $session, array $patch): WorkbenchSession
    {
        $session->fill($patch);
        $session->last_active_at = Carbon::now();
        $session->save();

        return $session;
    }

    public function delete(WorkbenchSession $session): void
    {
        $session->delete();
    }
}
