<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\RunFeasibilityRequest;
use App\Models\User;
use App\Services\Ares\AnnotationService;
use App\Services\Ares\CostService;
use App\Services\Ares\CoverageService;
use App\Services\Ares\DiversityService;
use App\Services\Ares\DqHistoryService;
use App\Services\Ares\FeasibilityService;
use App\Services\Ares\NetworkComparisonService;
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

        return response()->json([
            'data' => [
                'source_count' => $sourceCount,
                'avg_dq_score' => $avgDqScore,
                'total_unmapped_codes' => 0, // Populated in Phase 4 (UnmappedCodeService)
                'sources_needing_attention' => count(array_filter($dqSummary, fn ($s) => $s['pass_rate'] < 80)),
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

    // ── Network Annotations ──────────────────────────────────────────────

    /**
     * GET /v1/network/ares/annotations
     */
    public function annotations(): JsonResponse
    {
        return response()->json([
            'data' => $this->annotationService->allForNetwork(),
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
}
