<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateFieldMappingsRequest;
use App\Models\App\EtlProject;
use App\Models\App\EtlTableMapping;
use App\Services\Etl\EtlSuggestionService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;

class EtlFieldMappingController extends Controller
{
    use AuthorizesRequests;

    /**
     * List field mappings for a table mapping.
     */
    public function index(EtlProject $project, EtlTableMapping $mapping): JsonResponse
    {
        $this->authorize('view', $project);

        if ($mapping->etl_project_id !== $project->id) {
            return response()->json(['message' => 'Resource not found.'], 404);
        }

        $fields = $mapping->fieldMappings()->get();

        return response()->json(['data' => $fields]);
    }

    /**
     * Return ranked field mapping suggestions for a table mapping without persisting.
     */
    public function suggestFields(EtlProject $project, EtlTableMapping $mapping, EtlSuggestionService $suggestionService): JsonResponse
    {
        $this->authorize('view', $project);

        if ($mapping->etl_project_id !== $project->id) {
            return response()->json(['message' => 'Resource not found.'], 404);
        }

        $suggestions = $suggestionService->suggestFieldsForTable($mapping);

        return response()->json(['data' => $suggestions]);
    }

    /**
     * Bulk upsert field mappings with optimistic locking.
     */
    public function bulkUpsert(UpdateFieldMappingsRequest $request, EtlProject $project, EtlTableMapping $mapping): JsonResponse
    {
        $this->authorize('update', $project);

        if ($mapping->etl_project_id !== $project->id) {
            return response()->json(['message' => 'Resource not found.'], 404);
        }

        // Optimistic locking: reject if client data is stale
        $clientTimestamp = $request->date('updated_at');
        if ($clientTimestamp !== null && $clientTimestamp < $mapping->updated_at) {
            return response()->json([
                'message' => 'This mapping has been modified by another user. Please refresh and try again.',
            ], 409);
        }

        /** @var array<string, mixed> $validated */
        $validated = $request->validated();

        /** @var array<int, array<string, mixed>> $fields */
        $fields = $validated['fields'];

        foreach ($fields as $field) {
            $mapping->fieldMappings()->updateOrCreate(
                [
                    'etl_table_mapping_id' => $mapping->id,
                    'target_column' => $field['target_column'],
                ],
                [
                    'source_column' => $field['source_column'] ?? null,
                    'mapping_type' => $field['mapping_type'] ?? null,
                    'logic' => $field['logic'] ?? null,
                    'is_reviewed' => $field['is_reviewed'] ?? false,
                ],
            );
        }

        // Touch updated_at so subsequent optimistic lock checks work
        $mapping->touch();

        $updatedFields = $mapping->fieldMappings()->get();

        return response()->json(['data' => $updatedFields]);
    }
}
