<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

#[Group('Morpheus Datasets', weight: 240)]
class MorpheusDatasetController extends Controller
{
    public function index(): JsonResponse
    {
        $datasets = DB::connection('inpatient')->select("
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
        $dataset = DB::connection('inpatient')->selectOne("
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
