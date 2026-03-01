<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreSourceRequest;
use App\Models\App\Source;
use Illuminate\Http\JsonResponse;

class SourceController extends Controller
{
    public function index(): JsonResponse
    {
        $sources = Source::with('daimons')->get();

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

        return response()->json($source->load('daimons'));
    }

    public function destroy(Source $source): JsonResponse
    {
        $source->delete();

        return response()->json(null, 204);
    }
}
