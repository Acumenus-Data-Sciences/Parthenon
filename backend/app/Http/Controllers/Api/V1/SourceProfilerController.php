<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RunScanRequest;
use App\Models\App\Source;
use App\Models\App\SourceProfile;
use App\Services\Profiler\ScanComparisonService;
use App\Services\Profiler\SourceProfilerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @group Source Profiler
 */
class SourceProfilerController extends Controller
{
    public function __construct(
        private readonly SourceProfilerService $profilerService,
        private readonly ScanComparisonService $comparisonService,
    ) {}

    /**
     * GET /sources/{source}/profiles
     *
     * List scan history for a source (newest first, paginated).
     */
    public function index(Source $source): JsonResponse
    {
        $profiles = $source->sourceProfiles()
            ->whereIn('scan_type', ['blackrabbit', 'whiterabbit'])
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
     * GET /sources/{source}/profiles/compare?current={id}&baseline={id}
     *
     * Compare two scans side-by-side: regressions, improvements, schema changes.
     */
    public function compare(Request $request, Source $source): JsonResponse
    {
        $request->validate([
            'current' => ['required', 'integer'],
            'baseline' => ['required', 'integer'],
        ]);

        $current = SourceProfile::where('source_id', $source->id)
            ->findOrFail($request->integer('current'));
        $baseline = SourceProfile::where('source_id', $source->id)
            ->findOrFail($request->integer('baseline'));

        $diff = $this->comparisonService->compare($current, $baseline);

        return response()->json(['data' => $diff]);
    }

    /**
     * POST /sources/{source}/scan-profiles/scan-async
     */
    public function scanAsync(RunScanRequest $request, Source $source): JsonResponse
    {
        try {
            $scanId = $this->profilerService->startScan(
                $source,
                $request->input('tables'),
                $request->integer('sample_rows', 100000),
            );

            return response()->json([
                'data' => ['scan_id' => $scanId, 'source_id' => $source->id],
                'message' => 'Scan started.',
            ]);
        } catch (\Throwable $e) {
            Log::error('Profiler async scan request failed', [
                'source_id' => $source->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Scan failed to start',
                'message' => $e->getMessage(),
            ], 502);
        }
    }

    /**
     * GET /sources/{source}/scan-profiles/scan-progress/{scanId}
     */
    public function scanProgress(Source $source, string $scanId): StreamedResponse
    {
        $url = $this->profilerService->progressUrl($scanId);

        return new StreamedResponse(function () use ($url) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_HTTPHEADER => ['Accept: text/event-stream'],
                CURLOPT_WRITEFUNCTION => function ($ch, $data) {
                    echo $data;
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();

                    return strlen($data);
                },
                CURLOPT_TIMEOUT => 1200,
            ]);
            curl_exec($ch);
            curl_close($ch);
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * POST /sources/{source}/scan-profiles/scan-complete/{scanId}
     */
    public function scanComplete(Request $request, Source $source, string $scanId): JsonResponse
    {
        try {
            $profile = $this->profilerService->fetchAndPersist($source, $scanId);

            return response()->json([
                'data' => $profile->only([
                    'id', 'source_id', 'overall_grade', 'table_count',
                    'column_count', 'total_rows', 'scan_time_seconds', 'summary_json',
                ]),
                'message' => 'Scan completed and saved.',
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Profiler scan complete failed', [
                'source_id' => $source->id,
                'scan_id' => $scanId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to persist scan results',
                'message' => $e->getMessage(),
            ], 502);
        }
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
