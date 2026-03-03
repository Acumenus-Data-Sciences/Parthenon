<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreSourceRequest;
use App\Models\App\Source;
use App\Services\WebApi\WebApiImporterService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Data Sources', weight: 20)]
class SourceController extends Controller
{
    public function __construct(
        private readonly WebApiImporterService $importer,
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
