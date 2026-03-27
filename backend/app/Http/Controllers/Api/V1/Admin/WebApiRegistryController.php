<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\WebApiRegistry;
use App\Services\WebApi\WebApiImporterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Administration
 */
class WebApiRegistryController extends Controller
{
    public function __construct(
        private readonly WebApiImporterService $importer,
    ) {}

    public function index(): JsonResponse
    {
        $registries = WebApiRegistry::orderBy('name')->get();

        return response()->json(['data' => $registries]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'base_url' => 'required|url|max:500',
            'auth_type' => 'string|in:none,basic,bearer',
            'auth_credentials' => 'nullable|string',
        ]);

        $validated['created_by'] = $request->user()->id;

        $registry = WebApiRegistry::create($validated);

        return response()->json(['data' => $registry], 201);
    }

    public function show(WebApiRegistry $registry): JsonResponse
    {
        return response()->json(['data' => $registry]);
    }

    public function update(Request $request, WebApiRegistry $registry): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'string|max:255',
            'base_url' => 'url|max:500',
            'auth_type' => 'string|in:none,basic,bearer',
            'auth_credentials' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $registry->update($validated);

        return response()->json(['data' => $registry]);
    }

    public function destroy(WebApiRegistry $registry): JsonResponse
    {
        $registry->delete();

        return response()->json(null, 204);
    }

    /**
     * POST /v1/admin/webapi-registries/{registry}/sync
     *
     * Trigger a source import from this registry.
     */
    public function sync(WebApiRegistry $registry): JsonResponse
    {
        try {
            $result = $this->importer->importFromRegistry($registry);

            return response()->json(['data' => $result]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Sync failed',
                'message' => $e->getMessage(),
            ], 502);
        }
    }
}
