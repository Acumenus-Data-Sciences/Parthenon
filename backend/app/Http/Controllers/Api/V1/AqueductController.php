<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Aqueduct\AqueductGenerateLookupsRequest;
use App\Services\Aqueduct\AqueductService;
use Illuminate\Http\JsonResponse;

class AqueductController extends Controller
{
    public function __construct(
        private readonly AqueductService $aqueduct,
    ) {}

    public function listVocabularies(): JsonResponse
    {
        return response()->json([
            'data' => ['vocabularies' => $this->aqueduct->lookups()->listVocabularies()],
        ]);
    }

    public function previewLookup(string $vocabulary): JsonResponse
    {
        if (! $this->aqueduct->lookups()->vocabularyExists($vocabulary)) {
            return response()->json(['message' => "Unknown vocabulary: {$vocabulary}"], 404);
        }

        $sql = $this->aqueduct->lookups()->assembleLookupSql($vocabulary, 'vocab');

        return response()->json([
            'data' => [
                'vocabulary' => $vocabulary,
                'sql' => $sql,
                'includes_source_to_source' => true,
            ],
        ]);
    }

    public function generateLookups(AqueductGenerateLookupsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $vocabSchema = $validated['vocab_schema'] ?? 'vocab';
        $includeS2S = $validated['include_source_to_source'] ?? true;

        $invalid = array_filter(
            $validated['vocabularies'],
            fn (string $v) => ! $this->aqueduct->lookups()->vocabularyExists($v),
        );

        if (! empty($invalid)) {
            return response()->json([
                'message' => 'Unknown vocabularies: ' . implode(', ', $invalid),
            ], 422);
        }

        $result = $this->aqueduct->lookups()->generateResultEnvelope(
            $validated['vocabularies'],
            $vocabSchema,
            $includeS2S,
        );

        return response()->json(['data' => $result]);
    }
}
