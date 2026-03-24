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
use App\Services\Ares\ReleaseService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AresController extends Controller
{
    public function __construct(
        private readonly ReleaseService $releaseService,
        private readonly AnnotationService $annotationService,
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
}
