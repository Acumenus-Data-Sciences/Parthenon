<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
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
}
