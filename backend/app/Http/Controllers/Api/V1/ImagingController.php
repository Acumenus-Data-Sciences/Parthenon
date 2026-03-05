<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\ImagingCohortCriterion;
use App\Models\App\ImagingFeature;
use App\Models\App\ImagingStudy;
use App\Services\Imaging\DicomwebService;
use App\Services\Imaging\RadiologyNlpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ImagingController extends Controller
{
    public function __construct(
        private readonly DicomwebService $dicomweb,
        private readonly RadiologyNlpService $nlp,
    ) {}

    // ──────────────────────────────────────────────────────────────────────────
    // Stats
    // ──────────────────────────────────────────────────────────────────────────

    public function stats(): JsonResponse
    {
        $stats = [
            'total_studies' => ImagingStudy::count(),
            'total_features' => ImagingFeature::count(),
            'studies_by_modality' => ImagingStudy::selectRaw('modality, count(*) as count')
                ->whereNotNull('modality')
                ->groupBy('modality')
                ->orderByDesc('count')
                ->pluck('count', 'modality'),
            'features_by_type' => ImagingFeature::selectRaw('feature_type, count(*) as count')
                ->groupBy('feature_type')
                ->pluck('count', 'feature_type'),
            'persons_with_imaging' => ImagingStudy::whereNotNull('person_id')->distinct('person_id')->count(),
        ];

        return response()->json(['data' => $stats]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Studies
    // ──────────────────────────────────────────────────────────────────────────

    public function indexStudies(Request $request): JsonResponse
    {
        $query = ImagingStudy::orderByDesc('study_date');

        if ($request->filled('source_id')) {
            $query->where('source_id', $request->integer('source_id'));
        }
        if ($request->filled('modality')) {
            $query->where('modality', $request->string('modality'));
        }
        if ($request->filled('person_id')) {
            $query->where('person_id', $request->integer('person_id'));
        }

        $studies = $query->paginate($request->integer('per_page', 25));

        return response()->json($studies);
    }

    public function showStudy(ImagingStudy $study): JsonResponse
    {
        $study->load('series');

        return response()->json(['data' => $study]);
    }

    /**
     * POST /api/v1/imaging/studies/index-from-dicomweb
     * Pulls study metadata from configured DICOMweb endpoint and upserts.
     */
    public function indexFromDicomweb(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
            'limit' => 'nullable|integer|min:1|max:1000',
            'modality' => 'nullable|string|max:10',
        ]);

        $filters = [];
        if ($request->filled('modality')) {
            $filters['Modality'] = $request->string('modality');
        }

        $result = $this->dicomweb->indexStudies(
            $validated['source_id'],
            $request->integer('limit', 100),
            $filters
        );

        return response()->json(['data' => $result]);
    }

    /**
     * POST /api/v1/imaging/studies/{study}/index-series
     */
    public function indexSeries(ImagingStudy $study): JsonResponse
    {
        $result = $this->dicomweb->indexSeriesForStudy($study);

        return response()->json(['data' => $result]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Features
    // ──────────────────────────────────────────────────────────────────────────

    public function indexFeatures(Request $request): JsonResponse
    {
        $query = ImagingFeature::orderByDesc('created_at');

        if ($request->filled('study_id')) {
            $query->where('study_id', $request->integer('study_id'));
        }
        if ($request->filled('source_id')) {
            $query->where('source_id', $request->integer('source_id'));
        }
        if ($request->filled('feature_type')) {
            $query->where('feature_type', $request->string('feature_type'));
        }

        return response()->json($query->paginate($request->integer('per_page', 50)));
    }

    /**
     * POST /api/v1/imaging/studies/{study}/extract-nlp
     * Run radiology NLP on OMOP NOTE records for the study's person.
     */
    public function extractNlp(Request $request, ImagingStudy $study): JsonResponse
    {
        if (!$study->person_id) {
            return response()->json(['message' => 'Study has no matched person_id'], 422);
        }

        $result = $this->nlp->extractFromNotes($study->person_id, $study);

        return response()->json(['data' => $result]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Imaging cohort criteria
    // ──────────────────────────────────────────────────────────────────────────

    public function indexCriteria(Request $request): JsonResponse
    {
        $userId = Auth::id();
        $criteria = ImagingCohortCriterion::where(function ($q) use ($userId) {
            $q->where('created_by', $userId)->orWhere('is_shared', true);
        })
            ->when($request->filled('type'), fn ($q) => $q->where('criteria_type', $request->string('type')))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $criteria]);
    }

    public function storeCriterion(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:200',
            'criteria_type' => 'required|string|in:modality,anatomy,quantitative,ai_classification,dose',
            'criteria_definition' => 'required|array',
            'description' => 'nullable|string',
            'is_shared' => 'boolean',
        ]);

        $criterion = ImagingCohortCriterion::create([
            ...$validated,
            'created_by' => Auth::id(),
        ]);

        return response()->json(['data' => $criterion], 201);
    }

    public function destroyCriterion(ImagingCohortCriterion $criterion): JsonResponse
    {
        $criterion->delete();

        return response()->json(null, 204);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Population analytics
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/imaging/analytics/population?source_id=9&modality=CT
     * Returns population-level imaging statistics for a source.
     */
    public function populationAnalytics(Request $request): JsonResponse
    {
        $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        $sourceId = $request->integer('source_id');

        $byModality = ImagingStudy::where('source_id', $sourceId)
            ->whereNotNull('modality')
            ->selectRaw('modality, COUNT(*) as n, COUNT(DISTINCT person_id) as unique_persons')
            ->groupBy('modality')
            ->orderByDesc('n')
            ->get();

        $byBodyPart = ImagingStudy::where('source_id', $sourceId)
            ->whereNotNull('body_part_examined')
            ->selectRaw('body_part_examined, COUNT(*) as n')
            ->groupBy('body_part_examined')
            ->orderByDesc('n')
            ->limit(15)
            ->get();

        $topFeatures = ImagingFeature::where('source_id', $sourceId)
            ->selectRaw('feature_name, feature_type, COUNT(*) as n')
            ->groupBy('feature_name', 'feature_type')
            ->orderByDesc('n')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => [
                'by_modality' => $byModality,
                'by_body_part' => $byBodyPart,
                'top_features' => $topFeatures,
            ],
        ]);
    }
}
