<?php

namespace App\Http\Controllers\Api\V1;

use App\Concerns\SourceAware;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAnnotationRequest;
use App\Http\Requests\Api\StoreReleaseRequest;
use App\Http\Requests\Api\UpdateAnnotationRequest;
use App\Http\Requests\Api\UpdateReleaseRequest;
use App\Models\App\AcceptedMapping;
use App\Models\App\ChartAnnotation;
use App\Models\App\DqSlaTarget;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedSourceCode;
use App\Models\User;
use App\Services\Ares\AnnotationService;
use App\Services\Ares\CostService;
use App\Services\Ares\DiversityService;
use App\Services\Ares\DqHistoryService;
use App\Services\Ares\MappingSuggestionService;
use App\Services\Ares\ReleaseDiffService;
use App\Services\Ares\ReleaseService;
use App\Services\Ares\UnmappedCodeService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Data Explorer
 */
class AresController extends Controller
{
    use SourceAware;

    public function __construct(
        private readonly ReleaseService $releaseService,
        private readonly AnnotationService $annotationService,
        private readonly DqHistoryService $dqHistoryService,
        private readonly UnmappedCodeService $unmappedCodeService,
        private readonly CostService $costService,
        private readonly DiversityService $diversityService,
        private readonly ReleaseDiffService $releaseDiffService,
        private readonly MappingSuggestionService $mappingSuggestionService,
    ) {}

    // ── Releases ────────────────────────────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/releases
     */
    public function releases(Source $source): JsonResponse
    {
        $releases = $this->releaseService->getTimeline($source);

        return response()->json(['data' => $releases]);
    }

    /**
     * GET /v1/sources/{source}/ares/releases/{release}
     */
    public function showRelease(Source $source, SourceRelease $release): JsonResponse
    {
        $release->load(['achillesRuns', 'dqdResults']);

        return response()->json(['data' => $release]);
    }

    /**
     * POST /v1/sources/{source}/ares/releases
     */
    public function storeRelease(StoreReleaseRequest $request, Source $source): JsonResponse
    {
        $release = $this->releaseService->createRelease($source, $request->validated());

        return response()->json(['data' => $release], 201);
    }

    /**
     * PUT /v1/sources/{source}/ares/releases/{release}
     */
    public function updateRelease(UpdateReleaseRequest $request, Source $source, SourceRelease $release): JsonResponse
    {
        $updated = $this->releaseService->updateRelease($release, $request->validated());

        return response()->json(['data' => $updated]);
    }

    /**
     * DELETE /v1/sources/{source}/ares/releases/{release}
     */
    public function destroyRelease(Source $source, SourceRelease $release): JsonResponse
    {
        $this->releaseService->deleteRelease($release);

        return response()->json(['message' => 'Release deleted']);
    }

    // ── Annotations ─────────────────────────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/annotations
     */
    public function annotations(Request $request, Source $source): JsonResponse
    {
        $chartType = $request->query('chart_type');
        $tag = is_string($request->query('tag')) ? $request->query('tag') : null;
        $search = is_string($request->query('search')) ? $request->query('search') : null;

        if (is_string($chartType) && $chartType !== '') {
            $annotations = $this->annotationService->forChart($chartType, $source->id);
        } else {
            $annotations = $this->annotationService->allForSource($source->id, $tag, $search);
        }

        return response()->json(['data' => $annotations]);
    }

    /**
     * POST /v1/sources/{source}/ares/annotations
     */
    public function storeAnnotation(StoreAnnotationRequest $request, Source $source): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = [
            ...$request->validated(),
            'source_id' => $source->id,
        ];

        $annotation = $this->annotationService->create($user, $data);

