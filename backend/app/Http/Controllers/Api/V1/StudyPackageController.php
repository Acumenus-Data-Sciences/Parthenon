<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Study;
use App\Models\App\StudyPackage;
use App\Services\Studies\StudyPackageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Studies
 */
class StudyPackageController extends Controller
{
    public function __construct(
        private readonly StudyPackageService $packages,
    ) {}

    /**
     * GET /v1/studies/{study}/packages
     *
     * List reproducible study packages (snapshot metadata, newest first).
     */
    public function index(Study $study): JsonResponse
    {
        try {
            $packages = StudyPackage::query()
                ->where('study_id', $study->id)
                ->orderByDesc('version')
                ->get()
                ->map(fn (StudyPackage $package): array => $this->presentSummary($package));

            return response()->json(['data' => $packages]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve study packages', $e);
        }
    }

    /**
     * POST /v1/studies/{study}/package
     *
     * Build a new reproducible snapshot of the study.
     */
    public function store(Request $request, Study $study): JsonResponse
    {
        try {
            $package = $this->packages->build($study, $request->user()?->id);

            return response()->json([
                'data' => $this->presentSummary($package),
                'message' => 'Study package created.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to build study package', $e);
        }
    }

    /**
     * GET /v1/studies/{study}/packages/{studyPackage}/export
     *
     * Download the full package bundle.
     */
    public function export(Study $study, StudyPackage $studyPackage): JsonResponse
    {
        if ((int) $studyPackage->study_id !== (int) $study->id) {
            return response()->json(['message' => 'Package does not belong to this study.'], 404);
        }

        return response()->json($this->packages->export($studyPackage));
    }

    /**
     * @return array<string, mixed>
     */
    private function presentSummary(StudyPackage $package): array
    {
        return [
            'id' => $package->id,
            'study_id' => $package->study_id,
            'version' => $package->version,
            'bundle_sha256' => $package->bundle_sha256,
            'vocabulary_version' => $package->vocabulary_version,
            'cdm_source_release' => $package->cdm_source_release,
            'created_by' => $package->created_by,
            'created_at' => $package->created_at,
        ];
    }

    /**
     * Build a standardized error response for service failures.
     */
    private function errorResponse(string $message, \Throwable $exception): JsonResponse
    {
        $response = [
            'error' => $message,
            'message' => $exception->getMessage(),
        ];

        if (config('app.debug')) {
            $response['trace'] = $exception->getTraceAsString();
        }

        return response()->json($response, 500);
    }
}
