<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Morpheus\MorpheusDashboardService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Morpheus Dashboard', weight: 245)]
class MorpheusDashboardController extends Controller
{
    public function __construct(
        private readonly MorpheusDashboardService $service,
    ) {}

    public function metrics(): JsonResponse
    {
        return response()->json(['data' => $this->service->getMetrics()]);
    }

    public function trends(): JsonResponse
    {
        return response()->json(['data' => $this->service->getTrends()]);
    }

    public function topDiagnoses(Request $request): JsonResponse
    {
        $limit = max(1, min($request->integer('limit', 10), 50));

        return response()->json(['data' => $this->service->getTopDiagnoses($limit)]);
    }

    public function topProcedures(Request $request): JsonResponse
    {
        $limit = max(1, min($request->integer('limit', 10), 50));

        return response()->json(['data' => $this->service->getTopProcedures($limit)]);
    }

    public function demographics(): JsonResponse
    {
        return response()->json(['data' => $this->service->getDemographics()]);
    }

    public function losDistribution(): JsonResponse
    {
        return response()->json(['data' => $this->service->getLosDistribution()]);
    }

    public function icuUnits(): JsonResponse
    {
        return response()->json(['data' => $this->service->getIcuUnits()]);
    }

    public function mortalityByType(): JsonResponse
    {
        return response()->json(['data' => $this->service->getMortalityByType()]);
    }
}
