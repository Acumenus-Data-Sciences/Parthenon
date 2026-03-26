<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Enums\IngestionStep;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CreateIngestionProjectRequest;
use App\Http\Requests\Api\StageFilesRequest;
use App\Jobs\Ingestion\StageFileJob;
use App\Models\App\IngestionJob;
use App\Models\App\IngestionProject;
use App\Services\Ingestion\FileUploadService;
use App\Services\Ingestion\StagingService;
use App\Services\Ingestion\StagingSourceService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

#[Group('Ingestion Projects', weight: 201)]
class IngestionProjectController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly StagingService $stagingService,
        private readonly FileUploadService $fileUploadService,
    ) {}

    /**
     * List ingestion projects for the authenticated user with pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = IngestionProject::with('jobs')
            ->orderBy('created_at', 'desc');

        // Non-admins only see their own projects
        $user = $request->user();
        if (! $user->hasRole(['admin', 'super-admin'])) {
            $query->where('created_by', $user->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $projects = $query->paginate($request->input('per_page', 15));

        return response()->json($projects);
    }

    /**
     * Create a new ingestion project.
     */
    public function store(CreateIngestionProjectRequest $request): JsonResponse
    {
        $project = IngestionProject::create([
            'name' => $request->validated('name'),
            'source_id' => $request->validated('source_id'),
            'notes' => $request->validated('notes'),
            'status' => 'draft',
            'created_by' => $request->user()->id,
            'file_count' => 0,
            'total_size_bytes' => 0,
        ]);

        return response()->json(['data' => $project], 201);
    }

    /**
     * Show a single ingestion project with its jobs and profiles.
     */
    public function show(IngestionProject $project): JsonResponse
    {
        $this->authorize('view', $project);

        return response()->json([
            'data' => $project->load('jobs.profiles'),
        ]);
    }

    /**
     * Update an ingestion project's name or notes.
     */
    public function update(Request $request, IngestionProject $project): JsonResponse
    {
        $this->authorize('update', $project);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $project->update($validated);

        return response()->json(['data' => $project->fresh()]);
    }

    /**
     * Soft-delete an ingestion project.
     */
    public function destroy(IngestionProject $project): JsonResponse
    {
        $this->authorize('delete', $project);

        app(StagingSourceService::class)->cleanupStagingSource($project);
        $project->delete();

        return response()->json(null, 204);
    }

    /**
     * Upload and stage files for an ingestion project.
     *
     * Creates an IngestionJob per file and dispatches StageFileJob for each.
     */
    public function stage(StageFilesRequest $request, IngestionProject $project): JsonResponse
    {
        $this->authorize('update', $project);

        $files = $request->file('files');
        $tableNames = $request->validated('table_names');
        $jobIds = [];
        $totalSize = $project->total_size_bytes ?? 0;

        foreach ($files as $index => $file) {
            $tableName = $tableNames[$index] ?? 'table_'.$index;

            $ingestionJob = IngestionJob::create([
                'source_id' => $project->source_id,
                'ingestion_project_id' => $project->id,
                'status' => ExecutionStatus::Queued,
                'current_step' => IngestionStep::Profiling,
                'progress_percentage' => 0,
                'created_by' => $request->user()->id,
            ]);

            $fileData = $this->fileUploadService->store($file, $ingestionJob->id);

            $ingestionJob->profiles()->create([
                'file_name' => $fileData['file_name'],
                'file_format' => $fileData['file_format'],
                'file_size' => $fileData['file_size'],
                'storage_path' => $fileData['storage_path'],
                'format_metadata' => $fileData['format_metadata'],
            ]);

            $totalSize += $fileData['file_size'];

            // Resolve relative storage path to absolute for the staging service
            $absolutePath = Storage::disk('ingestion')->path($fileData['storage_path']);

            StageFileJob::dispatch(
                $project,
                $ingestionJob,
                $absolutePath,
                $tableName,
                $fileData['file_format'],
            );

            $jobIds[] = $ingestionJob->id;
        }

        $project->update([
            'status' => 'profiling',
            'file_count' => $project->jobs()->count(),
            'total_size_bytes' => $totalSize,
        ]);

        return response()->json([
            'message' => count($jobIds).' file(s) queued for staging.',
            'job_ids' => $jobIds,
            'project' => $project->fresh()->load('jobs'),
        ], 202);
    }

    /**
     * Remove a staged file from a project.
     */
    public function removeFile(IngestionProject $project, IngestionJob $job): JsonResponse
    {
        $this->authorize('update', $project);

        if ($job->ingestion_project_id !== $project->id) {
            return response()->json(['message' => 'Job does not belong to this project.'], 404);
        }

        // Drop the staging table if it exists
        if ($job->staging_table_name) {
            $this->stagingService->dropTable(
                $project->staging_schema,
                $job->staging_table_name,
            );
        }

        // Clean up uploaded files
        $this->fileUploadService->delete($job->id);

        $job->delete();

        // Recompute project stats
        $project->update([
            'file_count' => $project->jobs()->count(),
        ]);

        return response()->json(null, 204);
    }

    /**
     * Preview rows from a staged table within a project.
     */
    public function preview(Request $request, IngestionProject $project, string $table): JsonResponse
    {
        $this->authorize('view', $project);

        // Validate that the table belongs to this project's jobs
        $validTable = $project->jobs()
            ->where('staging_table_name', $table)
            ->exists();

        if (! $validTable) {
            return response()->json(['message' => 'Table not found in this project.'], 404);
        }

        $limit = min((int) $request->input('limit', 100), 1000);
        $offset = max((int) $request->input('offset', 0), 0);

        $preview = $this->stagingService->previewTable(
            $project->staging_schema,
            $table,
            $limit,
            $offset,
        );

        return response()->json(['data' => $preview]);
    }
}
