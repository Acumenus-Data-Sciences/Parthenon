<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\ImagingCohortCriterion;
use App\Models\App\ImagingFeature;
use App\Models\App\ImagingInstance;
use App\Models\App\ImagingSeries;
use App\Models\App\ImagingStudy;
use App\Models\App\PacsConnection;
use App\Services\Imaging\DicomFileService;
use App\Services\Imaging\DicomwebService;
use App\Services\Imaging\RadiologyNlpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * @group Imaging
 */
class ImagingController extends Controller
{
    public function __construct(
        private readonly DicomwebService $dicomweb,
        private readonly RadiologyNlpService $nlp,
        private readonly DicomFileService $dicomFiles,
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
        $sortBy = $request->string('sort_by', 'study_date')->toString();
        $sortDir = strtolower($request->string('sort_dir', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';
        $sortable = [
            'study_date',
            'modality',
            'body_part_examined',
            'study_description',
            'num_series',
            'num_images',
            'person_id',
            'status',
            'created_at',
            'updated_at',
        ];

        if (! in_array($sortBy, $sortable, true)) {
            $sortBy = 'study_date';
        }

        $query = ImagingStudy::query();

        if ($request->filled('source_id')) {
            $query->where('source_id', $request->integer('source_id'));
        }
        if ($request->filled('modality')) {
            $query->where('modality', $request->string('modality'));
        }
        if ($request->filled('person_id')) {
            $query->where('person_id', $request->integer('person_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('body_part')) {
            $terms = $this->expandImagingSearchTerms($request->string('body_part')->toString());
            $query->where(function ($q) use ($terms) {
                foreach ($terms as $term) {
                    $pattern = '%'.$term.'%';
                    $q->orWhere('body_part_examined', 'ilike', $pattern)
                        ->orWhereHas('series', function ($series) use ($pattern) {
                            $series->where('body_part_examined', 'ilike', $pattern);
                        });
                }
            });
        }
        if ($request->filled('date_from')) {
            $query->whereDate('study_date', '>=', $request->string('date_from')->toString());
        }
        if ($request->filled('date_to')) {
            $query->whereDate('study_date', '<=', $request->string('date_to')->toString());
        }
        if ($request->filled('q')) {
            $terms = $this->expandImagingSearchTerms($request->string('q')->toString());
            $query->where(function ($q) use ($terms) {
                foreach ($terms as $term) {
                    $pattern = '%'.$term.'%';
                    $q->orWhere('study_instance_uid', 'ilike', $pattern)
                        ->orWhere('accession_number', 'ilike', $pattern)
                        ->orWhere('study_description', 'ilike', $pattern)
                        ->orWhere('body_part_examined', 'ilike', $pattern)
                        ->orWhere('patient_name_dicom', 'ilike', $pattern)
                        ->orWhere('patient_id_dicom', 'ilike', $pattern)
                        ->orWhere('modality', 'ilike', $pattern)
                        ->orWhereHas('series', function ($series) use ($pattern) {
                            $series->where('series_description', 'ilike', $pattern)
                                ->orWhere('body_part_examined', 'ilike', $pattern)
                                ->orWhere('modality', 'ilike', $pattern);
                        });
                }
            });
        }

        $query->orderBy($sortBy, $sortDir)->orderBy('id', $sortDir);
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
            'sync_all' => 'nullable|boolean',
            'batch_size' => 'nullable|integer|min:1|max:500',
        ]);

        $filters = [];
        if ($request->filled('modality')) {
            $filters['Modality'] = $request->string('modality');
        }

        $dicomweb = PacsConnection::query()
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get()
            ->map(fn (PacsConnection $conn) => DicomwebService::forConnection($conn))
            ->first() ?? $this->dicomweb;

        $result = $request->boolean('sync_all')
            ? $dicomweb->syncStudies(
                $validated['source_id'],
                $request->integer('batch_size', 100),
                $filters,
                $request->filled('limit') ? $request->integer('limit') : null
            )
            : $dicomweb->indexStudies(
                $validated['source_id'],
                $request->integer('limit', 100),
                $filters
            );

        return response()->json(['data' => $result]);
    }

    /**
     * Expand common anatomy search terms so user-facing search matches the
     * vocabulary actually present in DICOM metadata.
     *
     * @return array<int, string>
     */
    private function expandImagingSearchTerms(string $term): array
    {
        $normalized = strtolower(trim(preg_replace('/\s+/', ' ', $term) ?? ''));
        if ($normalized === '') {
            return [];
        }

        $synonyms = [
            'brain' => ['brain', 'head'],
            'head' => ['head', 'brain'],
            'chest' => ['chest', 'lung', 'thorax', 'thoracic'],
            'lung' => ['lung', 'chest', 'thorax', 'thoracic'],
            'abdomen' => ['abdomen', 'abdominal'],
            'abdominal' => ['abdominal', 'abdomen'],
            'pelvis' => ['pelvis', 'pelvic'],
            'pelvic' => ['pelvic', 'pelvis'],
        ];

        $terms = [$term];
        if (isset($synonyms[$normalized])) {
            array_push($terms, ...$synonyms[$normalized]);
        }

        return array_values(array_unique(array_filter($terms)));
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
        if (! $study->person_id) {
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
    // Local DICOM file import
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/imaging/import-local
     * Accepts bulk metadata from import_dicom.py and upserts studies/series/instances.
     */
    public function importLocal(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
            'studies' => 'required|array',
            'series' => 'required|array',
            'instances' => 'required|array',
        ]);

        $sourceId = $validated['source_id'];
        $studyCount = 0;
        $seriesCount = 0;
        $instanceCount = 0;

        DB::transaction(function () use ($validated, $sourceId, &$studyCount, &$seriesCount, &$instanceCount) {
            // ── Studies ─────────────────────────────────────────────────────
            $studyUidToId = [];
            foreach ($validated['studies'] as $s) {
                $study = ImagingStudy::updateOrCreate(
                    ['study_instance_uid' => $s['study_instance_uid']],
                    array_merge(
                        array_filter($s, fn ($v) => $v !== null && $v !== ''),
                        ['source_id' => $sourceId]
                    )
                );
                $studyUidToId[$s['study_instance_uid']] = $study->id;
                $studyCount++;
            }

            // ── Series ──────────────────────────────────────────────────────
            $seriesUidToId = [];
            foreach ($validated['series'] as $s) {
                $studyId = $studyUidToId[$s['study_instance_uid']] ?? null;
                if (! $studyId) {
                    continue;
                }
                $data = array_filter($s, fn ($v) => $v !== null && $v !== '');
                unset($data['study_instance_uid']);
                $ser = ImagingSeries::updateOrCreate(
                    ['series_instance_uid' => $s['series_instance_uid']],
                    array_merge($data, ['study_id' => $studyId])
                );
                $seriesUidToId[$s['series_instance_uid']] = $ser->id;
                $seriesCount++;
            }

            // ── Instances ───────────────────────────────────────────────────
            foreach ($validated['instances'] as $inst) {
                $studyId = $studyUidToId[$inst['study_instance_uid']] ?? null;
                $seriesId = $seriesUidToId[$inst['series_instance_uid']] ?? null;
                if (! $studyId || ! $seriesId) {
                    continue;
                }
                $data = array_filter($inst, fn ($v) => $v !== null && $v !== '');
                unset($data['study_instance_uid'], $data['series_instance_uid']);
                ImagingInstance::updateOrCreate(
                    ['sop_instance_uid' => $inst['sop_instance_uid']],
                    array_merge($data, ['study_id' => $studyId, 'series_id' => $seriesId])
                );
                $instanceCount++;
            }
        });

        return response()->json([
            'data' => [
                'studies_imported' => $studyCount,
                'series_imported' => $seriesCount,
                'instances_imported' => $instanceCount,
            ],
        ], 201);
    }

    /**
     * POST /api/v1/imaging/import-local/trigger
     * UI-triggered local DICOM directory scan. Uses DicomFileService (PHP-native reader).
     */
    public function triggerLocalImport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
            'dir' => 'nullable|string|max:500',
        ]);

