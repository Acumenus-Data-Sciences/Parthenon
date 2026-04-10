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
     * The Morpheus registry lives at a fixed location (inpatient_ext schema
     * on the 'inpatient' connection) and is independent of the user's
     * currently-selected CDM source. This mirrors how MorpheusDashboardController
     * and MorpheusPatientController read from 'inpatient' directly — the earlier
     * SourceAware migration was incorrect for this controller because the
     * /morpheus/datasets route is not wrapped in ResolveSourceContext middleware.
     */
    private function registry(): Connection
    {
        return DB::connection('inpatient');
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
