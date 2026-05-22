<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Library\BulkDeleteRequest;
use App\Http\Requests\Admin\Library\ReassignOwnerRequest;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\FeatureAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\App\SelfControlledCohortAnalysis;
use App\Models\User;
use App\Scopes\LibraryDefaultScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Phase D · §6.6 — `/api/v1/admin/library` unified library admin surface.
 *
 * Returns a UNION ALL across all 10 lifecycle-enabled tables so super-admins
 * can browse concept sets, cohort definitions, and analyses in one table.
 * Honors filters: type, owner_id, status (active/draft/archived), and
 * include_trash (returns soft-deleted rows when set).
 */
class LibraryController extends Controller
{
    /** @var list<array{table: string, type: string}> */
    public const TABLES = [
        ['table' => 'concept_sets', 'type' => 'concept_set'],
        ['table' => 'cohort_definitions', 'type' => 'cohort_definition'],
        ['table' => 'incidence_rate_analyses', 'type' => 'incidence_rate_analysis'],
        ['table' => 'pathway_analyses', 'type' => 'pathway_analysis'],
        ['table' => 'estimation_analyses', 'type' => 'estimation_analysis'],
        ['table' => 'prediction_analyses', 'type' => 'prediction_analysis'],
        ['table' => 'feature_analyses', 'type' => 'feature_analysis'],
        ['table' => 'sccs_analyses', 'type' => 'sccs_analysis'],
        ['table' => 'evidence_synthesis_analyses', 'type' => 'evidence_synthesis_analysis'],
        ['table' => 'self_controlled_cohort_analyses', 'type' => 'self_controlled_cohort_analysis'],
    ];

