<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class RService
{
    private string $baseUrl;

    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = (string) config('services.r_runtime.url');
        $this->timeout = (int) config('services.r_runtime.timeout', 7200);
    }

    /**
     * @return array<string, mixed>
     */
    public function health(): array
    {
        $response = Http::timeout(5)->get("{$this->baseUrl}/health");

        return $response->json();
    }

    /**
     * Run CohortMethod estimation via the R sidecar.
     *
     * @param  array<string, mixed>  $spec
     * @return array<string, mixed>
     */
    public function runEstimation(array $spec): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/analysis/estimation/run", $spec);

        return $response->json();
    }

    /**
     * Run PatientLevelPrediction via the R sidecar.
     *
     * @param  array<string, mixed>  $spec
     * @return array<string, mixed>
     */
    public function runPrediction(array $spec): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/analysis/prediction/run", $spec);

        return $response->json() ?? [
            'status' => 'error',
            'message' => 'R runtime returned empty response (HTTP ' . $response->status() . ')',
        ];
    }

    /**
     * Run Self-Controlled Case Series via the R sidecar.
     *
     * @param  array<string, mixed>  $spec
     * @return array<string, mixed>
     */
    public function runSccs(array $spec): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/analysis/sccs/run", $spec);

        return $response->json();
    }

    /**
     * Run Evidence Synthesis meta-analysis via the R sidecar.
     *
     * @param  array<string, mixed>  $spec
     * @return array<string, mixed>
     */
    public function runEvidenceSynthesis(array $spec): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/analysis/evidence-synthesis/run", $spec);

        return $response->json();
    }
}
