<?php

namespace App\Http\Controllers\Api\V1;

use App\Concerns\SourceAware;
use App\Http\Controllers\Controller;
use App\Services\Morpheus\MorpheusPatientService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Morpheus Patient Journey
 */
class MorpheusPatientController extends Controller
{
    use SourceAware;

    public function __construct(
        private readonly MorpheusPatientService $service,
    ) {}

    /**
     * Resolve and validate the dataset schema name from the request.
     * Looks up the schema_name in the morpheus_dataset registry to ensure
     * it exists and is active. Falls back to 'mimiciv' if not provided.
     */
    private function resolveSchema(Request $request): string
    {
        $schemaName = $request->input('dataset', 'mimiciv');

        $dataset = $this->cdm()->selectOne("
            SELECT schema_name FROM inpatient_ext.morpheus_dataset
            WHERE schema_name = ? AND status = 'active'
        ", [$schemaName]);

        if (! $dataset) {
            abort(404, 'Dataset not found or not active');
        }

        return $dataset->schema_name;
    }

    public function listPatients(Request $request): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $limit = $request->integer('limit', 100);
        $offset = $request->integer('offset', 0);

        $filters = [];
        if ($request->has('icu')) {
            $filters['icu'] = $request->input('icu');
        }
        if ($request->has('deceased')) {
            $filters['deceased'] = $request->input('deceased');
        }
        if ($request->filled('admission_type')) {
            $filters['admission_type'] = $request->input('admission_type');
        }
        if ($request->filled('min_los')) {
            $filters['min_los'] = $request->input('min_los');
        }
        if ($request->filled('max_los')) {
            $filters['max_los'] = $request->input('max_los');
        }
        if ($request->filled('diagnosis')) {
            $filters['diagnosis'] = $request->input('diagnosis');
        }
        if ($request->filled('sort')) {
            $filters['sort'] = $request->input('sort');
        }
        if ($request->filled('order')) {
            $filters['order'] = $request->input('order');
        }

        return response()->json($this->service->listPatients($limit, $offset, $filters, $schema));
    }

    public function searchPatients(Request $request): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $q = trim((string) $request->input('q', ''));
        $limit = max(1, min($request->integer('limit', 20), 100));

        if (mb_strlen($q) < 1) {
            return response()->json(['data' => []]);
        }

        return response()->json(['data' => $this->service->searchPatients($q, $limit, $schema)]);
    }

    public function show(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $demographics = $this->service->getDemographics($subjectId, $schema);

        if (! $demographics) {
            return response()->json(['error' => 'Patient not found'], 404);
        }

        return response()->json(['data' => $demographics]);
    }

    public function admissions(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);

        return response()->json(['data' => $this->service->getAdmissions($subjectId, $schema)]);
    }

    public function transfers(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getTransfers($subjectId, $hadmId, $schema)]);
    }

    public function icuStays(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getIcuStays($subjectId, $hadmId, $schema)]);
    }

    public function diagnoses(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getDiagnoses($subjectId, $hadmId, $schema)]);
    }

    public function procedures(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getProcedures($subjectId, $hadmId, $schema)]);
    }

    public function medications(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getMedications($subjectId, $hadmId, $schema)]);
    }

    public function labResults(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');
        $limit = $request->integer('limit', 2000);

        return response()->json(['data' => $this->service->getLabResults($subjectId, $hadmId, $limit, $schema)]);
    }

    public function vitals(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');
        $stayId = $request->input('stay_id');
        $limit = $request->integer('limit', 5000);

        return response()->json(['data' => $this->service->getVitals($subjectId, $hadmId, $stayId, $limit, $schema)]);
    }

    public function inputEvents(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getInputEvents($subjectId, $hadmId, 2000, $schema)]);
    }

    public function outputEvents(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getOutputEvents($subjectId, $hadmId, 2000, $schema)]);
    }

    public function microbiology(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getMicrobiology($subjectId, $hadmId, $schema)]);
    }

    public function services(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getServices($subjectId, $hadmId, $schema)]);
    }

    public function eventCounts(Request $request, string $subjectId): JsonResponse
    {
        $schema = $this->resolveSchema($request);
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getEventCounts($subjectId, $hadmId, $schema)]);
    }
}
