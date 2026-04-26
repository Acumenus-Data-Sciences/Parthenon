<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\DaimonType;
use App\Http\Controllers\Controller;
use App\Http\Requests\CareBundles\IntersectionRequest;
use App\Http\Requests\CareBundles\IntersectionToCohortRequest;
use App\Http\Requests\CareBundles\MaterializeBundleRequest;
use App\Http\Requests\CareBundles\MeasureRosterToCohortRequest;
use App\Jobs\CareBundles\MaterializeAllCareBundlesJob;
use App\Jobs\CareBundles\MaterializeCareBundleJob;
use App\Models\App\CareBundleMeasureResult;
use App\Models\App\CareBundleRun;
use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use App\Services\CareBundles\CareBundleQualificationService;
use App\Services\CareBundles\CareBundleSourceService;
use App\Services\CareBundles\FhirMeasureExporter;
use App\Services\CareBundles\IntersectionCohortService;
use App\Services\CareBundles\MeasureCohortExportService;
use App\Services\CareBundles\MeasureComparisonService;
use App\Services\CareBundles\MeasureMethodologyService;
use App\Services\CareBundles\MeasureRosterService;
use App\Services\CareBundles\MeasureStratificationService;
use App\Services\CareBundles\MeasureTrendService;
use App\Services\CareBundles\WilsonCI;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * @group CareBundles Workbench
 */
class CareBundleController extends Controller
{
    public function __construct(
        private readonly CareBundleQualificationService $qualifications,
        private readonly IntersectionCohortService $intersectionCohorts,
        private readonly FhirMeasureExporter $fhirExporter,
        private readonly CareBundleSourceService $sources,
        private readonly MeasureMethodologyService $methodologyService,
        private readonly MeasureStratificationService $stratificationService,
        private readonly MeasureComparisonService $comparisonService,
        private readonly MeasureTrendService $trendService,
        private readonly MeasureRosterService $rosterService,
        private readonly MeasureCohortExportService $cohortExporter,
    ) {}

