<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Database\Connection;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * @group Morpheus Datasets
 */
class MorpheusDatasetController extends Controller
{
    /**
     * The Morpheus registry lives at a fixed location (inpatient_ext schema).
     * Connection is resolved via config('morpheus.connection') — 'inpatient'
     * in production, 'inpatient_testing' in the test env — so the registry
     * reads and writes stay on the right database.
     *
     * The earlier SourceAware-based implementation was incorrect because the
     * /morpheus/datasets route is not wrapped in ResolveSourceContext
     * middleware, so $this->cdm() always threw "Source context required".
     */
    private function registry(): Connection
    {
        return DB::connection(config('morpheus.connection'));
    }

    public function index(): JsonResponse
    {
        $datasets = $this->registry()->select("
            SELECT dataset_id, name, schema_name, description, source_type,
                   patient_count, status, created_at
            FROM inpatient_ext.morpheus_dataset
            WHERE status = 'active'
            ORDER BY name
        ");

        return response()->json(['data' => $datasets]);
    }

    public function show(int $datasetId): JsonResponse
    {
        $dataset = $this->registry()->selectOne("
            SELECT dataset_id, name, schema_name, description, source_type,
                   patient_count, status, created_at
            FROM inpatient_ext.morpheus_dataset
            WHERE dataset_id = ? AND status = 'active'
        ", [$datasetId]);

        if (! $dataset) {
            return response()->json(['error' => 'Dataset not found'], 404);
        }

        return response()->json(['data' => $dataset]);
    }
}
