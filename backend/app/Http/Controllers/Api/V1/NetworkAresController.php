<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\RunFeasibilityRequest;
use App\Models\App\SourceRelease;
use App\Models\User;
use App\Services\Ares\AnnotationService;
use App\Services\Ares\AutoAnnotationService;
use App\Services\Ares\CostService;
use App\Services\Ares\CoverageService;
use App\Services\Ares\DiversityService;
use App\Services\Ares\DqHistoryService;
use App\Services\Ares\FeasibilityService;
use App\Services\Ares\NetworkComparisonService;
use App\Services\Ares\ReleaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NetworkAresController extends Controller
{
    public function __construct(
        private readonly NetworkComparisonService $comparisonService,
        private readonly CoverageService $coverageService,
        private readonly DiversityService $diversityService,
        private readonly FeasibilityService $feasibilityService,
        private readonly DqHistoryService $dqHistoryService,
        private readonly AnnotationService $annotationService,
        private readonly CostService $costService,
        private readonly ReleaseService $releaseService,
        private readonly AutoAnnotationService $autoAnnotationService,
    ) {}

    // ── Hub Overview ─────────────────────────────────────────────────────

    /**
     * GET /v1/network/ares/overview
     */
    public function overview(): JsonResponse
    {
        $dqSummary = $this->dqHistoryService->getNetworkDqSummary();
        $sourceCount = count($dqSummary);
        $passRates = array_filter(array_column($dqSummary, 'pass_rate'), fn ($r) => $r > 0);
        $avgDqScore = count($passRates) > 0 ? round(array_sum($passRates) / count($passRates), 1) : null;

        // Network aggregate totals
        $networkPersonCount = (int) array_sum(array_column($dqSummary, 'person_count'));
        $networkRecordCount = 0;
        foreach ($dqSummary as $s) {
            $latestRelease = SourceRelease::where('source_id', $s['source_id'])
                ->orderByDesc('created_at')
                ->first();
            $networkRecordCount += $latestRelease?->record_count ?? 0;
        }

        return response()->json([
            'data' => [
                'source_count' => $sourceCount,
                'avg_dq_score' => $avgDqScore,
                'total_unmapped_codes' => 0, // Populated in Phase 4 (UnmappedCodeService)
                'sources_needing_attention' => count(array_filter($dqSummary, fn ($s) => $s['pass_rate'] < 80)),
                'network_person_count' => $networkPersonCount,
                'network_record_count' => $networkRecordCount,
                'dq_summary' => $dqSummary,
            ],
        ]);
    }

    // ── Concept Comparison ───────────────────────────────────────────────

    /**
     * GET /v1/network/ares/compare?concept_id={id}
     */
    public function compare(Request $request): JsonResponse
    {
        $conceptId = (int) $request->query('concept_id');

        if (! $conceptId) {
            return response()->json(['error' => 'concept_id is required'], 422);
        }

        return response()->json([
            'data' => $this->comparisonService->compareConcept($conceptId),
        ]);
    }

    /**
     * GET /v1/network/ares/compare/search?q={term}
     */
    public function compareSearch(Request $request): JsonResponse
    {
        $query = (string) $request->query('q', '');

        return response()->json([
            'data' => $this->comparisonService->searchConcepts($query),
        ]);
    }

    /**
     * GET /v1/network/ares/compare/batch?concept_ids={ids}
     */
    public function compareBatch(Request $request): JsonResponse
    {
        $idsParam = (string) $request->query('concept_ids', '');
        $conceptIds = array_map('intval', array_filter(explode(',', $idsParam)));

        if (empty($conceptIds)) {
            return response()->json(['error' => 'concept_ids is required'], 422);
        }

        if (count($conceptIds) > 20) {
            return response()->json(['error' => 'Maximum 20 concepts per batch'], 422);
        }

        return response()->json([
            'data' => $this->comparisonService->compareBatch($conceptIds),
        ]);
    }

    /**
     * GET /v1/network/ares/compare/multi?concept_ids=1,2,3
     */
    public function compareMulti(Request $request): JsonResponse
    {
        $idsParam = (string) $request->query('concept_ids', '');
        $conceptIds = array_map('intval', array_filter(explode(',', $idsParam)));

        if (empty($conceptIds)) {
            return response()->json(['error' => 'concept_ids is required'], 422);
        }

        if (count($conceptIds) > 5) {
            return response()->json(['error' => 'Maximum 5 concepts for multi-comparison'], 422);
        }

        return response()->json([
            'data' => $this->comparisonService->compareMultiConcepts($conceptIds),
        ]);
    }

    /**
     * GET /v1/network/ares/compare/funnel?concept_ids=1,2,3
     */
    public function compareFunnel(Request $request): JsonResponse
    {
        $idsParam = (string) $request->query('concept_ids', '');
        $conceptIds = array_map('intval', array_filter(explode(',', $idsParam)));

        if (empty($conceptIds)) {
            return response()->json(['error' => 'concept_ids is required'], 422);
        }

        if (count($conceptIds) > 5) {
            return response()->json(['error' => 'Maximum 5 concepts for attrition funnel'], 422);
        }

        return response()->json([
            'data' => $this->comparisonService->computeAttritionFunnel($conceptIds),
        ]);
    }

    // ── Coverage ─────────────────────────────────────────────────────────

    /**
     * GET /v1/network/ares/coverage
     */
    public function coverage(): JsonResponse
    {
        return response()->json([
            'data' => $this->coverageService->getMatrix(),
        ]);
    }

    /**
     * GET /v1/network/ares/coverage/extended
     */
    public function coverageExtended(): JsonResponse
    {
        return response()->json([
            'data' => $this->coverageService->getExtendedMatrix(),
        ]);
    }

    // ── Diversity ────────────────────────────────────────────────────────

    /**
     * GET /v1/network/ares/diversity
     */
    public function diversity(): JsonResponse
    {
        return response()->json([
            'data' => $this->diversityService->getDiversity(),
        ]);
    }

    /**
     * POST /v1/network/ares/diversity/dap-check
     */
    public function diversityDapCheck(Request $request): JsonResponse
    {
        $targets = $request->validate([
            'targets' => 'required|array',
            'targets.*' => 'numeric|min:0|max:100',
        ])['targets'];

        return response()->json([
            'data' => $this->diversityService->getDapGapAnalysis($targets),
        ]);
    }

    /**
     * GET /v1/network/ares/diversity/pooled?source_ids=1,2,3
     */
    public function diversityPooled(Request $request): JsonResponse
    {
        $idsParam = (string) $request->query('source_ids', '');
        $sourceIds = array_map('intval', array_filter(explode(',', $idsParam)));

        if (empty($sourceIds)) {
            return response()->json(['error' => 'source_ids is required'], 422);
        }

        return response()->json([
            'data' => $this->diversityService->getPooledDemographics($sourceIds),
        ]);
    }

    // ── Feasibility ──────────────────────────────────────────────────────

    /**
     * POST /v1/network/ares/feasibility
     */
    public function runFeasibility(RunFeasibilityRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $assessment = $this->feasibilityService->assess(
            $user,
            $request->validated()['name'],
            $request->validated()['criteria'],
        );

        return response()->json(['data' => $assessment], 201);
    }

    /**
     * GET /v1/network/ares/feasibility/{id}
     */
    public function showFeasibility(int $id): JsonResponse
    {
        $assessment = $this->feasibilityService->getAssessment($id);

        if (! $assessment) {
            return response()->json(['error' => 'Assessment not found'], 404);
        }

        return response()->json(['data' => $assessment]);
    }

    /**
     * GET /v1/network/ares/feasibility
     */
    public function listFeasibility(): JsonResponse
    {
        return response()->json([
            'data' => $this->feasibilityService->listAssessments(),
        ]);
    }

    /**
     * GET /v1/network/ares/feasibility/{id}/impact
     */
    public function feasibilityImpact(int $id): JsonResponse
    {
        return response()->json([
            'data' => $this->feasibilityService->getCriteriaImpact($id),
        ]);
    }

    /**
     * GET /v1/network/ares/feasibility/templates
     */
    public function feasibilityTemplates(Request $request): JsonResponse
    {
        /** @var \App\Models\User|null $user */
        $user = $request->user();

        return response()->json([
            'data' => $this->feasibilityService->getTemplates($user?->id),
        ]);
    }

    /**
     * POST /v1/network/ares/feasibility/templates
     */
    public function storeFeasibilityTemplate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'criteria' => 'required|array',
            'is_public' => 'nullable|boolean',
        ]);

        /** @var \App\Models\User $user */
        $user = $request->user();

        $template = $this->feasibilityService->createTemplate($user->id, $validated);

        return response()->json(['data' => $template], 201);
    }

    // ── Alerts ─────────────────────────────────────────────────────────────

    /**
     * GET /v1/network/ares/alerts
     */
    public function alerts(): JsonResponse
    {
        return response()->json([
            'data' => $this->autoAnnotationService->getAlerts(),
        ]);
    }

    // ── Network DQ ───────────────────────────────────────────────────────

    /**
     * GET /v1/network/ares/dq-summary
     */
    public function dqSummary(): JsonResponse
    {
        return response()->json([
            'data' => $this->dqHistoryService->getNetworkDqSummary(),
        ]);
    }

    /**
     * GET /v1/network/ares/dq-overlay
     */
    public function dqOverlay(): JsonResponse
    {
        return response()->json([
            'data' => $this->dqHistoryService->getNetworkDqOverlay(),
        ]);
    }

    // ── Network Annotations ──────────────────────────────────────────────

    /**
     * GET /v1/network/ares/annotations
     */
    public function annotations(Request $request): JsonResponse
    {
        $tag = is_string($request->query('tag')) ? $request->query('tag') : null;
        $search = is_string($request->query('search')) ? $request->query('search') : null;

        return response()->json([
            'data' => $this->annotationService->allForNetwork($tag, $search),
        ]);
    }

    // ── Network Cost ──────────────────────────────────────────────────────

    /**
     * GET /v1/network/ares/cost
     */
    public function cost(): JsonResponse
    {
        return response()->json([
            'data' => $this->costService->getNetworkCost(),
        ]);
    }

    /**
     * GET /v1/network/ares/cost/compare
     */
    public function costCompare(): JsonResponse
    {
        return response()->json([
            'data' => $this->costService->getNetworkCompare(),
        ]);
    }

    // ── Releases ──────────────────────────────────────────────────────────

    /**
     * GET /v1/network/ares/releases/timeline
     * Swimlane data: all sources with their releases.
     */
    public function releasesTimeline(): JsonResponse
    {
        $sources = \App\Models\App\Source::whereHas('daimons')->with(['releases' => function ($q) {
            $q->orderByDesc('created_at');
        }])->get();

        $lanes = [];
        foreach ($sources as $source) {
            $releases = $source->releases->map(fn (SourceRelease $r) => [
                'id' => $r->id,
                'name' => $r->release_name,
                'date' => $r->created_at->toISOString(),
                'type' => $r->release_type,
            ])->all();

            $lanes[] = [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'releases' => $releases,
            ];
        }

        return response()->json(['data' => $lanes]);
    }

    /**
     * GET /v1/network/ares/releases/calendar
     * Calendar heatmap data: release events by date.
     */
    public function releasesCalendar(): JsonResponse
    {
        $releases = SourceRelease::with('source')
            ->orderBy('created_at')
            ->get();

        $events = $releases->map(fn (SourceRelease $r) => [
            'date' => $r->created_at->format('Y-m-d'),
            'source_name' => $r->source?->source_name ?? 'Unknown',
            'release_name' => $r->release_name,
            'type' => $r->release_type,
        ])->all();

        return response()->json(['data' => $events]);
    }
}
