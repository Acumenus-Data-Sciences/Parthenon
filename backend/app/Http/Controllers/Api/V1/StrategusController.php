<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\DaimonType;
use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Services\Analysis\HadesBridgeService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('Strategus', weight: 220)]
class StrategusController extends Controller
{
    private string $rRuntimeUrl;

    public function __construct()
    {
        $this->rRuntimeUrl = rtrim(config('services.r_runtime.url', 'http://r-runtime:8787'), '/');
    }

    /**
     * POST /api/v1/strategus/execute
     *
     * Execute a Strategus multi-analysis study package.
     * Proxies to R Plumber at /strategus/execute.
     */
    public function execute(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
            'study_name' => 'required|string|max:255',
            'analysis_spec' => 'required|array',
        ]);

        try {
            /** @var Source $source */
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            $cdmSchema = $source->getTableQualifier(DaimonType::CDM) ?? 'omop';
            $resultsSchema = $source->getTableQualifier(DaimonType::Results) ?? 'public';

            $spec = [
                'connection' => HadesBridgeService::buildSourceSpec($source),
                'cdm_database_schema' => $cdmSchema,
                'cohort_database_schema' => $resultsSchema,
                'cohort_table' => 'cohort',
                'results_database_schema' => $resultsSchema,
                'study_name' => $validated['study_name'],
                'analysis_spec' => $validated['analysis_spec'],
            ];

            Log::info('Strategus execution started', [
                'study_name' => $validated['study_name'],
                'source_id' => $validated['source_id'],
            ]);

            // Strategus studies can run for 30+ minutes
            $response = Http::timeout(1800)->post(
                "{$this->rRuntimeUrl}/strategus/execute",
                $spec
            );

            if ($response->failed()) {
                Log::error('Strategus R call failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Strategus execution failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('StrategusController::execute exception', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to execute Strategus study',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/v1/strategus/validate
     *
     * Validate a Strategus analysis specification without executing.
     */
    public function validate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'analysis_spec' => 'required|array',
        ]);

        try {
            $response = Http::timeout(30)->post(
                "{$this->rRuntimeUrl}/strategus/validate",
                ['analysis_spec' => $validated['analysis_spec']]
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'Strategus validation failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Failed to validate Strategus spec',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/v1/strategus/modules
     *
     * List available Strategus analysis modules.
     */
    public function modules(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get(
                "{$this->rRuntimeUrl}/strategus/modules"
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'Failed to retrieve Strategus modules',
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'R runtime unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }
}
