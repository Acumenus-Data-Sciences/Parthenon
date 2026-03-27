<?php

namespace App\Http\Controllers\Api\V1;

use App\Concerns\SourceAware;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\SaveMappingProjectRequest;
use App\Http\Requests\Api\SaveMappingsRequest;
use App\Models\App\MappingProject;
use App\Models\User;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('Ariadne Concept Mapping', weight: 226)]
class AriadneController extends Controller
{
    use SourceAware;

    private string $aiUrl;

    public function __construct()
    {
        $this->aiUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * POST /api/v1/ariadne/map
     *
     * Map free-text terms or source codes to standard OMOP concepts using
     * Ariadne's LLM-assisted concept mapping pipeline.
     * Proxies to the Python AI service at POST /ariadne/map.
     *
     * Accepts any JSON body; the AI service defines the schema.
     */
    public function map(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(120)
                ->withBody($request->getContent(), 'application/json')
                ->post("{$this->aiUrl}/ariadne/map");

            if ($response->failed()) {
                Log::warning('Ariadne map failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Concept mapping failed',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('AriadneController::map exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Ariadne service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * POST /api/v1/ariadne/clean-terms
     *
     * Normalise and clean raw source terms before concept mapping.
     * Proxies to the Python AI service at POST /ariadne/clean-terms.
     *
     * Accepts any JSON body; the AI service defines the schema.
     */
    public function cleanTerms(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(60)
                ->withBody($request->getContent(), 'application/json')
                ->post("{$this->aiUrl}/ariadne/clean-terms");

            if ($response->failed()) {
                Log::warning('Ariadne cleanTerms failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Term cleaning failed',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('AriadneController::cleanTerms exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Ariadne service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * POST /api/v1/ariadne/vector-search
     *
     * Vector similarity search over the OMOP concept embedding index.
     * Proxies to the Python AI service at POST /ariadne/vector-search.
     *
     * Accepts any JSON body; the AI service defines the schema.
     */
    public function vectorSearch(Request $request): JsonResponse
    {
        try {
            $response = Http::timeout(30)
                ->withBody($request->getContent(), 'application/json')
                ->post("{$this->aiUrl}/ariadne/vector-search");

            if ($response->failed()) {
                Log::warning('Ariadne vectorSearch failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Vector search failed',
                    'detail' => $response->json('detail') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('AriadneController::vectorSearch exception', ['message' => $e->getMessage()]);

            return response()->json([
                'error' => 'Ariadne service unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * POST /api/v1/ariadne/save-mappings
     *
     * Insert accepted mappings into the OMOP source_to_concept_map table.
     */
    public function saveMappings(SaveMappingsRequest $request): JsonResponse
    {
        /** @var array<int, array{source_code: string, source_code_description?: string|null, target_concept_id: int, target_vocabulary_id: string, source_vocabulary_id?: string, source_concept_id?: int}> $mappings */
        $mappings = $request->validated('mappings');
        $today = Carbon::today()->toDateString();

        $rows = array_map(fn (array $m): array => [
            'source_code' => $m['source_code'],
            'source_concept_id' => $m['source_concept_id'] ?? 0,
            'source_vocabulary_id' => $m['source_vocabulary_id'] ?? 'Ariadne',
            'source_code_description' => $m['source_code_description'] ?? null,
            'target_concept_id' => $m['target_concept_id'],
            'target_vocabulary_id' => $m['target_vocabulary_id'],
            'valid_start_date' => $today,
            'valid_end_date' => '2099-12-31',
            'invalid_reason' => null,
        ], $mappings);

        $this->vocab()->transaction(function () use ($rows): void {
            $this->vocab()->table('source_to_concept_map')->insert($rows);
        });

        return response()->json(['saved' => count($rows)]);
    }

    /**
     * POST /api/v1/ariadne/projects
     *
     * Save a mapping session as a reusable project.
     */
    public function saveProject(SaveMappingProjectRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $project = MappingProject::create([
            'user_id' => $user->id,
            ...$request->validated(),
        ]);

        return response()->json(['data' => $project], 201);
    }

    /**
     * GET /api/v1/ariadne/projects
     *
     * List mapping projects for the authenticated user.
     */
    public function listProjects(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $projects = MappingProject::where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->paginate(20);

        return response()->json($projects);
    }

    /**
     * GET /api/v1/ariadne/projects/{project}
     *
     * Load a single mapping project (ownership-verified).
     */
    public function loadProject(Request $request, int $project): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $record = MappingProject::where('user_id', $user->id)->findOrFail($project);

        return response()->json(['data' => $record]);
    }
}
