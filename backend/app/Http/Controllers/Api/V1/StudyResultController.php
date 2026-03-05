<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\App\StudyResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudyResultController extends Controller
{
    /**
     * GET /v1/studies/{study}/results
     */
    public function index(Request $request, Study $study): JsonResponse
    {
        $query = $study->results()
            ->with(['site.source:id,source_name', 'reviewedByUser:id,name,email'])
            ->orderByDesc('created_at');

        if ($request->filled('result_type')) {
            $query->where('result_type', $request->input('result_type'));
        }

        if ($request->filled('site_id')) {
            $query->where('site_id', $request->input('site_id'));
        }

        if ($request->boolean('publishable_only')) {
            $query->where('is_publishable', true);
        }

        $results = $query->paginate($request->integer('per_page', 50));

        return response()->json($results);
    }

    /**
     * GET /v1/studies/{study}/results/{result}
     */
    public function show(Study $study, StudyResult $result): JsonResponse
    {
        if ((int) $result->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Result does not belong to this study.'], 404);
        }

        $result->load(['site.source:id,source_name', 'reviewedByUser:id,name,email']);

        return response()->json(['data' => $result]);
    }

    /**
     * PUT /v1/studies/{study}/results/{result}
     *
     * Update review status and publishability flags.
     */
    public function update(Request $request, Study $study, StudyResult $result): JsonResponse
    {
        if ((int) $result->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Result does not belong to this study.'], 404);
        }

        $validated = $request->validate([
            'is_primary' => 'sometimes|boolean',
            'is_publishable' => 'sometimes|boolean',
        ]);

        if ($request->boolean('is_publishable') && ! $result->reviewed_by) {
            $validated['reviewed_by'] = $request->user()?->id;
            $validated['reviewed_at'] = now();
        }

        $result->update($validated);

        return response()->json([
            'data' => $result->fresh(),
            'message' => 'Result updated.',
        ]);
    }
}
