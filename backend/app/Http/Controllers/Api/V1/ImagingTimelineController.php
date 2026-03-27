<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\ImagingMeasurement;
use App\Models\App\ImagingResponseAssessment;
use App\Models\App\ImagingStudy;
use App\Services\Imaging\ImagingTimelineService;
use App\Services\Imaging\ResponseAssessmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Imaging outcomes research endpoints: patient timelines, measurements,
 * and treatment response assessments.
 *
 * @tags Imaging Outcomes
 */
/**
 * @group Imaging
 */
class ImagingTimelineController extends Controller
{
    public function __construct(
        private readonly ImagingTimelineService $timeline,
    ) {}

    // ──────────────────────────────────────────────────────────────────────────
    // Patient Timeline
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/imaging/patients/{personId}/timeline
     *
     * Full longitudinal timeline: imaging studies, drug exposures, measurements.
     */
    public function patientTimeline(int $personId): JsonResponse
    {
        $data = $this->timeline->getPatientTimeline($personId);

        return response()->json(['data' => $data]);
    }

    /**
     * GET /api/v1/imaging/patients/{personId}/studies
     *
     * All imaging studies for a patient.
     */
    public function patientStudies(int $personId): JsonResponse
    {
        $studies = ImagingStudy::where('person_id', $personId)
            ->withCount('measurements')
            ->orderBy('study_date')
            ->get();

        return response()->json(['data' => $studies]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Study Linking
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/imaging/studies/{study}/link-person
     *
     * Link an imaging study to an OMOP person_id.
     */
    public function linkPerson(Request $request, ImagingStudy $study): JsonResponse
    {
        $validated = $request->validate([
            'person_id' => 'required|integer|min:1',
        ]);

        $study->update(['person_id' => $validated['person_id']]);

        // Also update any measurements that belong to this study
        ImagingMeasurement::where('study_id', $study->id)
            ->update(['person_id' => $validated['person_id']]);

        return response()->json(['data' => $study->fresh()]);
    }

    /**
     * POST /api/v1/imaging/studies/bulk-link
     *
     * Link multiple studies to a person at once.
     */
    public function bulkLinkPerson(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'study_ids' => 'required|array|min:1',
            'study_ids.*' => 'integer|exists:imaging_studies,id',
            'person_id' => 'required|integer|min:1',
        ]);

        $count = $this->timeline->linkStudiesToPerson(
            $validated['study_ids'],
            $validated['person_id']
        );

        return response()->json(['data' => ['linked' => $count]]);
    }

    /**
     * POST /api/v1/imaging/studies/auto-link
     *
     * Auto-link unlinked studies by matching DICOM patient IDs to OMOP persons.
     */
    public function autoLink(): JsonResponse
    {
        $linked = $this->timeline->autoLinkStudies();

        return response()->json(['data' => ['linked' => $linked]]);
    }

