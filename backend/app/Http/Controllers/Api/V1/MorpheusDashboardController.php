<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Morpheus\MorpheusDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * @group Morpheus Dashboard
 */
class MorpheusDashboardController extends Controller
{
    public function __construct(
        private readonly MorpheusDashboardService $service,
    ) {}

    /**
     * Resolve and validate the dataset schema name from the request.
     * Looks up the schema_name in the morpheus_dataset registry to ensure
     * it exists and is active. Falls back to 'mimiciv' if not provided.
     */
    private function resolveSchema(Request $request): string
    {
        $schemaName = $request->input('dataset', 'mimiciv');

        $dataset = DB::connection('inpatient')->selectOne("
            SELECT schema_name FROM inpatient_ext.morpheus_dataset
            WHERE schema_name = ? AND status = 'active'
        ", [$schemaName]);

        if (! $dataset) {
            abort(404, 'Dataset not found or not active');
        }

        return $dataset->schema_name;
    }

    public function metrics(Request $request): JsonResponse
    {
        $schema = $this->resolveSchema($request);

        return response()->json(['data' => $this->service->getMetrics($schema)]);
    }

    public function trends(Request $request): JsonResponse
    {
        $schema = $this->resolveSchema($request);

        return response()->json(['data' => $this->service->getTrends($schema)]);
    }

    public function topDiagnoses(Request $request): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $limit = max(1, min($request->integer('limit', 10), 50));

        return response()->json(['data' => $this->service->getTopDiagnoses($limit, $schema)]);
    }

    public function topProcedures(Request $request): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $limit = max(1, min($request->integer('limit', 10), 50));

        return response()->json(['data' => $this->service->getTopProcedures($limit, $schema)]);
    }

    public function demographics(Request $request): JsonResponse
    {
        $schema = $this->resolveSchema($request);

        return response()->json(['data' => $this->service->getDemographics($schema)]);
    }

    public function losDistribution(Request $request): JsonResponse
    {
        $schema = $this->resolveSchema($request);

        return response()->json(['data' => $this->service->getLosDistribution($schema)]);
    }

    public function icuUnits(Request $request): JsonResponse
    {
        $schema = $this->resolveSchema($request);

        return response()->json(['data' => $this->service->getIcuUnits($schema)]);
    }

    public function mortalityByType(Request $request): JsonResponse
    {
        $schema = $this->resolveSchema($request);

        return response()->json(['data' => $this->service->getMortalityByType($schema)]);
    }

    public function conceptStats(Request $request, int $conceptId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $stats = $this->service->getConceptStats($schema, $conceptId);

        if (! $stats) {
            return response()->json(['data' => null, 'message' => 'No data available for this concept'], 200);
        }

        return response()->json(['data' => $stats]);
    }
}
