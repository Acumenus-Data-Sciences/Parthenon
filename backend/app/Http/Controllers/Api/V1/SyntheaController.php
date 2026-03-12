<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Services\Analysis\HadesBridgeService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('Synthea Data Generation', weight: 231)]
class SyntheaController extends Controller
{
    private string $rRuntimeUrl;

    public function __construct()
    {
        $this->rRuntimeUrl = rtrim(config('services.r_runtime.url', 'http://r-runtime:8787'), '/');
    }

    /**
     * POST /api/v1/etl/synthea/generate
     *
     * Generate synthetic patient data with Synthea and load it into an OMOP CDM via ETL-Synthea.
     * Resolves the target source connection from the Sources registry then proxies to
     * POST {rRuntimeUrl}/etl/synthea/generate. Timeout: 1800 s.
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id'           => 'required|integer|exists:sources,id',
            'patient_count'       => 'required|integer|min:1|max:100000',
            'synthea_csv_folder'  => 'required|string|max:512',
            'cdm_version'         => 'nullable|string|max:16',
            'skip_cdm_create'     => 'nullable|boolean',
            'skip_synthea_create' => 'nullable|boolean',
        ]);

        try {
            /** @var Source $source */
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            $payload = [
                'connection'          => HadesBridgeService::buildSourceSpec($source),
                'patient_count'       => $validated['patient_count'],
                'synthea_csv_folder'  => $validated['synthea_csv_folder'],
                'cdm_version'         => $validated['cdm_version'] ?? '5.4',
                'skip_cdm_create'     => $validated['skip_cdm_create'] ?? false,
                'skip_synthea_create' => $validated['skip_synthea_create'] ?? false,
            ];

            Log::info('Synthea generation started', [
                'source_id'     => $validated['source_id'],
                'patient_count' => $validated['patient_count'],
            ]);

            // ETL-Synthea can run for 30+ minutes on large patient counts
            $response = Http::timeout(1800)->post(
                "{$this->rRuntimeUrl}/etl/synthea/generate",
                $payload
            );

            if ($response->failed()) {
                Log::error('Synthea generation failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                return response()->json([
                    'error'  => 'Synthea generation failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('SyntheaController::generate exception', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error'   => 'Failed to run Synthea generation',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/v1/etl/synthea/status
     *
     * Check the status of the ETL-Synthea endpoint in the R runtime service.
     * Proxies to GET {rRuntimeUrl}/etl/synthea/status. Timeout: 10 s.
     */
    public function status(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get(
                "{$this->rRuntimeUrl}/etl/synthea/status"
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'R runtime ETL-Synthea endpoint unavailable',
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            return response()->json([
                'error'   => 'R runtime service unreachable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }
}
