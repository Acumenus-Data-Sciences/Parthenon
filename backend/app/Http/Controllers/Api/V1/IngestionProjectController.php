<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Enums\IngestionStep;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CreateIngestionProjectRequest;
use App\Http\Requests\Api\StageFilesRequest;
use App\Jobs\Ingestion\StageFileJob;
use App\Models\App\FieldProfile;
use App\Models\App\IngestionJob;
use App\Models\App\IngestionProject;
use App\Models\App\SourceProfile;
use App\Services\Ingestion\FileUploadService;
use App\Services\Ingestion\StagingService;
use App\Services\Ingestion\StagingSourceService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * @group Ingestion Projects
 */
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

        // Check if this is a database-connected table (no local staging schema)
        $config = $project->db_connection_config;
        $selectedTables = $project->selected_tables ?? [];

        if ($config && in_array($table, $selectedTables, true)) {
            // Query the source database directly via BlackRabbit-style connection
            try {
                $dsn = sprintf(
                    'pgsql:host=%s;port=%s;dbname=%s',
                    $config['host'],
                    $config['port'],
                    $config['database'],
                );
                $pdo = new \PDO($dsn, $config['user'] ?? '', $config['password'] ?? '');
                $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

                $schema = $config['schema'];
                $stmt = $pdo->prepare("SELECT * FROM \"{$schema}\".\"{$table}\" LIMIT :limit OFFSET :offset");
                $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
                $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
                $stmt->execute();
                $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

                // Get column names
                $columns = $rows ? array_keys($rows[0]) : [];

                // Get total count
                $countStmt = $pdo->query("SELECT COUNT(*) FROM \"{$schema}\".\"{$table}\"");
                $totalRows = (int) $countStmt->fetchColumn();

                return response()->json(['data' => [
                    'columns' => $columns,
                    'rows' => $rows,
                    'total' => $totalRows,
                ]]);
            } catch (\Throwable $e) {
                Log::warning('Database preview failed', [
                    'project_id' => $project->id,
                    'table' => $table,
                    'error' => $e->getMessage(),
                ]);

                return response()->json([
                    'error' => 'Preview failed',
                    'message' => $e->getMessage(),
                ], 500);
            }
        }

        // File-based staging: query local staging schema
        $preview = $this->stagingService->previewTable(
            $project->staging_schema,
            $table,
            $limit,
            $offset,
        );

        return response()->json(['data' => $preview]);
    }

    /**
     * GET /ingestion-projects/{project}/fields
     *
     * Return all field profiles across all jobs in the project.
     */
    public function fields(IngestionProject $project): JsonResponse
    {
        $this->authorize('view', $project);

        $fields = FieldProfile::whereHas('sourceProfile.ingestionJob', function ($q) use ($project) {
            $q->where('ingestion_project_id', $project->id);
        })->get();

        return response()->json(['data' => $fields]);
    }

    /**
     * POST /ingestion-projects/{project}/connect-db
     *
     * Test database connection and return table list via BlackRabbit.
     */
    public function connectDb(Request $request, IngestionProject $project): JsonResponse
    {
        $validated = $request->validate([
            'dbms' => 'required|string|max:64',
            'host' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'user' => 'nullable|string|max:255',
            'password' => 'nullable|string|max:255',
            'database' => 'required|string|max:255',
            'schema' => 'required|string|max:255',
        ]);

        $blackRabbitUrl = rtrim(config('services.blackrabbit.url', 'http://blackrabbit:8090'), '/');

        try {
            $response = Http::timeout(30)->post("{$blackRabbitUrl}/tables", [
                'dbms' => $validated['dbms'],
                'server' => "{$validated['host']}/{$validated['database']}",
                'port' => $validated['port'],
                'user' => $validated['user'] ?? '',
                'password' => $validated['password'] ?? '',
                'schema' => $validated['schema'],
            ]);

            if ($response->failed()) {
                return response()->json([
                    'error' => 'Connection failed',
                    'message' => $response->json('detail') ?? 'Unable to connect to database.',
                ], 422);
            }

            $project->update([
                'db_connection_config' => $validated,
            ]);

            return response()->json([
                'data' => [
                    'connected' => true,
                    'tables' => $response->json('tables') ?? [],
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Database connection test failed', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Connection failed',
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * POST /ingestion-projects/{project}/confirm-tables
     *
     * Save selected table list on the project.
     */
    public function confirmTables(Request $request, IngestionProject $project): JsonResponse
    {
        $validated = $request->validate([
            'tables' => 'required|array|min:1',
            'tables.*' => 'string|max:255',
        ]);

        $project->update([
            'selected_tables' => $validated['tables'],
        ]);

        return response()->json([
            'data' => [
                'tables' => $validated['tables'],
                'count' => count($validated['tables']),
            ],
        ]);
    }

    /**
     * POST /ingestion-projects/{project}/stage-db
     *
     * Trigger BlackRabbit scan on selected tables, persist results.
     */
    public function stageDb(IngestionProject $project): JsonResponse
    {
        $config = $project->db_connection_config;
        $tables = $project->selected_tables;

        if (! $config || ! $tables) {
            return response()->json([
                'error' => 'No database connection or tables configured',
            ], 422);
        }

        $blackRabbitUrl = rtrim(config('services.blackrabbit.url', 'http://blackrabbit:8090'), '/');

        try {
            $scanPayload = [
                'dbms' => $config['dbms'],
                'server' => "{$config['host']}/{$config['database']}",
                'port' => (int) $config['port'],
                'user' => $config['user'] ?? '',
                'password' => $config['password'] ?? '',
                'schema' => $config['schema'],
                'tables' => $tables,
            ];

            $startResp = Http::timeout(30)->post("{$blackRabbitUrl}/scan", $scanPayload);
            if ($startResp->failed()) {
                throw new \RuntimeException('BlackRabbit scan failed to start: '.($startResp->json('detail') ?? $startResp->body()));
            }

            $scanId = $startResp->json('scan_id');

            // Poll for result
            $maxWait = 600;
            $waited = 0;
            $scanData = null;
            while ($waited < $maxWait) {
                usleep(500_000);
                $waited += 0.5;

                $resultResp = Http::timeout(10)->get("{$blackRabbitUrl}/scan/{$scanId}/result");
                if ($resultResp->status() === 404) {
                    continue;
                }
                if ($resultResp->successful()) {
                    $scanData = $resultResp->json();

                    break;
                }
                if ($resultResp->status() === 410) {
                    throw new \RuntimeException('Scan expired');
                }
            }

            if (! $scanData) {
                throw new \RuntimeException('Scan timed out');
            }

            $jobIds = [];
            foreach ($scanData['tables'] ?? [] as $tableData) {
                $tableName = $tableData['table_name'] ?? '';
                if (! $tableName) {
                    continue;
                }

                $job = IngestionJob::create([
                    'ingestion_project_id' => $project->id,
                    'status' => ExecutionStatus::Completed,
                    'current_step' => IngestionStep::Profiling,
                    'progress_percentage' => 100,
                    'staging_table_name' => $tableName,
                    'created_by' => auth()->id(),
                    'stats_json' => [
                        'staging_table_name' => $tableName,
                        'row_count' => $tableData['row_count'] ?? 0,
                        'column_count' => $tableData['column_count'] ?? 0,
                        'source' => 'database',
                    ],
                ]);

                $profile = SourceProfile::create([
                    'ingestion_job_id' => $job->id,
                    'scan_type' => 'blackrabbit',
                    'table_count' => 1,
                    'column_count' => $tableData['column_count'] ?? 0,
                    'total_rows' => $tableData['row_count'] ?? 0,
                    'row_count' => $tableData['row_count'] ?? 0,
                    'scan_time_seconds' => $scanData['scan_time_seconds'] ?? 0,
                    'overall_grade' => 'A',
                ]);

                foreach ($tableData['columns'] ?? [] as $idx => $col) {
                    FieldProfile::create([
                        'source_profile_id' => $profile->id,
                        'table_name' => $tableName,
                        'row_count' => $tableData['row_count'] ?? 0,
                        'column_name' => $col['name'],
                        'column_index' => $idx,
                        'inferred_type' => $col['type'] ?? 'unknown',
                        'non_null_count' => $col['non_null_count'] ?? 0,
                        'null_count' => $col['null_count'] ?? 0,
                        'null_percentage' => $col['null_percentage'] ?? 0,
                        'distinct_count' => $col['distinct_count'] ?? 0,
                        'distinct_percentage' => $col['distinct_percentage'] ?? 0,
                        'sample_values' => $col['top_values'] ?? null,
                    ]);
                }

                $jobIds[] = ['id' => $job->id, 'staging_table_name' => $tableName];
            }

            $project->update([
                'status' => 'ready',
                'file_count' => count($jobIds),
            ]);

            return response()->json([
                'data' => ['jobs' => $jobIds],
                'message' => 'Database tables profiled and staged.',
            ]);
        } catch (\Throwable $e) {
            Log::error('Database staging failed', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Database staging failed',
                'message' => $e->getMessage(),
            ], 502);
        }
    }
}
