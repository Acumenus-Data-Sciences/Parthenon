<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\App\StudySynthesis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Studies
 */
class StudySynthesisController extends Controller
{
    /**
     * GET /v1/studies/{study}/synthesis
     */
    public function index(Study $study): JsonResponse
    {
        $syntheses = $study->syntheses()
            ->with('generatedByUser:id,name,email')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $syntheses]);
    }

    /**
     * POST /v1/studies/{study}/synthesis
     */
    public function store(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'study_analysis_id' => 'nullable|integer',
            'synthesis_type' => 'required|string|in:fixed_effects_meta,random_effects_meta,bayesian_meta,forest_plot,heterogeneity_analysis,funnel_plot,evidence_synthesis,custom',
            'input_result_ids' => 'required|array|min:1',
            'input_result_ids.*' => 'integer',
            'method_settings' => 'nullable|array',
        ]);

        $synthesis = $study->syntheses()->create([
            ...$validated,
            'generated_by' => $request->user()?->id,
            'generated_at' => now(),
        ]);

        return response()->json([
            'data' => $synthesis->load('generatedByUser:id,name,email'),
            'message' => 'Synthesis created.',
        ], 201);
    }

    /**
     * GET /v1/studies/{study}/synthesis/{synthesis}
     */
    public function show(Study $study, StudySynthesis $synthesis): JsonResponse
    {
        if ((int) $synthesis->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Synthesis does not belong to this study.'], 404);
        }

        $synthesis->load('generatedByUser:id,name,email');

        return response()->json(['data' => $synthesis]);
    }

    /**
     * DELETE /v1/studies/{study}/synthesis/{synthesis}
     */
    public function destroy(Study $study, StudySynthesis $synthesis): JsonResponse
    {
        if ((int) $synthesis->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Synthesis does not belong to this study.'], 404);
        }

        $synthesis->delete();

        return response()->json(['message' => 'Synthesis deleted.']);
    }
}
