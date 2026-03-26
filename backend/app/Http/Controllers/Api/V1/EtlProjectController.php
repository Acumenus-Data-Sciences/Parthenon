<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateEtlProjectRequest;
use App\Http\Requests\CreateTableMappingRequest;
use App\Http\Requests\UpdateEtlProjectRequest;
use App\Models\App\EtlProject;
use App\Models\App\EtlTableMapping;
use App\Models\App\Source;
use App\Models\User;
use App\Services\Etl\EtlDocumentService;
use App\Services\Etl\EtlProjectService;
use App\Services\Etl\EtlSqlGeneratorService;
use App\Services\Etl\EtlSuggestionService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class EtlProjectController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly EtlProjectService $service,
    ) {}

    /**
     * List ETL projects (scoped by ownership for non-admins).
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = EtlProject::with(['source', 'ingestionProject'])
            ->withCount('tableMappings');

        if (! $user->hasRole(['admin', 'super-admin'])) {
            $query->where('created_by', $user->id);
        }

        $projects = $query->orderByDesc('updated_at')
            ->paginate($request->integer('per_page', 15));

        return response()->json($projects);
    }

    /**
     * Create a new ETL project.
     */
    public function store(CreateEtlProjectRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        /** @var array<string, mixed> $validated */
        $validated = $request->validated();

        // Support both source_id (legacy) and ingestion_project_id (new)
        $ingestionProjectId = $validated['ingestion_project_id'] ?? null;
        $source = ! empty($validated['source_id']) ? Source::find($validated['source_id']) : null;

        // Check for existing active project
        if ($ingestionProjectId) {
            $existing = EtlProject::where('ingestion_project_id', $ingestionProjectId)
                ->where('cdm_version', $validated['cdm_version'] ?? '5.4')
                ->first();
        } elseif ($source) {
            $existing = EtlProject::where('source_id', $source->id)
                ->where('cdm_version', $validated['cdm_version'] ?? '5.4')
                ->first();
        } else {
            return response()->json([
                'error' => 'Either source_id or ingestion_project_id is required.',
            ], 422);
        }

        if ($existing) {
            return response()->json([
                'error' => 'A mapping project already exists for this source and CDM version.',
                'existing_project_id' => $existing->id,
            ], 409);
        }

        $project = $this->service->createProject($source, $validated, $user);
        $project = $this->service->getProjectWithMappings($project);
        $progress = $this->service->computeProgress($project);

        return response()->json([
            'data' => $project,
            'progress' => $progress,
        ], 201);
    }

    /**
     * Show a single ETL project with mappings and progress.
     */
    public function show(EtlProject $project): JsonResponse
    {
        $this->authorize('view', $project);

        $project = $this->service->getProjectWithMappings($project);
        $progress = $this->service->computeProgress($project);

        return response()->json([
            'data' => $project,
            'progress' => $progress,
        ]);
    }

    /**
     * Update an ETL project.
     */
    public function update(UpdateEtlProjectRequest $request, EtlProject $project): JsonResponse
    {
        $this->authorize('update', $project);

        /** @var array<string, mixed> $validated */
        $validated = $request->validated();

        $project->update(array_filter($validated, fn ($v) => $v !== null));

        return response()->json([
            'data' => $project->fresh(),
        ]);
    }

    /**
     * Soft-delete an ETL project.
     */
    public function destroy(EtlProject $project): JsonResponse
    {
        $this->authorize('delete', $project);

        $project->delete();

        return response()->json(['message' => 'Project deleted.'], 200);
    }

    /**
     * List table mappings for a project.
     */
    public function tableMappings(EtlProject $project): JsonResponse
    {
        $this->authorize('view', $project);

        $mappings = $project->tableMappings()
            ->withCount('fieldMappings')
            ->get();

        return response()->json(['data' => $mappings]);
    }

    /**
     * Create a table mapping within a project.
     */
    public function storeTableMapping(CreateTableMappingRequest $request, EtlProject $project): JsonResponse
    {
        $this->authorize('update', $project);

        /** @var array<string, mixed> $validated */
        $validated = $request->validated();

        $maxSort = $project->tableMappings()->max('sort_order') ?? 0;

        $mapping = $project->tableMappings()->create([
            ...$validated,
            'sort_order' => $maxSort + 1,
        ]);

        return response()->json(['data' => $mapping], 201);
    }

    /**
     * Update a table mapping (logic, completion status).
     */
    public function updateTableMapping(Request $request, EtlProject $project, EtlTableMapping $mapping): JsonResponse
    {
        $this->authorize('update', $project);

        if ($mapping->etl_project_id !== $project->id) {
            return response()->json(['message' => 'Resource not found.'], 404);
        }

        $validated = $request->validate([
            'logic' => ['nullable', 'string'],
            'is_completed' => ['nullable', 'boolean'],
            'source_table' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $mapping->update(array_filter($validated, fn ($v) => $v !== null));

        return response()->json(['data' => $mapping->fresh()]);
    }

    /**
     * Generate AI mapping suggestions for a project.
     */
    public function suggest(EtlProject $project): JsonResponse
    {
        $this->authorize('update', $project);

        $suggestionService = app(EtlSuggestionService::class);
        $result = $suggestionService->suggest($project);

        return response()->json([
            'data' => $result,
            'message' => "Suggested {$result['table_mappings']} table mappings and {$result['field_mappings']} field mappings.",
        ]);
    }

    /**
     * Delete a table mapping.
     */
    public function destroyTableMapping(EtlProject $project, EtlTableMapping $mapping): JsonResponse
    {
        $this->authorize('update', $project);

        if ($mapping->etl_project_id !== $project->id) {
            return response()->json(['message' => 'Resource not found.'], 404);
        }

        $mapping->delete();

        return response()->json(['message' => 'Table mapping deleted.'], 200);
    }

    /**
     * Export ETL specification as Markdown.
     */
    public function exportMarkdown(EtlProject $project): Response
    {
        $this->authorize('view', $project);

        $markdown = app(EtlDocumentService::class)->generateMarkdown($project);

        return response($markdown, 200, [
            'Content-Type' => 'text/markdown',
            'Content-Disposition' => 'attachment; filename="'.Str::slug($project->name).'-etl-spec.md"',
        ]);
    }

    /**
     * Export ETL SQL files as a zip download.
     */
    public function exportSql(EtlProject $project): Response
    {
        $this->authorize('view', $project);

        $files = app(EtlSqlGeneratorService::class)->generate($project);

        // Create a temporary zip
        $zipPath = tempnam(sys_get_temp_dir(), 'etl_sql_');
        $zip = new \ZipArchive;
        $zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        foreach ($files as $filename => $content) {
            $zip->addFromString($filename, $content);
        }
        $zip->close();

        $response = response(file_get_contents($zipPath), 200, [
            'Content-Type' => 'application/zip',
            'Content-Disposition' => 'attachment; filename="'.Str::slug($project->name).'-etl-sql.zip"',
        ]);

        unlink($zipPath);

        return $response;
    }

    /**
     * Export full project as JSON.
     */
    public function exportJson(EtlProject $project): JsonResponse
    {
        $this->authorize('view', $project);

        $project->load(['tableMappings.fieldMappings', 'source', 'scanProfile']);

        return response()->json([
            'data' => $project->toArray(),
            'exported_at' => now()->toIso8601String(),
            'aqueduct_version' => '1.0',
        ], 200, [], JSON_PRETTY_PRINT);
    }
}
