<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Services\FinnGen\FinnGenAnalysisModuleRegistry;
use Illuminate\Http\JsonResponse;

class AnalysisModuleController extends Controller
{
    public function __construct(
        private readonly FinnGenAnalysisModuleRegistry $registry,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => array_values($this->registry->all()),
        ]);
    }

    public function show(string $key): JsonResponse
    {
        $module = $this->registry->find($key);
        if (! $module) {
            return response()->json([
                'error' => [
                    'code' => 'FINNGEN_MODULE_NOT_FOUND',
                    'message' => "Analysis module '{$key}' is not registered or is disabled.",
                ],
            ], 404);
        }

        return response()->json(['data' => $module]);
    }
}
