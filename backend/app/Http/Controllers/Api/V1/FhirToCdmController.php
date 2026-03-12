<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('FHIR to CDM', weight: 232)]
class FhirToCdmController extends Controller
{
    private string $fhirToCdmUrl;

    public function __construct()
    {
        $this->fhirToCdmUrl = rtrim(config('services.fhir_to_cdm.url', 'http://fhir-to-cdm:8091'), '/');
    }

    /**
     * POST /api/v1/etl/fhir/ingest
     *
     * Ingest a single FHIR R4 Bundle (JSON) and convert it to OMOP CDM rows.
     * The request body is forwarded verbatim to POST {fhirToCdmUrl}/ingest.
     * Timeout: 300 s.
     */
    public function ingest(Request $request): JsonResponse
    {
        try {
            $body = $request->getContent();

            if (empty($body)) {
                return response()->json([
                    'error' => 'Validation failed',
                    'message' => 'Request body must contain a FHIR Bundle JSON document.',
                ], 422);
            }

            Log::info('FhirToCdm ingest started', [
                'content_length' => strlen($body),
                'content_type' => $request->header('Content-Type'),
            ]);

            $response = Http::timeout(300)
                ->withBody($body, $request->header('Content-Type', 'application/fhir+json'))
                ->post("{$this->fhirToCdmUrl}/ingest");

            if ($response->failed()) {
                Log::error('FhirToCdm ingest failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'FHIR ingestion failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('FhirToCdmController::ingest exception', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to ingest FHIR Bundle',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/v1/etl/fhir/batch
     *
     * Ingest a FHIR NDJSON stream (one resource per line) and convert all resources
     * to OMOP CDM rows. The request body is forwarded verbatim to POST {fhirToCdmUrl}/batch.
     * Timeout: 300 s.
     */
    public function batch(Request $request): JsonResponse
    {
        try {
            $body = $request->getContent();

            if (empty($body)) {
                return response()->json([
                    'error' => 'Validation failed',
                    'message' => 'Request body must contain FHIR NDJSON content.',
                ], 422);
            }

            Log::info('FhirToCdm batch started', [
                'content_length' => strlen($body),
            ]);

            $response = Http::timeout(300)
                ->withBody($body, $request->header('Content-Type', 'application/x-ndjson'))
                ->post("{$this->fhirToCdmUrl}/batch");

            if ($response->failed()) {
                Log::error('FhirToCdm batch failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'FHIR batch ingestion failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('FhirToCdmController::batch exception', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to process FHIR batch',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/v1/etl/fhir/health
     *
     * Check the health of the FhirToCdm sidecar service.
     * Proxies to GET {fhirToCdmUrl}/health. Timeout: 10 s.
     */
    public function health(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get(
                "{$this->fhirToCdmUrl}/health"
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'FhirToCdm service unavailable',
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'FhirToCdm service unreachable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }
}