        return response()->json(['data' => $annotation], 201);
    }

    /**
     * PUT /v1/sources/{source}/ares/annotations/{annotation}
     */
    public function updateAnnotation(UpdateAnnotationRequest $request, Source $source, ChartAnnotation $annotation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        try {
            $updated = $this->annotationService->update($user, $annotation, $request->validated());
        } catch (AuthorizationException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        }

        return response()->json(['data' => $updated]);
    }

    /**
     * DELETE /v1/sources/{source}/ares/annotations/{annotation}
     */
    public function destroyAnnotation(Request $request, Source $source, ChartAnnotation $annotation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        try {
            $this->annotationService->delete($user, $annotation);
        } catch (AuthorizationException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        }

        return response()->json(['message' => 'Annotation deleted']);
    }

    /**
     * GET /v1/sources/{source}/ares/annotations/timeline
     */
    public function annotationTimeline(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->annotationService->timeline($source->id),
        ]);
    }

    // ── DQ History ─────────────────────────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/dq-history
     */
    public function dqHistory(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->dqHistoryService->getTrends($source),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/dq-history/deltas?release_id={id}
     */
    public function dqHistoryDeltas(Source $source): JsonResponse
    {
        $releaseId = (int) request()->query('release_id');

        if (! $releaseId) {
            return response()->json(['error' => 'release_id is required'], 422);
        }

        return response()->json([
            'data' => $this->dqHistoryService->getDeltas($releaseId),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/dq-history/category-trends
     */
    public function dqHistoryCategoryTrends(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->dqHistoryService->getCategoryTrends($source),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/dq-history/domain-trends
     */
    public function dqHistoryDomainTrends(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->dqHistoryService->getDomainTrends($source),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/dq-history/heatmap
     */
    public function dqHistoryHeatmap(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->dqHistoryService->getCategoryHeatmap($source),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/dq-history/sparklines?release_id={id}
     */
    public function dqHistorySparklines(Source $source): JsonResponse
    {
        $releaseId = (int) request()->query('release_id');

        if (! $releaseId) {
            return response()->json(['error' => 'release_id is required'], 422);
        }

        return response()->json([
            'data' => $this->dqHistoryService->getCheckSparklines($releaseId),
        ]);
    }

    // ── Unmapped Codes ─────────────────────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/unmapped-codes/summary?release_id={id}
     */
    public function unmappedCodesSummary(Source $source): JsonResponse
    {
        $releaseId = request()->query('release_id');
        if (! $releaseId) {
            $release = SourceRelease::where('source_id', $source->id)
                ->orderByDesc('created_at')
                ->first();
            if (! $release) {
                return response()->json(['data' => []]);
            }
        } else {
            $release = SourceRelease::findOrFail((int) $releaseId);
        }

        return response()->json([
            'data' => $this->unmappedCodeService->getSummary($source, $release),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/unmapped-codes?release_id=&table=&field=&page=
     */
    public function unmappedCodes(Source $source): JsonResponse
    {
        $releaseId = (int) request()->query('release_id');
        $release = SourceRelease::findOrFail($releaseId);

        $filters = [
            'table' => request()->query('table'),
            'field' => request()->query('field'),
            'search' => request()->query('search'),
        ];

        $page = (int) request()->query('page', 1);
        $perPage = min((int) request()->query('per_page', 20), 100);

        $paginated = $this->unmappedCodeService->getDetails($source, $release, $filters, $page, $perPage);

        return response()->json([
            'data' => $paginated->items(),
            'meta' => [
                'total' => $paginated->total(),
                'page' => $paginated->currentPage(),
                'per_page' => $paginated->perPage(),
                'last_page' => $paginated->lastPage(),
            ],
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/unmapped-codes/pareto?release_id={id}
     */
    public function unmappedCodesPareto(Source $source): JsonResponse
    {
        $releaseId = (int) request()->query('release_id');
        $release = SourceRelease::findOrFail($releaseId);

        return response()->json([
            'data' => $this->unmappedCodeService->getParetoData($source, $release),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/unmapped-codes/progress?release_id={id}
     */
    public function unmappedCodesProgress(Source $source): JsonResponse
    {
        $releaseId = (int) request()->query('release_id');
        $release = SourceRelease::findOrFail($releaseId);

        return response()->json([
            'data' => $this->unmappedCodeService->getProgressStats($source, $release),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/unmapped-codes/treemap?release_id={id}
     */
    public function unmappedCodesTreemap(Source $source): JsonResponse
    {
        $releaseId = (int) request()->query('release_id');
        $release = SourceRelease::findOrFail($releaseId);

        return response()->json([
            'data' => $this->unmappedCodeService->getVocabularyTreemap($source, $release),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/unmapped-codes/export?release_id={id}&format=usagi|csv
     */
    public function unmappedCodesExport(Source $source): JsonResponse
    {
        $releaseId = (int) request()->query('release_id');
        $release = SourceRelease::findOrFail($releaseId);

        $exportData = $this->unmappedCodeService->exportUsagi($source, $release);

        $format = request()->query('format', 'csv');

        if ($format === 'usagi') {
            $csv = implode(',', $exportData['headers'])."\n";
            foreach ($exportData['rows'] as $row) {
                $csv .= implode(',', array_map(fn ($v) => '"'.str_replace('"', '""', (string) $v).'"', $row))."\n";
            }

            return response()->json([
                'data' => [
                    'format' => 'usagi',
                    'filename' => "unmapped_codes_{$source->source_name}_{$release->release_name}.csv",
                    'content' => $csv,
                ],
            ]);
        }

        return response()->json(['data' => $exportData]);
    }

    // ── Domain Continuity ──────────────────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/domain-continuity
     */
    public function domainContinuity(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->dqHistoryService->getDomainContinuity($source),
        ]);
    }

    // ── Cost ────────────────────────────────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/cost/summary?cost_type_concept_id=
     */
    public function costSummary(Source $source): JsonResponse
    {
        $costType = request()->query('cost_type_concept_id')
            ? (int) request()->query('cost_type_concept_id')
            : null;

        return response()->json([
            'data' => $this->costService->getSummary($source, $costType),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/cost/trends?cost_type_concept_id=
     */
    public function costTrends(Source $source): JsonResponse
    {
        $costType = request()->query('cost_type_concept_id')
            ? (int) request()->query('cost_type_concept_id')
            : null;

        return response()->json([
            'data' => $this->costService->getTrends($source, $costType),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/cost/domains/{domain}
     */
    public function costDomainDetail(Source $source, string $domain): JsonResponse
    {
        return response()->json([
            'data' => $this->costService->getDomainDetail($source, $domain),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/cost/distribution?domain=&cost_type=
     */
    public function costDistribution(Source $source): JsonResponse
    {
        $domain = is_string(request()->query('domain')) ? request()->query('domain') : null;
        $costType = request()->query('cost_type') ? (int) request()->query('cost_type') : null;

        return response()->json([
            'data' => $this->costService->getDistribution($source, $domain, $costType),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/cost/care-setting
     */
    public function costCareSetting(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->costService->getCareSettingBreakdown($source),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/cost/types
     */
    public function costTypes(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->costService->getAvailableCostTypes($source),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/cost/drivers?limit=10
     * Top cost-driving concepts for a source.
     */
    public function costDrivers(Request $request, Source $source): JsonResponse
    {
        $limit = min((int) ($request->query('limit') ?? 10), 50);

        return response()->json([
            'data' => $this->costService->getCostDrivers($source, $limit),
        ]);
    }

    // ── Diversity Trends (source-scoped) ─────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/diversity/trends
     * Simpson's Diversity Index per release for a source.
     */
    public function diversityTrends(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->diversityService->getDiversityTrends($source),
        ]);
    }

    // ── DQ Radar + SLA ──────────────────────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/dq-radar
     */
    public function dqRadar(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->dqHistoryService->getRadarProfile($source),
        ]);
    }

    /**
     * POST /v1/sources/{source}/ares/dq-sla
     */
    public function dqSlaStore(Request $request, Source $source): JsonResponse
    {
        $validated = $request->validate([
            'targets' => 'required|array|min:1',
            'targets.*.category' => 'required|string|max:50',
            'targets.*.min_pass_rate' => 'required|numeric|min:0|max:100',
        ]);

        /** @var User $user */
        $user = $request->user();

        // Delete existing targets for this source, then re-create
        DqSlaTarget::where('source_id', $source->id)->delete();

        $targets = [];
        foreach ($validated['targets'] as $target) {
            $targets[] = DqSlaTarget::create([
                'source_id' => $source->id,
                'category' => $target['category'],
                'min_pass_rate' => $target['min_pass_rate'],
            ]);
        }

        return response()->json(['data' => $targets], 201);
    }

    /**
     * GET /v1/sources/{source}/ares/dq-sla
     */
    public function dqSlaIndex(Source $source): JsonResponse
    {
        $targets = DqSlaTarget::where('source_id', $source->id)->get();

        return response()->json(['data' => $targets]);
    }

    /**
     * GET /v1/sources/{source}/ares/dq-sla/compliance
     */
    public function dqSlaCompliance(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->dqHistoryService->getSlaCompliance($source),
        ]);
    }

    /**
     * GET /v1/sources/{source}/ares/dq-history/export?format=csv
     */
    public function dqHistoryExport(Source $source): JsonResponse
    {
        $format = is_string(request()->query('format')) ? request()->query('format') : 'csv';

        $exportData = $this->dqHistoryService->exportDqHistory($source, $format);

        if ($format === 'csv') {
            return response()->json([
                'data' => [
                    'format' => 'csv',
                    'filename' => "dq_history_{$source->source_name}.csv",
                    'content' => $exportData,
                ],
            ]);
        }

        return response()->json(['data' => $exportData]);
    }

    // ── Diversity (source-scoped) ──────────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/diversity/age-pyramid
     */
    public function diversityAgePyramid(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->diversityService->getAgePyramid($source),
        ]);
    }

    // ── Release Diff ──────────────────────────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/releases/{release}/diff
     */
    public function releaseDiff(Source $source, SourceRelease $release): JsonResponse
    {
        return response()->json([
            'data' => $this->releaseDiffService->computeDiff($release),
        ]);
    }

    // ── Mapping Suggestions (AI-powered via pgvector) ──────────────────

    /**
     * GET /v1/sources/{source}/ares/unmapped-codes/{codeId}/suggestions
     *
     * Returns top 5 AI-suggested standard concept mappings for an unmapped code.
     */
    public function unmappedCodeSuggestions(Source $source, int $codeId): JsonResponse
    {
        $result = $this->mappingSuggestionService->suggestForUnmappedCode($codeId);

        return response()->json(['data' => $result]);
    }

    /**
     * POST /v1/sources/{source}/ares/unmapped-codes/{codeId}/map
     *
     * Accept a mapping suggestion. Creates an AcceptedMapping record.
     * HIGHSEC: Writes to app.accepted_mappings ONLY, NOT to source_to_concept_map.
     */
    public function acceptMapping(Request $request, Source $source, int $codeId): JsonResponse
    {
        $validated = $request->validate([
            'target_concept_id' => 'required|integer',
            'confidence_score' => 'nullable|numeric|min:0|max:1',
        ]);

        /** @var User $user */
        $user = $request->user();

        // Verify the unmapped code exists and belongs to this source
        $unmappedCode = UnmappedSourceCode::where('id', $codeId)
            ->where('source_id', $source->id)
            ->firstOrFail();

        // Look up target concept name from vocabulary
        $targetConceptName = $this->vocab()
            ->table('concept')
            ->where('concept_id', $validated['target_concept_id'])
            ->value('concept_name');

        $mapping = AcceptedMapping::create([
            'source_id' => $source->id,
            'source_code' => $unmappedCode->source_code,
            'source_vocabulary_id' => $unmappedCode->source_vocabulary_id,
            'target_concept_id' => $validated['target_concept_id'],
            'target_concept_name' => $targetConceptName,
            'mapping_method' => 'ai_suggestion',
            'confidence' => $validated['confidence_score'] ?? null,
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        return response()->json(['data' => $mapping], 201);
    }
}
