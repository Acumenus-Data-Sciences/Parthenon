<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreSourceRequest;
use App\Models\App\Source;
use App\Services\Database\DynamicConnectionFactory;
use App\Services\WebApi\WebApiImporterService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Data Sources', weight: 20)]
class SourceController extends Controller
{
    /** Dialects that are proxied through the R service — no PHP PDO connection needed. */
    private const R_PROXY_DIALECTS = ['databricks', 'bigquery', 'duckdb'];

    public function __construct(
        private readonly WebApiImporterService $importer,
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $sources = Source::with('daimons')
            ->visibleToUser($request->user())
            ->get();

        return response()->json($sources);
    }

    public function store(StoreSourceRequest $request): JsonResponse
    {
        $source = Source::create($request->validated());

        if ($request->has('daimons')) {
            foreach ($request->input('daimons') as $daimon) {
                $source->daimons()->create($daimon);
            }
        }

        return response()->json($source->load('daimons'), 201);
    }

    public function show(Source $source): JsonResponse
    {
        return response()->json($source->load('daimons'));
    }

    public function update(StoreSourceRequest $request, Source $source): JsonResponse
    {
        $source->update($request->validated());

        if ($request->has('daimons')) {
            $source->daimons()->delete();
            foreach ($request->input('daimons') as $daimon) {
                $source->daimons()->create($daimon);
            }
        }

        return response()->json($source->load('daimons'));
    }

    public function destroy(Source $source): JsonResponse
    {
        $source->delete();

        return response()->json(null, 204);
    }

    /**
     * PUT /v1/sources/{source}/set-default
     *
     * Mark a source as the default CDM. Clears is_default on all other sources.
     */
    public function setDefault(Source $source): JsonResponse
    {
        Source::where('is_default', true)->update(['is_default' => false]);
        $source->update(['is_default' => true]);

        return response()->json($source->load('daimons'));
    }

    /**
     * DELETE /v1/sources/default
     *
     * Clear the default CDM source (no source is default).
     */
    public function clearDefault(): JsonResponse
    {
        Source::where('is_default', true)->update(['is_default' => false]);

        return response()->json(null, 204);
    }

    /**
     * POST /v1/sources/test-connection
     *
     * Validate connectivity with the supplied source credentials without persisting.
     * R-proxied dialects (databricks, bigquery, duckdb) always return success=true
     * because connectivity is verified at analysis time by the R service.
     */
    public function testConnection(StoreSourceRequest $request): JsonResponse
    {
        $dialect = $request->input('source_dialect');

        if (in_array($dialect, self::R_PROXY_DIALECTS)) {
            return response()->json([
                'success' => true,
                'latency_ms' => 0,
                'error' => null,
                'note' => 'Connectivity for this dialect is verified by the R service at analysis time.',
            ]);
        }

        // Build a temporary (unsaved) Source to test against
        $source = new Source($request->validated());
        $result = $this->connectionFactory->testConnection($source);

        $status = $result['success'] ? 200 : 422;

        return response()->json($result, $status);
    }

    /**
     * POST /v1/sources/import-webapi
     *
     * Import sources from a legacy OHDSI WebAPI instance.
     */
    public function importWebApi(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'webapi_url' => 'required|url',
            'auth_type' => 'string|in:none,basic,bearer',
            'auth_credentials' => 'nullable|string',
        ]);

        try {
            $result = $this->importer->importFromUrl(
                $validated['webapi_url'],
                $validated['auth_type'] ?? 'none',
                $validated['auth_credentials'] ?? null,
            );

            return response()->json(['data' => $result]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to import from WebAPI',
                'message' => $e->getMessage(),
            ], 502);
        }
    }
}
