<?php

namespace App\Http\Controllers\Api\V1;

use App\Concerns\SourceAware;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * @group Morpheus Datasets
 */
class MorpheusDatasetController extends Controller
{
    use SourceAware;

    public function index(): JsonResponse
    {
        $datasets = $this->cdm()->select("
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
        $dataset = $this->cdm()->selectOne("
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
