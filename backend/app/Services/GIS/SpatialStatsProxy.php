<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SpatialStatsProxy
{
    private string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * Proxy spatial statistics request to Python FastAPI service.
     */
    public function compute(array $payload): array
    {
        $analysisType = $payload['analysis_type'] ?? 'morans_i';
        $endpoint = match ($analysisType) {
            'morans_i' => '/gis-analytics/morans-i',
            'hotspots' => '/gis-analytics/hotspots',
            'regression' => '/gis-analytics/regression',
            'correlation' => '/gis-analytics/correlation',
            'drive_time' => '/gis-analytics/drive-time',
            default => throw new \InvalidArgumentException("Unknown analysis type: {$analysisType}"),
        };

        $response = Http::timeout(60)->post("{$this->aiServiceUrl}{$endpoint}", $payload);

        if ($response->failed()) {
            Log::error('Spatial stats proxy failed', [
                'endpoint' => $endpoint,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \RuntimeException("Spatial stats computation failed: {$response->status()}");
        }

        return $response->json();
    }
}
