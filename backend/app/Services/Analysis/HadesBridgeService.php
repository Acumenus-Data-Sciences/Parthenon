<?php

namespace App\Services\Analysis;

use App\Models\App\Source;
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
        $this->baseUrl = rtrim(config('services.darkstar.url', 'http://darkstar:8787'), '/');
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
     *
     * Returns an array with dbms, server, port, user, password, and schema names
     * that R's create_hades_connection() can parse directly.
     *
     * Prefers Source model's db_* fields (dynamic connections) over Laravel config.
     */
    public static function buildSourceSpec(Source $source): array
    {
        $source->loadMissing('daimons');
        $daimons = $source->daimons;
        $cdmDaimon = $daimons->firstWhere('daimon_type', 'cdm');
        $vocabDaimon = $daimons->firstWhere('daimon_type', 'vocabulary');
        $resultsDaimon = $daimons->firstWhere('daimon_type', 'results');

        // Prefer Source model's explicit db_* fields (for dynamic/external connections)
        if ($source->db_host) {
            $host = $source->db_host;
            $port = (string) ($source->db_port ?: '5432');
            $database = $source->db_database ?: '';
            $user = $source->username ?: '';
            $password = $source->password ?: '';
        } else {
            // Fall back to Laravel connection config
            $connName = $source->source_connection ?? 'pgsql';
            $dbConfig = config("database.connections.{$connName}", []);
            $host = $dbConfig['host'] ?? 'localhost';
            $port = (string) ($dbConfig['port'] ?? '5432');
            $database = $dbConfig['database'] ?? '';
            $user = $dbConfig['username'] ?? '';
            $password = $dbConfig['password'] ?? '';
        }

        $cdmSchema = $cdmDaimon?->table_qualifier ?? 'public';
        $vocabSchema = $vocabDaimon?->table_qualifier ?? $cdmSchema;
        $resultsSchema = $resultsDaimon?->table_qualifier ?? 'public';

        return [
            'dbms' => $source->source_dialect ?? 'postgresql',
            'server' => "{$host}/{$database}",
            'port' => $port,
            'user' => $user,
            'password' => $password,
            'cdm_schema' => $cdmSchema,
            'vocab_schema' => $vocabSchema,
            'results_schema' => $resultsSchema,
            'cohort_table' => "{$resultsSchema}.cohort",
        ];
    }

    /**
     * @deprecated Use buildSourceSpec() instead
     */
    private function sourceSpec(Source $source): array
    {
        return self::buildSourceSpec($source);
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
                'message' => 'R analytics service unavailable: '.$e->getMessage(),
            ];
        }
    }
}
