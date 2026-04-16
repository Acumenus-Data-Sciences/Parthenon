<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\CohortAuthoringArtifact;
use App\Models\App\CohortDefinition;
use App\Services\Cohort\CohortAuthoringArtifactService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Cohort Definitions
 */
class CohortAuthoringArtifactController extends Controller
{
    public function __construct(
        private readonly CohortAuthoringArtifactService $service,
    ) {}

    /**
     * POST /v1/cohort-definitions/authoring/import
     */
    public function import(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'format' => ['required', 'string'],
            'artifact' => ['required'],
            'name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'duplicate_strategy' => ['nullable', 'string', 'in:suffix,skip,replace'],
            'tags' => ['nullable', 'array'],
            'is_public' => ['nullable', 'boolean'],
        ]);

        $parsed = $this->service->parseImportPayload($validated);
        $duplicateStrategy = $validated['duplicate_strategy'] ?? 'suffix';
        $format = $parsed['metadata']['format'];

        $existing = CohortDefinition::query()->where('name', $parsed['name'])->first();
        if ($existing && $duplicateStrategy === 'skip') {
            return response()->json([
                'data' => [
                    'status' => 'skipped',
                    'reason' => 'Duplicate name',
                    'cohort_definition' => $existing->fresh(),
                ],
                'message' => 'Duplicate cohort skipped.',
            ]);
        }

        $name = $parsed['name'];
        if ($existing && $duplicateStrategy !== 'replace') {
            $name = $this->suffixedName($parsed['name']);
        }

        if ($existing && $duplicateStrategy === 'replace') {
            $existing->fill([
                'description' => $parsed['description'] ?? $existing->description,
                'expression_json' => $parsed['expression'],
                'tags' => array_values(array_unique(array_filter([
                    ...(is_array($existing->tags) ? $existing->tags : []),
                    ...($validated['tags'] ?? []),
                    'authoring-import',
                ]))),
            ])->save();
            $cohort = $existing->fresh();
        } else {
            $cohort = CohortDefinition::create([
                'name' => $name,
                'description' => $parsed['description'] ?? $validated['description'] ?? null,
                'expression_json' => $parsed['expression'],
                'author_id' => $request->user()->id,
                'is_public' => $validated['is_public'] ?? false,
                'tags' => array_values(array_unique(array_filter([
                    ...($validated['tags'] ?? []),
                    'authoring-import',
                ]))),
            ]);
        }

        $artifact = CohortAuthoringArtifact::create([
            'cohort_definition_id' => $cohort->id,
            'author_id' => $request->user()->id,
            'direction' => 'import',
            'format' => $format,
            'artifact_json' => is_array($validated['artifact']) ? $validated['artifact'] : ['raw' => $validated['artifact']],
            'metadata_json' => $parsed['metadata'],
        ]);

        return response()->json([
            'data' => [
                'status' => 'imported',
                'cohort_definition' => $cohort,
                'artifact' => $artifact,
            ],
            'message' => 'Cohort authoring artifact imported.',
        ], 201);
    }

    /**
     * GET /v1/cohort-definitions/{cohortDefinition}/authoring/export
     */
    public function export(Request $request, CohortDefinition $cohortDefinition): JsonResponse
    {
        $validated = $request->validate([
            'format' => ['required', 'string'],
        ]);

        $payload = $this->service->export($cohortDefinition, $validated['format']);

        $artifact = CohortAuthoringArtifact::create([
            'cohort_definition_id' => $cohortDefinition->id,
            'author_id' => $request->user()?->id,
            'direction' => 'export',
            'format' => $payload['format'],
            'artifact_json' => is_array($payload['content']) ? $payload['content'] : ['raw' => $payload['content']],
            'metadata_json' => [
                'mime_type' => $payload['mime_type'] ?? null,
                'download_name' => $payload['download_name'] ?? null,
            ],
        ]);

        return response()->json([
            'data' => $payload + ['artifact_id' => $artifact->id],
        ]);
    }

    private function suffixedName(string $baseName): string
    {
        $counter = 2;
        while (CohortDefinition::query()->where('name', "{$baseName} ({$counter})")->exists()) {
            $counter++;
        }

        return "{$baseName} ({$counter})";
    }
}
