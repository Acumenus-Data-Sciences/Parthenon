<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AI\AbbyAiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AbbyAiController extends Controller
{
    public function __construct(
        private readonly AbbyAiService $abbyAi,
    ) {}

    /**
     * POST /api/v1/abby/build-cohort
     * Parse NL prompt → cohort expression JSON (does NOT save).
     */
    public function buildCohort(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt'       => 'required|string|min:10|max:3000',
            'source_id'    => 'sometimes|nullable|integer',
            'page_context' => 'sometimes|string|max:64',
        ]);

        $result = $this->abbyAi->buildCohortFromPrompt(
            $validated['prompt'],
            $validated['source_id'] ?? null,
            $validated['page_context'] ?? 'cohort-builder',
        );

        return response()->json($result);
    }

    /**
     * POST /api/v1/abby/create-cohort
     * Parse NL prompt → build cohort expression → persist CohortDefinition.
     * Returns the saved cohort + full build output for immediate UI display.
     */
    public function createCohort(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt'       => 'required|string|min:10|max:3000',
            'page_context' => 'sometimes|string|max:64',
        ]);

        $result = $this->abbyAi->buildCohortAndSave(
            $validated['prompt'],
            $request->user(),
            $validated['page_context'] ?? 'cohort-builder',
        );

        return response()->json([
            'data'  => $result['cohort_definition'],
            'build' => [
                'expression'     => $result['expression'],
                'explanation'    => $result['explanation'],
                'concept_sets'   => $result['concept_sets'],
                'warnings'       => $result['warnings'],
                'llm_confidence' => $result['llm_confidence'],
            ],
            'message' => 'Cohort created. Review the definition and generate when ready.',
        ], 201);
    }

    /**
     * POST /api/v1/abby/chat
     * Page-aware conversational assistant powered by MedGemma.
     * Abby adapts her persona and knowledge focus to the current UI page.
     *
     * page_context values: cohort-builder | vocabulary-search | achilles | dqd |
     *                      risk-scores | network | patient-profiles | studies | general
     */
    public function chat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message'           => 'required|string|min:1|max:4000',
            'page_context'      => 'sometimes|string|max:64',
            'page_data'         => 'sometimes|array',
            'history'           => 'sometimes|array',
            'history.*.role'    => 'required_with:history|string|in:user,assistant',
            'history.*.content' => 'required_with:history|string|max:4000',
        ]);

        $result = $this->abbyAi->chat(
            message:     $validated['message'],
            pageContext: $validated['page_context'] ?? 'general',
            pageData:    $validated['page_data'] ?? [],
            history:     $validated['history'] ?? [],
        );

        return response()->json($result);
    }

    /**
     * POST /api/v1/abby/suggest-criteria
     */
    public function suggestCriteria(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'domain'      => 'required|string|in:condition,drug,procedure,measurement,observation',
            'description' => 'required|string|min:2|max:500',
        ]);

        $suggestions = $this->abbyAi->suggestCriteria(
            $validated['domain'],
            $validated['description'],
        );

        return response()->json(['suggestions' => $suggestions]);
    }

    /**
     * POST /api/v1/abby/explain
     */
    public function explain(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'expression'   => 'required|array',
            'page_context' => 'sometimes|string|max:64',
        ]);

        $explanation = $this->abbyAi->explainExpression($validated['expression']);

        return response()->json(['explanation' => $explanation]);
    }

    /**
     * POST /api/v1/abby/refine
     */
    public function refine(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'expression'   => 'required|array',
            'prompt'       => 'required|string|min:5|max:2000',
            'page_context' => 'sometimes|string|max:64',
        ]);

        $result = $this->abbyAi->refineCohort(
            $validated['expression'],
            $validated['prompt'],
        );

        return response()->json($result);
    }
}
