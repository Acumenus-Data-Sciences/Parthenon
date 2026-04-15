<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\CohortDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Cohort Definitions
 */
class CohortAuthoringArtifactController extends Controller
{
    /**
     * POST /v1/cohort-definitions/authoring/import
     *
     * Import an ATLAS/Circe-style cohort authoring artifact.
     */
    public function import(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'expression_json' => ['nullable', 'array'],
            'expression' => ['nullable', 'array'],
            'tags' => ['nullable', 'array'],
            'is_public' => ['nullable', 'boolean'],
        ]);

        $expression = $validated['expression_json'] ?? $validated['expression'] ?? [];

        $cohort = CohortDefinition::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'expression_json' => $expression,
            'author_id' => $request->user()->id,
            'is_public' => $validated['is_public'] ?? false,
            'tags' => array_values(array_unique(array_filter([
                ...($validated['tags'] ?? []),
                'authoring-import',
            ]))),
        ]);

        return response()->json([
            'data' => $cohort->fresh('author:id,name,email'),
            'message' => 'Cohort authoring artifact imported.',
        ], 201);
    }

    /**
     * GET /v1/cohort-definitions/{cohortDefinition}/authoring/export
     *
     * Export a cohort as a portable authoring artifact.
     */
    public function export(CohortDefinition $cohortDefinition): JsonResponse
    {
        return response()->json([
            'data' => [
                'format' => 'parthenon.cohort-authoring.v1',
                'cohort_definition_id' => $cohortDefinition->id,
                'name' => $cohortDefinition->name,
                'description' => $cohortDefinition->description,
                'expression_json' => $cohortDefinition->expression_json ?? [],
                'tags' => $cohortDefinition->tags ?? [],
                'quality_tier' => $cohortDefinition->quality_tier,
                'deprecated_at' => $cohortDefinition->deprecated_at,
            ],
        ]);
    }
}
