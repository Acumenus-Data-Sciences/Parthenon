<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * @group HADES Runtime Capabilities
 */
class HadesCapabilityController extends Controller
{
    private string $darkstarUrl;

    public function __construct()
    {
        $this->darkstarUrl = rtrim(config('services.darkstar.url', 'http://darkstar:8787'), '/');
    }

    /**
     * GET /api/v1/hades/packages
     *
     * Return the OHDSI/HADES package capability matrix reported by Darkstar.
     */
    public function packages(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get("{$this->darkstarUrl}/hades/packages");

            if ($response->failed()) {
                Log::warning('HADES package inventory request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Failed to retrieve HADES package inventory',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            $payload = $response->json();

            if (! is_array($payload)) {
                return response()->json([
                    'error' => 'Darkstar returned a malformed package inventory response',
                ], 502);
            }

            return response()->json(['data' => $this->applyShinyNoHostingPolicy($payload)]);
        } catch (\Throwable $e) {
            Log::warning('HADES package inventory request could not reach Darkstar', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Darkstar unavailable',
                'message' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * Enforce the Phase 8 architecture decision at the Laravel boundary too:
     * OHDSI Shiny packages may exist for artifact compatibility, but Parthenon
     * does not expose hosted Shiny apps or iframed Shiny sessions.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function applyShinyNoHostingPolicy(array $payload): array
    {
        $payload['shiny_policy'] = [
            'expose_hosted_surfaces' => false,
            'allow_iframe_embedding' => false,
            'allow_user_supplied_app_paths' => false,
            'decision' => 'superseded_by_native_parthenon',
            'replacement_surface' => 'Parthenon native React result, diagnostics, publishing, and study package workflows',
        ];

        if (! is_array($payload['packages'] ?? null)) {
            return $payload;
        }

        $payload['packages'] = array_map(static function ($package): mixed {
            if (! is_array($package)) {
                return $package;
            }

            if (! in_array((string) ($package['package'] ?? ''), ['OhdsiShinyAppBuilder', 'OhdsiShinyModules'], true)) {
                return $package;
            }

            return [
                ...$package,
                'surface' => 'native_replacement_no_hosting',
                'priority' => 'superseded',
                'hosted_surface' => false,
                'exposure_policy' => 'not_exposed',
                'decision' => 'superseded_by_native_parthenon',
                'replacement_surface' => 'Parthenon native React result, diagnostics, publishing, and study package workflows',
            ];
        }, $payload['packages']);

        return $payload;
    }
}
