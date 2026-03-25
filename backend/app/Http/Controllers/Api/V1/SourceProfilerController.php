<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RunScanRequest;
use App\Models\App\Source;
use App\Models\App\SourceProfile;
use App\Services\Profiler\SourceProfilerService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

#[Group('Source Profiler', weight: 231)]
class SourceProfilerController extends Controller
{
    public function __construct(
        private readonly SourceProfilerService $profilerService,
    ) {}

    /**
     * GET /sources/{source}/profiles
     *
     * List scan history for a source (newest first, paginated).
     */
    public function index(Source $source): JsonResponse
    {
        $profiles = $source->sourceProfiles()
            ->where('scan_type', 'whiterabbit')
            ->orderByDesc('created_at')
            ->paginate(20, ['id', 'source_id', 'scan_type', 'scan_time_seconds', 'overall_grade', 'table_count', 'column_count', 'total_rows', 'summary_json', 'created_at']);

        return response()->json($profiles);
    }

    /**
     * GET /sources/{source}/profiles/{profile}
     *
     * Single scan with all field profiles.
     */
    public function show(Source $source, SourceProfile $profile): JsonResponse
    {
        if ($profile->source_id !== $source->id) {
            return response()->json(['error' => 'Profile does not belong to this source'], 404);
        }

        $profile->load('fields');

        return response()->json(['data' => $profile]);
    }

    /**
     * POST /sources/{source}/profiles/scan
     *
     * Trigger a WhiteRabbit scan, persist results, return profile.
     */
    public function scan(RunScanRequest $request, Source $source): JsonResponse
    {
        try {
            $profile = $this->profilerService->scan(
                $source,
                $request->input('tables'),
                $request->integer('sample_rows', 100000),
            );

            return response()->json([
                'data' => $profile->only([
                    'id', 'source_id', 'overall_grade', 'table_count',
                    'column_count', 'total_rows', 'scan_time_seconds', 'summary_json',
                ]),
                'message' => 'Scan completed and saved.',
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Profiler scan request failed', [
                'source_id' => $source->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Scan failed',
                'message' => 'Unable to complete database scan. Check that the source is accessible.',
            ], 502);
        }
    }

    /**
     * GET /sources/{source}/profiles/compare
     *
     * Compare two scans side-by-side (Phase 2 — not yet implemented).
     */
    public function compare(): JsonResponse
    {
        return response()->json(['error' => 'Not implemented — Phase 2'], 501);
    }

    /**
     * DELETE /sources/{source}/profiles/{profile}
     *
     * Delete a scan and its field profiles (cascade).
     */
    public function destroy(Source $source, SourceProfile $profile): JsonResponse
    {
        if ($profile->source_id !== $source->id) {
            return response()->json(['error' => 'Profile does not belong to this source'], 404);
        }

        $profile->delete();

        return response()->json(null, 204);
    }
}
