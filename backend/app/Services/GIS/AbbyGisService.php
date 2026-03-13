<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AbbyGisService
{
    private string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = config('services.ai.url', 'http://python-ai:8000');
    }

    public function analyzeColumns(array $headers, array $sampleRows, array $stats, string $filename): array
    {
        try {
            $response = Http::timeout(60)->post("{$this->aiServiceUrl}/gis-import/analyze", [
                'filename' => $filename,
                'headers' => $headers,
                'sample_rows' => array_slice($sampleRows, 0, 20),
                'column_stats' => $stats,
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::warning('Abby GIS analysis failed', ['status' => $response->status(), 'body' => $response->body()]);
            return $this->fallbackAnalysis($headers, $stats);
        } catch (\Throwable $e) {
            Log::warning('Abby GIS analysis error', ['error' => $e->getMessage()]);
            return $this->fallbackAnalysis($headers, $stats);
        }
    }

    public function askAboutColumn(string $columnName, array $sampleValues, array $stats, string $question): array
    {
        try {
            $response = Http::timeout(30)->post("{$this->aiServiceUrl}/gis-import/ask", [
                'column_name' => $columnName,
                'sample_values' => $sampleValues,
                'stats' => $stats,
                'question' => $question,
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            return ['answer' => 'Abby is unavailable right now. Please map this column manually.'];
        } catch (\Throwable $e) {
            return ['answer' => 'Abby is unavailable right now. Please map this column manually.'];
        }
    }

    public function storeConfirmedMapping(array $mapping): void
    {
        try {
            Http::timeout(10)->post("{$this->aiServiceUrl}/gis-import/learn", [
                'mappings' => $mapping,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to store Abby mapping', ['error' => $e->getMessage()]);
        }
    }

    public function convertGeoFile(string $filePath): array
    {
        $response = Http::timeout(120)
            ->attach('file', file_get_contents($filePath), basename($filePath))
            ->post("{$this->aiServiceUrl}/gis-import/convert");

        if (!$response->successful()) {
            throw new \RuntimeException('Geo file conversion failed: ' . $response->body());
        }

        return $response->json();
    }

    private function fallbackAnalysis(array $headers, array $stats): array
    {
        $suggestions = [];
        foreach ($headers as $col) {
            $lower = strtolower($col);
            $colStats = $stats[$col] ?? [];

            $purpose = 'metadata';
            $confidence = 0.3;

            if (preg_match('/fips|geo_?code|geographic_?code/', $lower)) {
                $purpose = 'geography_code';
                $confidence = 0.8;
            } elseif (preg_match('/^lat(itude)?$/', $lower)) {
                $purpose = 'latitude';
                $confidence = 0.95;
            } elseif (preg_match('/^lo?ng(itude)?$/', $lower)) {
                $purpose = 'longitude';
                $confidence = 0.95;
            } elseif (preg_match('/county|state|country|region|name/', $lower)) {
                $purpose = 'geography_name';
                $confidence = 0.7;
            } elseif (($colStats['is_numeric'] ?? false) && ($colStats['distinct_count'] ?? 0) > 5) {
                $purpose = 'value';
                $confidence = 0.5;
            }

            $suggestions[] = [
                'column' => $col,
                'purpose' => $purpose,
                'geo_type' => null,
                'confidence' => $confidence,
                'reasoning' => 'Rule-based fallback (Abby unavailable)',
            ];
        }

        return ['suggestions' => $suggestions, 'source' => 'fallback'];
    }
}
