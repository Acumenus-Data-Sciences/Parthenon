<?php

namespace App\Services\Analysis;

use App\Models\App\Source;
use App\Models\App\StudySite;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Bridge to R Plumber HADES endpoints.
 *
 * Translates Parthenon study site + analysis specifications
 * into R Plumber API calls and returns aggregate results.
 */
class HadesBridgeService
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.r_plumber.url', 'http://r-plumber:8787'), '/');
    }

    /**
     * Run feasibility check — count subjects in cohorts at a site.
     *
     * @param  int[]  $cohortIds
     * @return array{status: string, counts: array<string, int|string>}
     */
    public function feasibility(Source $source, array $cohortIds, int $minCellCount = 5): array
    {
        return $this->post('/study/feasibility', [
            'source' => $this->sourceSpec($source),
            'cohort_ids' => $cohortIds,
            'min_cell_count' => $minCellCount,
        ]);
    }

    /**
     * Run characterization — FeatureExtraction for a target cohort.
     */
    public function characterize(Source $source, int $targetCohortId): array
    {
        return $this->post('/study/characterize', [
            'source' => $this->sourceSpec($source),
            'cohorts' => ['target_cohort_id' => $targetCohortId],
        ], timeout: 300);
    }

    /**
     * Run incidence rate analysis.
     */
    public function incidenceRate(Source $source, int $targetCohortId, int $outcomeCohortId): array
    {
        return $this->post('/study/incidence', [
            'source' => $this->sourceSpec($source),
            'cohorts' => [
                'target_cohort_id' => $targetCohortId,
                'outcome_cohort_id' => $outcomeCohortId,
            ],
        ]);
    }

    /**
     * Run evidence synthesis / meta-analysis across site results.
     *
     * @param  array<array{log_rr: float, se_log_rr: float}>  $estimates
     */
    public function synthesis(array $estimates, string $method = 'random_effects'): array
    {
        return $this->post('/study/synthesis', [
            'estimates' => $estimates,
            'method' => $method,
        ]);
    }

    /**
     * Health check for the study bridge.
     */
    public function healthCheck(): array
    {
        try {
            $response = Http::timeout(5)->get("{$this->baseUrl}/study/health");

            return $response->json() ?? ['status' => 'error'];
        } catch (\Throwable $e) {
            return ['status' => 'error', 'message' => $e->getMessage()];
        }
    }

    /**
     * Build source connection spec for R Plumber from a Parthenon Source model.
     */
    private function sourceSpec(Source $source): array
    {
        $daimons = $source->daimons;
        $cdmDaimon = $daimons->firstWhere('daimon_type', 'cdm');
        $vocabDaimon = $daimons->firstWhere('daimon_type', 'vocabulary');
        $resultsDaimon = $daimons->firstWhere('daimon_type', 'results');

        // Get the database connection config for this source
        $connName = $source->source_connection ?? 'pgsql';
        $dbConfig = config("database.connections.{$connName}", []);

        return [
            'dbms' => 'postgresql',
            'server' => ($dbConfig['host'] ?? 'localhost') . '/' . ($dbConfig['database'] ?? ''),
            'port' => (string) ($dbConfig['port'] ?? '5432'),
            'user' => $dbConfig['username'] ?? '',
            'password' => $dbConfig['password'] ?? '',
            'cdm_schema' => $cdmDaimon?->table_qualifier ?? 'public',
            'vocab_schema' => $vocabDaimon?->table_qualifier ?? $cdmDaimon?->table_qualifier ?? 'public',
            'results_schema' => $resultsDaimon?->table_qualifier ?? 'public',
        ];
    }

    /**
     * POST to the R Plumber API.
     */
    private function post(string $endpoint, array $data, int $timeout = 120): array
    {
        try {
            $response = Http::timeout($timeout)
                ->post("{$this->baseUrl}{$endpoint}", $data);

            if ($response->failed()) {
                Log::error('HadesBridge request failed', [
                    'endpoint' => $endpoint,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'status' => 'error',
                    'message' => "R service returned HTTP {$response->status()}",
                ];
            }

            return $response->json() ?? ['status' => 'error', 'message' => 'Empty response'];
        } catch (\Throwable $e) {
            Log::error('HadesBridge connection failed', [
                'endpoint' => $endpoint,
                'error' => $e->getMessage(),
            ]);

            return [
                'status' => 'error',
                'message' => 'R analytics service unavailable: ' . $e->getMessage(),
            ];
        }
    }
}
