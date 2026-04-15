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
}