    /**
     * POST /api/v1/imaging/studies/link-by-condition
     *
     * Link unlinked studies to CDM patients matching a condition pattern.
     * Each unique DICOM patient gets a distinct CDM person with the condition.
     */
    public function linkByCondition(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'condition_pattern' => 'required|string|min:3|max:200',
            'limit' => 'integer|min:1|max:10000',
        ]);

        $result = $this->timeline->linkStudiesToConditionPatients(
            $validated['condition_pattern'],
            $validated['limit'] ?? 1000
        );

        return response()->json(['data' => $result]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Measurements CRUD
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/imaging/studies/{study}/measurements
     *
     * All measurements for a specific study.
     */
    public function studyMeasurements(ImagingStudy $study): JsonResponse
    {
        $measurements = ImagingMeasurement::where('study_id', $study->id)
            ->orderBy('measurement_type')
            ->orderBy('measurement_name')
            ->get();

        return response()->json(['data' => $measurements]);
    }

    /**
     * POST /api/v1/imaging/studies/{study}/measurements
     *
     * Record a measurement for a study (manual or AI-derived).
     */
    public function storeMeasurement(Request $request, ImagingStudy $study): JsonResponse
    {
        $validated = $request->validate([
            'measurement_type' => 'required|string|max:50',
            'measurement_name' => 'required|string|max:200',
            'value_as_number' => 'required|numeric',
            'unit' => 'required|string|max:50',
            'body_site' => 'nullable|string|max:100',
            'laterality' => 'nullable|string|in:LEFT,RIGHT,BILATERAL',
            'series_id' => 'nullable|integer|exists:imaging_series,id',
            'algorithm_name' => 'nullable|string|max:200',
            'confidence' => 'nullable|numeric|between:0,1',
            'measured_at' => 'nullable|date',
            'is_target_lesion' => 'boolean',
            'target_lesion_number' => 'nullable|integer|min:1|max:10',
        ]);

        $measurement = ImagingMeasurement::create([
            ...$validated,
            'study_id' => $study->id,
            'person_id' => $study->person_id,
            'measured_at' => $validated['measured_at'] ?? $study->study_date,
            'created_by' => Auth::id(),
        ]);

        return response()->json(['data' => $measurement], 201);
    }

    /**
     * PUT /api/v1/imaging/measurements/{measurement}
     */
    public function updateMeasurement(Request $request, ImagingMeasurement $measurement): JsonResponse
    {
        $validated = $request->validate([
            'measurement_type' => 'sometimes|string|max:50',
            'measurement_name' => 'sometimes|string|max:200',
            'value_as_number' => 'sometimes|numeric',
            'unit' => 'sometimes|string|max:50',
            'body_site' => 'nullable|string|max:100',
            'laterality' => 'nullable|string|in:LEFT,RIGHT,BILATERAL',
            'is_target_lesion' => 'boolean',
            'target_lesion_number' => 'nullable|integer|min:1|max:10',
        ]);

        $measurement->update($validated);

        return response()->json(['data' => $measurement->fresh()]);
    }

    /**
     * DELETE /api/v1/imaging/measurements/{measurement}
     */
    public function destroyMeasurement(ImagingMeasurement $measurement): JsonResponse
    {
        $measurement->delete();

        return response()->json(null, 204);
    }

    /**
     * GET /api/v1/imaging/patients/{personId}/measurements
     *
     * All measurements for a patient across all studies, filterable.
     */
    public function patientMeasurements(Request $request, int $personId): JsonResponse
    {
        $query = ImagingMeasurement::where('person_id', $personId)
            ->with('study:id,study_date,modality,body_part_examined')
            ->orderBy('measured_at');

        if ($request->filled('measurement_type')) {
            $query->where('measurement_type', $request->string('measurement_type'));
        }
        if ($request->filled('body_site')) {
            $query->where('body_site', $request->string('body_site'));
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * GET /api/v1/imaging/patients/{personId}/measurements/trends
     *
     * Time series data for a specific measurement type.
     */
    public function measurementTrends(Request $request, int $personId): JsonResponse
    {
        $request->validate([
            'measurement_type' => 'required|string|max:50',
            'body_site' => 'nullable|string|max:100',
        ]);

        $trends = $this->timeline->getMeasurementTrends(
            $personId,
            $request->string('measurement_type')->toString(),
            $request->filled('body_site') ? $request->string('body_site')->toString() : null
        );

        return response()->json(['data' => $trends]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Response Assessments
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/imaging/patients/{personId}/response-assessments
     */
    public function patientResponseAssessments(int $personId): JsonResponse
    {
        $assessments = ImagingResponseAssessment::where('person_id', $personId)
            ->with(['baselineStudy:id,study_date,modality', 'currentStudy:id,study_date,modality'])
            ->orderByDesc('assessment_date')
            ->get();

        return response()->json(['data' => $assessments]);
    }

    /**
     * POST /api/v1/imaging/patients/{personId}/response-assessments
     *
     * Record or compute a response assessment.
     */
    public function storeResponseAssessment(Request $request, int $personId): JsonResponse
    {
        $validated = $request->validate([
            'criteria_type' => 'required|string|in:recist,ct_severity,deauville,rano',
            'assessment_date' => 'required|date',
            'body_site' => 'nullable|string|max:100',
            'baseline_study_id' => 'required|integer|exists:imaging_studies,id',
            'current_study_id' => 'required|integer|exists:imaging_studies,id',
            'baseline_value' => 'nullable|numeric',
            'nadir_value' => 'nullable|numeric',
            'current_value' => 'nullable|numeric',
            'percent_change_from_baseline' => 'nullable|numeric',
            'percent_change_from_nadir' => 'nullable|numeric',
            'response_category' => 'required|string|max:20',
            'rationale' => 'nullable|string',
            'is_confirmed' => 'boolean',
        ]);

        $assessment = ImagingResponseAssessment::create([
            ...$validated,
            'person_id' => $personId,
            'assessed_by' => Auth::id(),
        ]);

        return response()->json(['data' => $assessment->load(['baselineStudy', 'currentStudy'])], 201);
    }

    /**
     * POST /api/v1/imaging/patients/{personId}/compute-response
     *
     * Auto-compute response assessment using the ResponseAssessmentService.
     */
    public function computeResponse(Request $request, int $personId): JsonResponse
    {
        $validated = $request->validate([
            'current_study_id' => 'required|integer|exists:imaging_studies,id',
            'baseline_study_id' => 'nullable|integer|exists:imaging_studies,id',
            'criteria_type' => 'nullable|string|in:auto,recist,ct_severity,deauville,rano',
        ]);

        $service = app(ResponseAssessmentService::class);

        $assessment = $service->computeAndSave(
            $personId,
            $validated['current_study_id'],
            $validated['baseline_study_id'] ?? null,
            $validated['criteria_type'] ?? 'auto'
        );

        return response()->json([
            'data' => $assessment->load(['baselineStudy', 'currentStudy']),
        ], 201);
    }

    /**
     * POST /api/v1/imaging/patients/{personId}/assess-preview
     *
     * Preview (dry-run) a response assessment without saving.
     */
    public function assessPreview(Request $request, int $personId): JsonResponse
    {
        $validated = $request->validate([
            'current_study_id' => 'required|integer|exists:imaging_studies,id',
            'criteria_type' => 'nullable|string|in:auto,recist,ct_severity,deauville,rano',
        ]);

        $service = app(ResponseAssessmentService::class);

        $result = $service->assessResponse(
            $personId,
            $validated['current_study_id'],
            $validated['criteria_type'] ?? 'auto'
        );

        return response()->json(['data' => $result]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Patients with Imaging (search)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/imaging/patients
     *
     * List patients that have imaging studies, with study counts and date ranges.
     */
    public function listPatientsWithImaging(Request $request): JsonResponse
    {
        $query = ImagingStudy::whereNotNull('person_id')
            ->selectRaw('
                person_id,
                COUNT(*) as study_count,
                COUNT(DISTINCT modality) as modality_count,
                array_agg(DISTINCT modality) as modalities,
                MIN(study_date) as first_study_date,
                MAX(study_date) as last_study_date
            ')
            ->groupBy('person_id')
            ->orderByDesc('study_count');

        if ($request->filled('min_studies')) {
            $query->havingRaw('COUNT(*) >= ?', [$request->integer('min_studies')]);
        }
        if ($request->filled('modality')) {
            $query->where('modality', $request->string('modality'));
        }

        $patients = $query->paginate($request->integer('per_page', 25));

        return response()->json($patients);
    }
}
