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

    public function buildCohort(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => 'required|string|min:10|max:2000',
            'source_id' => 'sometimes|nullable|integer',
        ]);

        $result = $this->abbyAi->buildCohortFromPrompt(
            $validated['prompt'],
            $validated['source_id'] ?? null,
        );

        return response()->json($result);
    }

    public function suggestCriteria(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string|in:condition,drug,procedure,measurement,observation',
            'description' => 'required|string|min:2|max:500',
        ]);

        $suggestions = $this->abbyAi->suggestCriteria(
            $validated['domain'],
            $validated['description'],
        );

        return response()->json(['suggestions' => $suggestions]);
    }

    public function explain(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'expression' => 'required|array',
        ]);

        $explanation = $this->abbyAi->explainExpression($validated['expression']);

        return response()->json(['explanation' => $explanation]);
    }

    public function refine(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'expression' => 'required|array',
            'prompt' => 'required|string|min:5|max:2000',
        ]);

        $result = $this->abbyAi->refineCohort(
            $validated['expression'],
            $validated['prompt'],
        );

        return response()->json($result);
    }
}
