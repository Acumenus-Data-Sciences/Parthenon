<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\AtlasMigration;
use App\Services\WebApi\AtlasDiscoveryService;
use App\Services\WebApi\AtlasEntityImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Administration
 */
class AtlasMigrationController extends Controller
{
    public function __construct(
        private readonly AtlasDiscoveryService $discovery,
        private readonly AtlasEntityImporter $importer,
    ) {}

    /**
     * POST /admin/atlas-migration/test-connection
     *
     * Test connectivity to an OHDSI WebAPI instance.
     */
    public function testConnection(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'webapi_url' => 'required|url|max:500',
            'auth_type' => 'string|in:none,basic,bearer',
            'auth_credentials' => 'nullable|string',
        ]);

        $result = $this->discovery->testConnection(
            $validated['webapi_url'],
            $validated['auth_type'] ?? 'none',
            $validated['auth_credentials'] ?? null,
        );

        return response()->json(['data' => $result]);
    }

    /**
     * POST /admin/atlas-migration/discover
     *
     * Discover all entity inventories from a WebAPI instance.
     */
    public function discover(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'webapi_url' => 'required|url|max:500',
            'auth_type' => 'string|in:none,basic,bearer',
            'auth_credentials' => 'nullable|string',
        ]);

        $inventory = $this->discovery->discover(
            $validated['webapi_url'],
            $validated['auth_type'] ?? 'none',
            $validated['auth_credentials'] ?? null,
        );

        return response()->json(['data' => $inventory]);
    }

    /**
     * POST /admin/atlas-migration/start
     *
     * Start a migration from an Atlas/WebAPI instance.
     */
    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'webapi_url' => 'required|url|max:500',
            'webapi_name' => 'nullable|string|max:255',
            'auth_type' => 'string|in:none,basic,bearer',
            'auth_credentials' => 'nullable|string',
            'selected_entities' => 'required|array',
            'selected_entities.concept_sets' => 'array',
            'selected_entities.concept_sets.*' => 'integer',
            'selected_entities.cohort_definitions' => 'array',
            'selected_entities.cohort_definitions.*' => 'integer',
            'selected_entities.incidence_rates' => 'array',
            'selected_entities.incidence_rates.*' => 'integer',
            'selected_entities.characterizations' => 'array',
            'selected_entities.characterizations.*' => 'integer',
            'selected_entities.pathways' => 'array',
            'selected_entities.pathways.*' => 'integer',
            'selected_entities.estimations' => 'array',
            'selected_entities.estimations.*' => 'integer',
            'selected_entities.predictions' => 'array',
            'selected_entities.predictions.*' => 'integer',
        ]);

        $migration = AtlasMigration::create([
            'webapi_url' => $validated['webapi_url'],
            'webapi_name' => $validated['webapi_name'] ?? null,
            'auth_type' => $validated['auth_type'] ?? 'none',
            'auth_credentials' => $validated['auth_credentials'] ?? null,
            'selected_entities' => $validated['selected_entities'],
            'created_by' => $request->user()->id,
        ]);

        // Run synchronously — frontend polls /status for updates
        $this->importer->import($migration);

        $migration->refresh();

        return response()->json(['data' => $migration], 201);
    }

    /**
     * GET /admin/atlas-migration/{migration}/status
     *
     * Get current migration status with progress and mappings.
     */
    public function status(AtlasMigration $migration): JsonResponse
    {
        $migration->load('idMappings');

        $mappingSummary = $migration->idMappings
            ->groupBy('entity_type')
            ->map(fn ($group) => [
                'imported' => $group->where('status', 'imported')->count(),
                'skipped' => $group->where('status', 'skipped')->count(),
                'failed' => $group->where('status', 'failed')->count(),
                'total' => $group->count(),
            ]);

        return response()->json([
            'data' => [
                ...$migration->toArray(),
                'mapping_summary' => $mappingSummary,
            ],
        ]);
    }

    /**
     * GET /admin/atlas-migration/history
     *
     * List past migration runs.
     */
    public function history(): JsonResponse
    {
        $migrations = AtlasMigration::with('createdBy:id,name')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json(['data' => $migrations]);
    }

    /**
     * POST /admin/atlas-migration/{migration}/retry
     *
     * Retry failed entities in a migration.
     */
    public function retry(AtlasMigration $migration): JsonResponse
    {
        if ($migration->status !== 'failed' && $migration->status !== 'completed') {
            return response()->json([
                'error' => 'Can only retry failed or completed migrations',
            ], 422);
        }

        // Get failed entity IDs grouped by type
        $failedMappings = $migration->idMappings()
            ->where('status', 'failed')
            ->get()
            ->groupBy('entity_type');

        if ($failedMappings->isEmpty()) {
            return response()->json([
                'data' => $migration,
                'message' => 'No failed entities to retry',
            ]);
        }

        // Build selected_entities from failed items only
        $retrySelection = [];
        foreach ($failedMappings as $type => $mappings) {
            $entityKey = match ($type) {
                'concept_set' => 'concept_sets',
                'cohort_definition' => 'cohort_definitions',
                'incidence_rate' => 'incidence_rates',
                default => $type.'s',
            };
            $retrySelection[$entityKey] = $mappings->pluck('atlas_id')->toArray();
        }

        // Remove failed mappings so they can be re-imported
        $migration->idMappings()->where('status', 'failed')->delete();

        $migration->update([
            'selected_entities' => $retrySelection,
            'status' => 'pending',
            'error_message' => null,
            'failed_entities' => 0,
        ]);

        $this->importer->import($migration);

        $migration->refresh();

        return response()->json(['data' => $migration]);
    }
}