    /**
     * GET /v1/care-bundles/{bundle}/measures/{measure}/roster?source_id=X&bucket=non_compliant&page=1
     *
     * Paginated patient roster for a compliance bucket. Powers the Tier C
     * drill-down — "show me the 98K BP-uncontrolled patients."
     */
    public function roster(Request $request, ConditionBundle $bundle, QualityMeasure $measure): JsonResponse
    {
        if (! $this->bundleContainsMeasure($bundle, $measure)) {
            return $this->measureNotInBundleResponse();
        }

        $validated = $request->validate([
            'source_id' => ['required', 'integer', 'exists:sources,id,deleted_at,NULL'],
            'bucket' => ['nullable', Rule::in(MeasureRosterService::BUCKETS)],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        $source = Source::findOrFail($validated['source_id']);

        return response()->json([
            'data' => $this->rosterService->roster(
                $bundle,
                $measure,
                $source,
                $validated['bucket'] ?? 'non_compliant',
                (int) ($validated['page'] ?? 1),
                (int) ($validated['per_page'] ?? 100),
            ),
        ]);
    }

    /**
     * POST /v1/care-bundles/{bundle}/measures/{measure}/roster/to-cohort
     *
     * Materialize a compliance bucket into a first-class CohortDefinition
     * (with members written to OMOP results.cohort) for downstream Studies.
     */
    public function rosterToCohort(
        MeasureRosterToCohortRequest $request,
        ConditionBundle $bundle,
        QualityMeasure $measure,
    ): JsonResponse {
        if (! $this->bundleContainsMeasure($bundle, $measure)) {
            return $this->measureNotInBundleResponse();
        }

        $source = Source::findOrFail($request->integer('source_id'));

        $cohort = $this->cohortExporter->export(
            $bundle,
            $measure,
            $source,
            (string) $request->input('bucket'),
            (string) $request->input('name'),
            $request->input('description'),
            $request->user(),
            (bool) $request->boolean('is_public'),
        );

        return response()->json(['data' => $cohort], 201);
    }

    /**
     * GET /v1/care-bundles/{bundle}/comparison
     *
     * Side-by-side per-source results for every measure in this bundle.
     * Reads only from already-materialized runs — no CDM scans.
     */
    public function comparison(ConditionBundle $bundle): JsonResponse
    {
        return response()->json([
            'data' => $this->comparisonService->compare($bundle),
        ]);
    }

    /**
     * GET /v1/care-bundles/{bundle}/measures/{measure}/trend?source_id=X
     *
     * Historical run snapshots for one (bundle, source, measure). Each run
     * is one trend point with its own rate + Wilson CI.
     */
    public function trend(Request $request, ConditionBundle $bundle, QualityMeasure $measure): JsonResponse
    {
        if (! $this->bundleContainsMeasure($bundle, $measure)) {
            return $this->measureNotInBundleResponse();
        }

        $validated = $request->validate([
            'source_id' => ['required', 'integer', 'exists:sources,id,deleted_at,NULL'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $source = Source::findOrFail($validated['source_id']);
        $limit = (int) ($validated['limit'] ?? 24);

        return response()->json([
            'data' => $this->trendService->trend($bundle, $measure, $source, $limit),
        ]);
    }

    /**
     * GET /v1/care-bundles/{bundle}/measures/{measure}/methodology?source_id=X
     *
     * Researcher-grade methodology card: exact concept_ids (with names +
     * descendant counts), CDM provenance, run pointer, and DQ flags.
     */
    public function methodology(Request $request, ConditionBundle $bundle, QualityMeasure $measure): JsonResponse
    {
        if (! $this->bundleContainsMeasure($bundle, $measure)) {
            return $this->measureNotInBundleResponse();
        }

        $validated = $request->validate([
            'source_id' => ['required', 'integer', 'exists:sources,id,deleted_at,NULL'],
        ]);

        $source = Source::findOrFail($validated['source_id']);

        return response()->json([
            'data' => $this->methodologyService->build($bundle, $measure, $source),
        ]);
    }

    /**
     * GET /v1/care-bundles/{bundle}/measures/{measure}/strata?source_id=X
     *
     * Univariate stratification (age band, sex) of denominator/numerator/
     * exclusion counts with Wilson CIs per stratum.
     */
    public function strata(Request $request, ConditionBundle $bundle, QualityMeasure $measure): JsonResponse
    {
        if (! $this->bundleContainsMeasure($bundle, $measure)) {
            return $this->measureNotInBundleResponse();
        }

        $validated = $request->validate([
            'source_id' => ['required', 'integer', 'exists:sources,id,deleted_at,NULL'],
        ]);

        $source = Source::findOrFail($validated['source_id']);

        return response()->json([
            'data' => $this->stratificationService->stratify($bundle, $measure, $source),
        ]);
    }

    /**
     * GET /v1/care-bundles/sources
     *
     * Lists all sources with person counts and the N≥min_population gate
     * verdict. The frontend uses `qualifies=false` rows to render a
     * "research-only" banner and exclude them from default dropdowns.
     */
    public function sources(): JsonResponse
    {
        return response()->json([
            'data' => $this->sources->listWithPopulation(),
            'meta' => [
                'min_population' => (int) config('care_bundles.min_population'),
            ],
        ]);
    }

    /**
     * GET /v1/care-bundles/coverage
     *
     * Full bundle × source coverage matrix for the home page. Only includes
     * (bundle, source) pairs with a completed current run.
     */
    public function coverage(): JsonResponse
    {
        $matrix = $this->qualifications->coverageMatrix();

        return response()->json([
            'data' => $matrix->map(fn ($row) => [
                'condition_bundle_id' => (int) $row->condition_bundle_id,
                'source_id' => (int) $row->source_id,
                'qualified_patients' => (int) $row->qualified_patients,
                'updated_at' => $row->updated_at,
            ])->values(),
        ]);
    }

    /**
     * GET /v1/care-bundles/{bundle}/qualifications?source_id=X
     *
     * Per-measure denom/numer/rate for the current run on a given source,
     * plus the aggregate qualified person count.
     */
    public function qualifications(Request $request, ConditionBundle $bundle): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => ['required', 'integer', 'exists:sources,id,deleted_at,NULL'],
        ]);

        $source = Source::findOrFail($validated['source_id']);

        $runId = DB::table('care_bundle_current_runs')
            ->where('condition_bundle_id', $bundle->id)
            ->where('source_id', $source->id)
            ->value('care_bundle_run_id');

        if ($runId === null) {
            return response()->json([
                'data' => [
                    'bundle_id' => $bundle->id,
                    'source_id' => $source->id,
                    'qualified_person_count' => 0,
                    'run' => null,
                    'measures' => [],
                ],
            ]);
        }

        $run = CareBundleRun::findOrFail($runId);

        $measureResults = CareBundleMeasureResult::where('care_bundle_run_id', $runId)
            ->with('measure:id,measure_code,measure_name,domain,frequency')
            ->get()
            ->map(function (CareBundleMeasureResult $r) {
                $denom = (int) $r->denominator_count;
                $numer = (int) $r->numerator_count;
                $ci = WilsonCI::compute($numer, $denom);

                return [
                    'quality_measure_id' => $r->quality_measure_id,
                    'measure' => $r->measure,
                    'denominator_count' => $denom,
                    'numerator_count' => $numer,
                    'exclusion_count' => (int) $r->exclusion_count,
                    'rate' => $r->rate !== null ? (float) $r->rate : null,
                    'ci_lower' => $ci['lower'] ?? null,
                    'ci_upper' => $ci['upper'] ?? null,
                    'computed_at' => $r->computed_at,
                ];
            });

        return response()->json([
            'data' => [
                'bundle_id' => $bundle->id,
                'source_id' => $source->id,
                'qualified_person_count' => (int) $run->qualified_person_count,
                'run' => [
                    'id' => $run->id,
                    'status' => $run->status,
                    'started_at' => $run->started_at,
                    'completed_at' => $run->completed_at,
                    'trigger_kind' => $run->trigger_kind,
                    'bundle_version' => $run->bundle_version,
                    'cdm_fingerprint' => $run->cdm_fingerprint,
                ],
                'measures' => $measureResults,
            ],
        ]);
    }

    /**
     * POST /v1/care-bundles/{bundle}/materialize
     *
     * Dispatch a materialization job for (bundle, source). Returns 202 with
     * the fresh run record so the client can poll status.
     */
    public function materialize(
        MaterializeBundleRequest $request,
        ConditionBundle $bundle,
    ): JsonResponse {
        $source = Source::findOrFail($request->integer('source_id'));

        MaterializeCareBundleJob::dispatch(
            $bundle,
            $source,
            $request->user(),
            'manual',
        );

        // Min-population gate is enforced for the materialize-all fan-out via
        // CareBundleSourceService::qualifyingSourceIds(), but a single-bundle
        // materialize is intentionally permissive — data stewards need to run
        // sub-threshold sources for development. We log a warning so that
        // sub-threshold runs are visible in operational monitoring; the
        // SourceQualifierBanner on the frontend already warns the user before
        // they trigger this.
        $threshold = (int) config('care_bundles.min_population', 100_000);
        $count = $this->sources->personCount($source->id, (string) $source->getTableQualifier(DaimonType::CDM));
        $belowThreshold = $count !== null && $count < $threshold;

        $message = 'Materialization dispatched to cohort queue.';
        if ($belowThreshold) {
            Log::warning('CareBundle materialization below population gate', [
                'bundle' => $bundle->bundle_code,
                'source_id' => $source->id,
                'person_count' => $count,
                'threshold' => $threshold,
                'triggered_by' => $request->user()?->id,
            ]);
            $message .= sprintf(
                ' Note: source population %s is below the %s gate; results are research-only.',
                number_format($count ?? 0),
                number_format($threshold),
            );
        }

        return response()->json([
            'data' => [
                'bundle_id' => $bundle->id,
                'source_id' => $source->id,
                'status' => 'queued',
                'below_population_threshold' => $belowThreshold,
                'message' => $message,
            ],
        ], 202);
    }

    /**
     * POST /v1/care-bundles/materialize-all
     *
     * Fan-out: dispatch one job per (active bundle × source).
     */
    public function materializeAll(Request $request): JsonResponse
    {
        MaterializeAllCareBundlesJob::dispatch($request->user(), 'manual');

        return response()->json([
            'data' => [
                'status' => 'queued',
                'message' => 'Fan-out dispatched.',
            ],
        ], 202);
    }

    /**
     * POST /v1/care-bundles/intersections
     *
     * Compute an N-way intersection for (source, bundle_ids, mode) and return
     * the count, UpSet cell breakdown, and ≤20 random sample person_ids.
     * PHI-safe by design — no dates, no notes.
     */
    public function intersections(IntersectionRequest $request): JsonResponse
    {
        $source = Source::findOrFail($request->integer('source_id'));
        /** @var list<int> $bundleIds */
        $bundleIds = array_map('intval', $request->input('bundle_ids'));
        $mode = (string) $request->input('mode');

        $count = $this->qualifications->intersectionCount($source, $bundleIds, $mode);
        $sample = $this->qualifications->sampleIntersection($source, $bundleIds, $mode, 20);
        $upsetCells = $this->qualifications->upsetMatrix($source, $bundleIds);

        return response()->json([
            'data' => [
                'source_id' => $source->id,
                'bundle_ids' => $bundleIds,
                'mode' => $mode,
                'count' => $count,
                'sample_person_ids' => $sample,
                'upset_cells' => $upsetCells,
            ],
        ]);
    }

    /**
     * POST /v1/care-bundles/intersections/to-cohort
     *
     * Materialize an intersection into a first-class CohortDefinition +
     * pre-computed CohortGeneration for use in downstream Studies.
     */
    public function intersectionToCohort(IntersectionToCohortRequest $request): JsonResponse
    {
        $source = Source::findOrFail($request->integer('source_id'));
        /** @var list<int> $bundleIds */
        $bundleIds = array_map('intval', $request->input('bundle_ids'));

        $cohort = $this->intersectionCohorts->createFromIntersection(
            source: $source,
            bundleIds: $bundleIds,
            mode: (string) $request->input('mode'),
            name: (string) $request->input('name'),
            description: $request->input('description'),
            author: $request->user(),
            isPublic: (bool) $request->boolean('is_public'),
        );

        return response()->json(['data' => $cohort], 201);
    }

    /**
     * GET /v1/care-bundles/{bundle}/fhir/measure
     *
     * Export the bundle as a FHIR R4 Measure resource (one group per
     * QualityMeasure). Response uses application/fhir+json per the FHIR spec.
     */
    public function fhirMeasure(ConditionBundle $bundle): JsonResponse
    {
        $resource = $this->fhirExporter->exportBundle($bundle);

        return response()
            ->json($resource)
            ->header('Content-Type', 'application/fhir+json');
    }

    /**
     * GET /v1/care-bundles/{bundle}/runs?source_id=X
     *
     * `fail_message` may contain query text or schema names — only operators
     * with `care-bundles.materialize` see it. Plain viewers get the run
     * envelope without the diagnostic blob.
     */
    public function runs(Request $request, ConditionBundle $bundle): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => ['nullable', 'integer', 'exists:sources,id,deleted_at,NULL'],
        ]);