    public function index(Request $request): JsonResponse
    {
        $typeFilter = $request->input('type');
        $tables = $typeFilter
            ? array_values(array_filter(
                self::TABLES,
                fn (array $t) => $t['type'] === $typeFilter,
            ))
            : self::TABLES;

        if ($tables === []) {
            return response()->json(['data' => [], 'count' => 0]);
        }

        $ownerId = $request->filled('owner_id') ? $request->integer('owner_id') : null;
        $statusFilter = $request->input('status');
        $search = $request->input('search');
        $includeTrash = $request->boolean('include_trash');
        $limit = max(1, min(1000, $request->integer('limit', 500)));

        $queries = [];

        foreach ($tables as $entry) {
            $q = DB::table($entry['table'])
                ->select([
                    'id',
                    'name',
                    'description',
                    'author_id',
                    'status',
                    'created_at',
                    'updated_at',
                    'archived_at',
                    'deleted_at',
                    DB::raw("'{$entry['type']}'::text as item_type"),
                ]);

            if ($includeTrash) {
                $q->whereNotNull('deleted_at');
            } else {
                $q->whereNull('deleted_at');
            }

            if ($ownerId !== null) {
                $q->where('author_id', $ownerId);
            }

            if ($statusFilter !== null && $statusFilter !== '' && $statusFilter !== 'all') {
                $q->where('status', $statusFilter);
            }

            if (is_string($search) && $search !== '') {
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'ilike', '%'.$search.'%')
                        ->orWhere('description', 'ilike', '%'.$search.'%');
                });
            }

            $queries[] = $q;
        }

        $union = array_shift($queries);
        foreach ($queries as $q) {
            $union->unionAll($q);
        }

        $rows = DB::query()
            ->fromSub($union, 'lib')
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get();

        $ownerIds = $rows->pluck('author_id')->filter()->unique()->values()->all();
        $owners = $ownerIds === []
            ? collect()
            : DB::table('users')
                ->whereIn('id', $ownerIds)
                ->get(['id', 'name', 'email'])
                ->keyBy('id');

        $data = $rows->map(function ($row) use ($owners) {
            $owner = $row->author_id !== null ? $owners->get($row->author_id) : null;

            return [
                'item_type' => $row->item_type,
                'id' => (int) $row->id,
                'name' => $row->name,
                'description' => $row->description,
                'status' => $row->status,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
                'archived_at' => $row->archived_at,
                'deleted_at' => $row->deleted_at,
                'owner' => $owner ? [
                    'id' => (int) $owner->id,
                    'name' => $owner->name,
                    'email' => $owner->email,
                ] : null,
            ];
        })->values();

        return response()->json([
            'data' => $data,
            'count' => $data->count(),
            'limit' => $limit,
            'types' => array_column(self::TABLES, 'type'),
        ]);
    }

    /**
     * Phase D · §6.7 — hard-delete (soft-delete via SoftDeletes) with preflight.
     *
     * Rules:
     * - Item must already be `archived`.
     * - Item must not be attached to any Study.
     * - Each deletion is captured in audit_log inside a transaction.
     * - Any blocked item short-circuits with HTTP 422 + the blocked list.
     */
    public function bulkDelete(BulkDeleteRequest $request): JsonResponse
    {
        $blocked = [];
        $deleted = [];
        $errors = [];

        foreach ($request->input('items', []) as $entry) {
            $type = $entry['type'];
            $id = (int) $entry['id'];

            $modelClass = $this->resolveModelClass($type);
            if ($modelClass === null) {
                $errors[] = ['id' => $id, 'type' => $type, 'error' => 'unknown_type'];

                continue;
            }

            /** @var Model|null $item */
            $item = $modelClass::query()
                ->withoutGlobalScope(LibraryDefaultScope::class)
                ->find($id);
            if ($item === null) {
                $errors[] = ['id' => $id, 'type' => $type, 'error' => 'not_found'];

                continue;
            }

            $status = $item->getAttribute('status');
            $statusValue = is_object($status) && property_exists($status, 'value')
                ? $status->value
                : (string) $status;
            if ($statusValue !== 'archived') {
                $errors[] = ['id' => $id, 'type' => $type, 'error' => 'must_be_archived', 'status' => $statusValue];

                continue;
            }

            $attachments = $this->countAttachments($type, $id);
            if ($attachments !== []) {
                $blocked[] = ['id' => $id, 'type' => $type, 'attached_to' => $attachments];

                continue;
            }

            DB::transaction(function () use ($item, $type, $id, $request): void {
                DB::table('audit_log')->insert([
                    'actor_id' => $request->user()?->id,
                    'action' => 'library.hard_delete',
                    'subject_type' => $type,
                    'subject_id' => $id,
                    'snapshot' => json_encode($item->toArray()),
                    'created_at' => now(),
                ]);
                $item->delete();
            });
            $deleted[] = $id;
        }

        if ($blocked !== [] || $errors !== []) {
            return response()->json([
                'blocked' => $blocked,
                'errors' => $errors,
                'deleted' => $deleted,
            ], 422);
        }

        return response()->json(['deleted' => $deleted]);
    }

    /**
     * Phase D · §6.8 — reassign ownership of one or more library items to a
     * target user identified by email.
     *
     * For each item: confirms the target has the relevant `.view` permission
     * for the item's domain. If not, the item is added to the blocked list
     * and not reassigned. Each successful reassignment writes an audit_log
     * row with action='library.reassign'.
     */
    public function reassign(ReassignOwnerRequest $request): JsonResponse
    {
        $target = User::query()->where('email', $request->string('target_email'))->firstOrFail();

        $blocked = [];
        $reassigned = [];
        $errors = [];

        foreach ($request->input('items', []) as $entry) {
            $type = $entry['type'];
            $id = (int) $entry['id'];

            $modelClass = $this->resolveModelClass($type);
            if ($modelClass === null) {
                $errors[] = ['id' => $id, 'type' => $type, 'error' => 'unknown_type'];

                continue;
            }

            $permission = $this->permissionFor($type);
            if (! $target->hasPermissionTo($permission)) {
                $blocked[] = [
                    'id' => $id,
                    'type' => $type,
                    'error' => 'target_missing_permission',
                    'required_permission' => $permission,
                ];

                continue;
            }

            /** @var Model|null $item */
            $item = $modelClass::query()
                ->withoutGlobalScope(LibraryDefaultScope::class)
                ->find($id);
            if ($item === null) {
                $errors[] = ['id' => $id, 'type' => $type, 'error' => 'not_found'];

                continue;
            }

            $previousOwnerId = (int) $item->getAttribute('author_id');
            if ($previousOwnerId === $target->id) {
                $reassigned[] = ['id' => $id, 'type' => $type, 'unchanged' => true];

                continue;
            }

            DB::transaction(function () use ($item, $type, $id, $request, $target, $previousOwnerId): void {
                $item->forceFill(['author_id' => $target->id])->save();
                DB::table('audit_log')->insert([
                    'actor_id' => $request->user()?->id,
                    'action' => 'library.reassign',
                    'subject_type' => $type,
                    'subject_id' => $id,
                    'snapshot' => json_encode([
                        'previous_author_id' => $previousOwnerId,
                        'new_author_id' => $target->id,
                        'target_email' => $target->email,
                    ]),
                    'created_at' => now(),
                ]);
            });
            $reassigned[] = ['id' => $id, 'type' => $type, 'previous_author_id' => $previousOwnerId];
        }

        if ($blocked !== [] || $errors !== []) {
            return response()->json([
                'blocked' => $blocked,
                'errors' => $errors,
                'reassigned' => $reassigned,
                'target' => ['id' => $target->id, 'email' => $target->email],
            ], 422);
        }

        return response()->json([
            'reassigned' => $reassigned,
            'target' => ['id' => $target->id, 'email' => $target->email],
        ]);
    }

    /**
     * Phase D · §6.7 — restore a soft-deleted item to its prior status
     * (sets status='archived' so it remains visible in the admin surface
     * but does not silently re-enter the active library).
     */
    public function restore(BulkDeleteRequest $request): JsonResponse
    {
        $restored = [];
        $errors = [];

        foreach ($request->input('items', []) as $entry) {
            $type = $entry['type'];
            $id = (int) $entry['id'];

            $modelClass = $this->resolveModelClass($type);
            if ($modelClass === null) {
                $errors[] = ['id' => $id, 'type' => $type, 'error' => 'unknown_type'];

                continue;
            }

            /** @var Model|null $item */
            $item = $modelClass::query()
                ->withoutGlobalScope(LibraryDefaultScope::class)
                ->withTrashed() // @phpstan-ignore-line — SoftDeletes scope macro
                ->find($id);
            if ($item === null || $item->getAttribute('deleted_at') === null) {
                $errors[] = ['id' => $id, 'type' => $type, 'error' => 'not_in_trash'];

                continue;
            }

            DB::transaction(function () use ($item, $type, $id, $request): void {
                $item->restore(); // @phpstan-ignore-line — SoftDeletes trait
                DB::table('audit_log')->insert([
                    'actor_id' => $request->user()?->id,
                    'action' => 'library.restore',
                    'subject_type' => $type,
                    'subject_id' => $id,
                    'snapshot' => null,
                    'created_at' => now(),
                ]);
            });
            $restored[] = $id;
        }

        if ($errors !== []) {
            return response()->json(['restored' => $restored, 'errors' => $errors], 422);
        }

        return response()->json(['restored' => $restored]);
    }

    /**
     * Phase D · §6.7 — force-delete a soft-deleted item immediately,
     * bypassing the 30-day grace window. Records an audit row with the
     * pre-purge snapshot so the row content survives the deletion.
     */
    public function purgeNow(BulkDeleteRequest $request): JsonResponse
    {
        $purged = [];
        $errors = [];

        foreach ($request->input('items', []) as $entry) {
            $type = $entry['type'];
            $id = (int) $entry['id'];

            $modelClass = $this->resolveModelClass($type);
            if ($modelClass === null) {
                $errors[] = ['id' => $id, 'type' => $type, 'error' => 'unknown_type'];

                continue;
            }

            /** @var Model|null $item */
            $item = $modelClass::query()
                ->withoutGlobalScope(LibraryDefaultScope::class)
                ->onlyTrashed() // @phpstan-ignore-line — SoftDeletes scope macro
                ->find($id);
            if ($item === null) {
                $errors[] = ['id' => $id, 'type' => $type, 'error' => 'not_in_trash'];

                continue;
            }

            DB::transaction(function () use ($item, $type, $id, $request): void {
                DB::table('audit_log')->insert([
                    'actor_id' => $request->user()?->id,
                    'action' => 'library.purge_now',
                    'subject_type' => $type,
                    'subject_id' => $id,
                    'snapshot' => json_encode($item->toArray()),
                    'created_at' => now(),
                ]);
                $item->forceDelete();
            });
            $purged[] = $id;
        }

        if ($errors !== []) {
            return response()->json(['purged' => $purged, 'errors' => $errors], 422);
        }

        return response()->json(['purged' => $purged]);
    }

    /**
     * Map an item_type to the RBAC permission a user must hold to own it.
     */
    private function permissionFor(string $type): string
    {
        return match ($type) {
            'concept_set' => 'concept-sets.view',
            'cohort_definition' => 'cohorts.view',
            default => 'analyses.view',
        };
    }

    /**
     * Map an item_type string to its Eloquent model class.
     *
     * @return class-string<Model>|null
     */
    private function resolveModelClass(string $type): ?string
    {
        return match ($type) {
            'concept_set' => ConceptSet::class,
            'cohort_definition' => CohortDefinition::class,
            'incidence_rate_analysis' => IncidenceRateAnalysis::class,
            'pathway_analysis' => PathwayAnalysis::class,
            'estimation_analysis' => EstimationAnalysis::class,
            'prediction_analysis' => PredictionAnalysis::class,
            'feature_analysis' => FeatureAnalysis::class,
            'sccs_analysis' => SccsAnalysis::class,
            'evidence_synthesis_analysis' => EvidenceSynthesisAnalysis::class,
            'self_controlled_cohort_analysis' => SelfControlledCohortAnalysis::class,
            default => null,
        };
    }

    /**
     * Return Studies that reference this library item. Concept-set membership
     * is derived from `study_cohorts.concept_set_ids` (JSON array). Cohorts
     * pivot directly on `study_cohorts.cohort_definition_id`. Analyses use the
     * polymorphic (`analysis_type`, `analysis_id`) pair on `study_analyses`.
     *
     * @return array<int, array{study_id: int, study_title: string}>
     */
    private function countAttachments(string $type, int $id): array
    {
        $rows = match ($type) {
            'concept_set' => DB::table('study_cohorts')
                ->join('studies', 'studies.id', '=', 'study_cohorts.study_id')
                ->whereRaw('study_cohorts.concept_set_ids @> ?::jsonb', [json_encode([$id])])
                ->distinct()
                ->get(['studies.id as study_id', 'studies.title as study_title']),
            'cohort_definition' => DB::table('study_cohorts')
                ->join('studies', 'studies.id', '=', 'study_cohorts.study_id')
                ->where('study_cohorts.cohort_definition_id', $id)
                ->distinct()
                ->get(['studies.id as study_id', 'studies.title as study_title']),
            default => DB::table('study_analyses')
                ->join('studies', 'studies.id', '=', 'study_analyses.study_id')
                ->where('study_analyses.analysis_type', $type)
                ->where('study_analyses.analysis_id', $id)
                ->distinct()
                ->get(['studies.id as study_id', 'studies.title as study_title']),
        };

        return $rows->map(fn ($r) => [
            'study_id' => (int) $r->study_id,
            'study_title' => (string) $r->study_title,
        ])->all();
    }
}
