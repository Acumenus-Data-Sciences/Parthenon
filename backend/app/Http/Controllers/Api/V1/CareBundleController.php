<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CareBundles\IntersectionRequest;
use App\Http\Requests\CareBundles\IntersectionToCohortRequest;
use App\Http\Requests\CareBundles\MaterializeBundleRequest;
use App\Jobs\CareBundles\MaterializeAllCareBundlesJob;
use App\Jobs\CareBundles\MaterializeCareBundleJob;
use App\Models\App\CareBundleMeasureResult;
use App\Models\App\CareBundleRun;
use App\Models\App\ConditionBundle;
use App\Models\App\Source;
use App\Services\CareBundles\CareBundleQualificationService;
use App\Services\CareBundles\FhirMeasureExporter;
use App\Services\CareBundles\IntersectionCohortService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * @group CareBundles Workbench
 */
class CareBundleController extends Controller
{
    public function __construct(
        private readonly CareBundleQualificationService $qualifications,
        private readonly IntersectionCohortService $intersectionCohorts,
        private readonly FhirMeasureExporter $fhirExporter,
    ) {}

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
            'source_id' => ['required', 'integer', 'exists:sources,id'],
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
            ->map(fn (CareBundleMeasureResult $r) => [
                'quality_measure_id' => $r->quality_measure_id,
                'measure' => $r->measure,
                'denominator_count' => (int) $r->denominator_count,
                'numerator_count' => (int) $r->numerator_count,
                'exclusion_count' => (int) $r->exclusion_count,
                'rate' => $r->rate !== null ? (float) $r->rate : null,
                'computed_at' => $r->computed_at,
            ]);

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

        return response()->json([
            'data' => [
                'bundle_id' => $bundle->id,
                'source_id' => $source->id,
                'status' => 'queued',
                'message' => 'Materialization dispatched to cohort queue.',
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
    public function fhirMeasure(ConditionBundle $bundle): Response
    {
        $resource = $this->fhirExporter->exportBundle($bundle);

        return response()
            ->json($resource)
            ->header('Content-Type', 'application/fhir+json');
    }

    /**
     * GET /v1/care-bundles/{bundle}/runs
     */
    public function runs(ConditionBundle $bundle): JsonResponse
    {
        $runs = CareBundleRun::where('condition_bundle_id', $bundle->id)
            ->orderByDesc('id')
            ->limit(50)
            ->get([
                'id', 'condition_bundle_id', 'source_id', 'status',
                'started_at', 'completed_at', 'trigger_kind', 'triggered_by',
                'qualified_person_count', 'measure_count', 'bundle_version',
                'cdm_fingerprint', 'fail_message', 'created_at',
            ]);

        return response()->json(['data' => $runs]);
    }

    /**
     * GET /v1/care-bundles/runs/{run}
     */
    public function run(CareBundleRun $run): JsonResponse
    {
        $run->load(['bundle:id,bundle_code,condition_name', 'source:id,source_name', 'triggeredBy:id,name']);

        return response()->json(['data' => $run]);
    }
}
