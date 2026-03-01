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
        $this->timeout = (int) config('services.r_runtime.timeout', 300);
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
     * @param  array<string, mixed>  $spec
     * @return array<string, mixed>
     */
    public function runEstimation(array $spec): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/stubs/estimation", $spec);

        return $response->json();
    }

    /**
     * @param  array<string, mixed>  $spec
     * @return array<string, mixed>
     */
    public function runPrediction(array $spec): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/stubs/prediction", $spec);

        return $response->json();
    }
}