        $relDir = $validated['dir'] ?? 'dicom_samples';
        $absDir = base_path($relDir);

        if (! is_dir($absDir)) {
            return response()->json(['message' => "Directory not found: {$relDir}"], 422);
        }

        try {
            $result = $this->dicomFiles->importDirectory($absDir, $validated['source_id']);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        return response()->json(['data' => $result], 201);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Instance listing (for viewer)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/imaging/studies/{study}/instances
     * Returns sorted instance list for a study (all series).
     */
    public function listInstances(ImagingStudy $study): JsonResponse
    {
        $instances = ImagingInstance::where('study_id', $study->id)
            ->orderBy('series_id')
            ->orderBy('instance_number')
            ->get(['id', 'series_id', 'sop_instance_uid', 'instance_number', 'slice_location', 'file_path']);

        return response()->json(['data' => $instances]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // WADO-URI endpoint (serve raw DICOM file)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/imaging/wado/{sopUid}
     * Streams a DICOM file to the client (used by Cornerstone3D dicom-image-loader).
     */
    public function wado(string $sopUid): BinaryFileResponse
    {
        $instance = ImagingInstance::where('sop_instance_uid', $sopUid)->firstOrFail();

        if (! $instance->file_path) {
            abort(404, 'No file path recorded for this instance');
        }

        $absolutePath = base_path($instance->file_path);

        if (! file_exists($absolutePath)) {
            abort(404, 'DICOM file not found on disk');
        }

        return response()->file($absolutePath, [
            'Content-Type' => 'application/dicom',
            'Cache-Control' => 'private, max-age=3600',
            'Content-Disposition' => 'inline',
        ]);
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
