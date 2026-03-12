<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('Circe Cohort Compiler', weight: 215)]
class CirceController extends Controller
{
    private string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * Compile cohort definition to SQL.
     *
     * Compiles an OHDSI cohort definition JSON into executable SQL
     * using the Circepy library (Python port of circe-be).
     */
    public function compile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'expression' => 'required|array',
            'cdm_schema' => 'sometimes|string|max:64',
            'vocabulary_schema' => 'sometimes|string|max:64',
            'target_table' => 'sometimes|string|max:64',
            'result_schema' => 'sometimes|string|max:64',
            'cohort_id' => 'sometimes|integer|min:1',
            'generate_stats' => 'sometimes|boolean',
        ]);

        $response = Http::timeout(60)->post("{$this->aiServiceUrl}/circe/compile", $validated);

        if ($response->failed()) {
            Log::error('Circe compile failed', ['status' => $response->status(), 'body' => $response->body()]);

            return response()->json(['error' => 'Failed to compile cohort definition', 'detail' => $response->json('detail')], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Validate cohort definition.
     *
     * Runs 24 validation checks on a cohort definition JSON including
     * unused concepts, empty concept sets, time window issues, and more.
     */
    public function validate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'expression' => 'required|array',
        ]);

        $response = Http::timeout(30)->post("{$this->aiServiceUrl}/circe/validate", $validated);

        if ($response->failed()) {
            Log::error('Circe validate failed', ['status' => $response->status(), 'body' => $response->body()]);

            return response()->json(['error' => 'Failed to validate cohort definition'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Render cohort definition as markdown.
     *
     * Produces a human-readable markdown description of the cohort logic.
     */
    public function render(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'expression' => 'required|array',
        ]);

        $response = Http::timeout(30)->post("{$this->aiServiceUrl}/circe/render", $validated);

        if ($response->failed()) {
            Log::error('Circe render failed', ['status' => $response->status(), 'body' => $response->body()]);

            return response()->json(['error' => 'Failed to render cohort definition'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }
}