        $columns = [
            'id', 'condition_bundle_id', 'source_id', 'status',
            'started_at', 'completed_at', 'trigger_kind', 'triggered_by',
            'qualified_person_count', 'measure_count', 'bundle_version',
            'cdm_fingerprint', 'created_at',
        ];

        $canSeeFailMessage = $request->user()?->can('care-bundles.materialize') ?? false;
        if ($canSeeFailMessage) {
            $columns[] = 'fail_message';
        }

        $query = CareBundleRun::where('condition_bundle_id', $bundle->id);
        if (! empty($validated['source_id'])) {
            $query->where('source_id', (int) $validated['source_id']);
        }

        $runs = $query->orderByDesc('id')->limit(50)->get($columns);

        return response()->json(['data' => $runs]);
    }

    /**
     * GET /v1/care-bundles/runs/{run}
     *
     * Strips `fail_message` for callers without `care-bundles.materialize`
     * (same policy as the `runs` listing above) so a viewer who guesses a
     * run id can't read schema names or query text from a failed run.
     */
    public function run(Request $request, CareBundleRun $run): JsonResponse
    {
        $run->load(['bundle:id,bundle_code,condition_name', 'source:id,source_name', 'triggeredBy:id,name']);

        $canSeeFailMessage = $request->user()?->can('care-bundles.materialize') ?? false;
        if (! $canSeeFailMessage) {
            $run->makeHidden('fail_message');
        }

        return response()->json(['data' => $run]);
    }

    private function bundleContainsMeasure(ConditionBundle $bundle, QualityMeasure $measure): bool
    {
        return $bundle->measures()
            ->where('quality_measures.id', $measure->id)
            ->exists();
    }

    private function measureNotInBundleResponse(): JsonResponse
    {
        return response()->json([
            'error' => 'Measure does not belong to this care bundle.',
        ], 404);
    }
}
