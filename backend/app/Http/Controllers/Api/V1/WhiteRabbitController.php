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

#[Group('WhiteRabbit Database Profiler', weight: 230)]
class WhiteRabbitController extends Controller
{
    private string $whiteRabbitUrl;

    public function __construct()
    {
        $this->whiteRabbitUrl = rtrim(config('services.blackrabbit.url', config('services.whiterabbit.url', 'http://blackrabbit:8090')), '/');
    }

    /**
     * POST /api/v1/etl/scan
     *
     * Scan a source database with WhiteRabbit to produce a field-overview report.
     * Either supply source_id (resolves connection from the Sources registry) or
     * raw connection parameters (dbms, server, port, user, password, schema).
     * Proxies to POST {whiteRabbitUrl}/scan. Timeout: 600 s.
     */
    public function scan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            // Option A — resolve connection from Sources registry
            'source_id' => 'nullable|integer|exists:sources,id',

            // Option B — raw connection parameters
            'dbms' => 'nullable|string|max:64',
            'server' => 'nullable|string|max:255',
            'port' => 'nullable|integer|min:1|max:65535',
            'user' => 'nullable|string|max:255',
            'password' => 'nullable|string|max:255',
            'schema' => 'nullable|string|max:255',

            // Common options
            'tables' => 'nullable|array',
            'tables.*' => 'string|max:255',
        ]);

        // Require either source_id OR raw connection params
        if (empty($validated['source_id']) && empty($validated['server'])) {
            return response()->json([
                'error' => 'Validation failed',
                'message' => 'Provide either source_id or raw connection parameters (dbms, server, user, password, schema).',
            ], 422);
        }

        try {
            $payload = [];

            if (! empty($validated['source_id'])) {
                /** @var Source $source */
                $source = Source::with('daimons')->findOrFail($validated['source_id']);

                $payload['connection'] = HadesBridgeService::buildSourceSpec($source);
            } else {
                $payload['connection'] = [
                    'dbms' => $validated['dbms'] ?? 'postgresql',
                    'server' => $validated['server'],
                    'port' => $validated['port'] ?? 5432,
                    'user' => $validated['user'],
                    'password' => $validated['password'],
                    'schema' => $validated['schema'] ?? 'public',
                ];
            }

            if (! empty($validated['tables'])) {
                $payload['tables'] = $validated['tables'];
            }

            Log::info('WhiteRabbit scan started', [
                'source_id' => $validated['source_id'] ?? null,
                'server' => $payload['connection']['server'] ?? null,
            ]);

            // Scans can take many minutes on large databases (SynPUF etc.)
            $response = Http::timeout(1200)->post(
                "{$this->whiteRabbitUrl}/scan",
                $payload
            );

            if ($response->failed()) {
                Log::error('WhiteRabbit scan failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'WhiteRabbit scan failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('WhiteRabbitController::scan exception', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to run WhiteRabbit scan',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/v1/etl/scan/health
     *
     * Check the health of the WhiteRabbit sidecar service.
     * Proxies to GET {whiteRabbitUrl}/health. Timeout: 10 s.
     */
    public function health(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get(
                "{$this->whiteRabbitUrl}/health"
            );

            if ($response->failed()) {
                return response()->json([
                    'error' => 'WhiteRabbit service unavailable',
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'WhiteRabbit service unreachable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }
}
