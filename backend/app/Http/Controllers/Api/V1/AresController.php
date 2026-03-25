<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAnnotationRequest;
use App\Http\Requests\Api\StoreReleaseRequest;
use App\Http\Requests\Api\UpdateAnnotationRequest;
use App\Http\Requests\Api\UpdateReleaseRequest;
use App\Models\App\ChartAnnotation;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Services\Ares\AnnotationService;
use App\Services\Ares\DqHistoryService;
use App\Services\Ares\ReleaseService;
use App\Services\Ares\UnmappedCodeService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AresController extends Controller
{
    public function __construct(
        private readonly ReleaseService $releaseService,
        private readonly AnnotationService $annotationService,
        private readonly DqHistoryService $dqHistoryService,
        private readonly UnmappedCodeService $unmappedCodeService,
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

        if (is_string($chartType) && $chartType !== '') {
            $annotations = $this->annotationService->forChart($chartType, $source->id);
        } else {
            $annotations = $this->annotationService->allForSource($source->id);
        }

        return response()->json(['data' => $annotations]);
    }

    /**
     * POST /v1/sources/{source}/ares/annotations
     */
    public function storeAnnotation(StoreAnnotationRequest $request, Source $source): JsonResponse
    {
        /** @var \App\Models\User $user */
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
        /** @var \App\Models\User $user */
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
        /** @var \App\Models\User $user */
        $user = $request->user();

        try {
            $this->annotationService->delete($user, $annotation);
        } catch (AuthorizationException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        }

        return response()->json(['message' => 'Annotation deleted']);
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

    // ── Unmapped Codes ─────────────────────────────────────────────────

    /**
     * GET /v1/sources/{source}/ares/unmapped-codes/summary?release_id={id}
     */
    public function unmappedCodesSummary(Source $source): JsonResponse
    {
        $releaseId = (int) request()->query('release_id');
        $release = SourceRelease::findOrFail($releaseId);

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
}
