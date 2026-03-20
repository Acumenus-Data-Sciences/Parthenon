<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Morpheus\MorpheusPatientService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Morpheus Patient Journey', weight: 250)]
class MorpheusPatientController extends Controller
{
    public function __construct(
        private readonly MorpheusPatientService $service,
    ) {}

    public function listPatients(Request $request): JsonResponse
    {
        $limit = $request->integer('limit', 100);
        $offset = $request->integer('offset', 0);

        $filters = [];
        if ($request->has('icu')) $filters['icu'] = $request->input('icu');
        if ($request->has('deceased')) $filters['deceased'] = $request->input('deceased');
        if ($request->filled('admission_type')) $filters['admission_type'] = $request->input('admission_type');
        if ($request->filled('min_los')) $filters['min_los'] = $request->input('min_los');
        if ($request->filled('max_los')) $filters['max_los'] = $request->input('max_los');
        if ($request->filled('diagnosis')) $filters['diagnosis'] = $request->input('diagnosis');
        if ($request->filled('sort')) $filters['sort'] = $request->input('sort');
        if ($request->filled('order')) $filters['order'] = $request->input('order');

        return response()->json($this->service->listPatients($limit, $offset, $filters));
    }

    public function searchPatients(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q', ''));
        $limit = max(1, min($request->integer('limit', 20), 100));

        if (mb_strlen($q) < 1) {
            return response()->json(['data' => []]);
        }

        return response()->json(['data' => $this->service->searchPatients($q, $limit)]);
    }

    public function show(string $subjectId): JsonResponse
    {
        $demographics = $this->service->getDemographics($subjectId);

        if (! $demographics) {
            return response()->json(['error' => 'Patient not found'], 404);
        }

        return response()->json(['data' => $demographics]);
    }

    public function admissions(string $subjectId): JsonResponse
    {
        return response()->json(['data' => $this->service->getAdmissions($subjectId)]);
    }

    public function transfers(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getTransfers($subjectId, $hadmId)]);
    }

    public function icuStays(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getIcuStays($subjectId, $hadmId)]);
    }

    public function diagnoses(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getDiagnoses($subjectId, $hadmId)]);
    }

    public function procedures(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getProcedures($subjectId, $hadmId)]);
    }

    public function medications(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getMedications($subjectId, $hadmId)]);
    }

    public function labResults(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');
        $limit = $request->integer('limit', 2000);

        return response()->json(['data' => $this->service->getLabResults($subjectId, $hadmId, $limit)]);
    }

    public function vitals(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');
        $stayId = $request->input('stay_id');
        $limit = $request->integer('limit', 5000);

        return response()->json(['data' => $this->service->getVitals($subjectId, $hadmId, $stayId, $limit)]);
    }

    public function inputEvents(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getInputEvents($subjectId, $hadmId)]);
    }

    public function outputEvents(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getOutputEvents($subjectId, $hadmId)]);
    }

    public function microbiology(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getMicrobiology($subjectId, $hadmId)]);
    }

    public function services(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getServices($subjectId, $hadmId)]);
    }

    public function eventCounts(Request $request, string $subjectId): JsonResponse
    {
        $hadmId = $request->input('hadm_id');

        return response()->json(['data' => $this->service->getEventCounts($subjectId, $hadmId)]);
    }
}
