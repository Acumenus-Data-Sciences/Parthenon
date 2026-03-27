<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * HTTP client wrapping the Arachne Central REST API for federated study execution.
 *
 * Arachne Central is OHDSI's distributed execution platform.  Parthenon uses this
 * service to distribute Strategus JSON specs to remote Data Nodes and collect results.
 */
class ArachneService
{
    private readonly string $baseUrl;

    private readonly string $token;

    private readonly int $timeout;

    public function __construct()
    {
        /** @var array{url: string, token: string, timeout: int} $config */
        $config = config('services.arachne');

        $this->baseUrl = rtrim((string) $config['url'], '/');
        $this->token = (string) $config['token'];
        $this->timeout = (int) $config['timeout'];
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * List available Arachne Data Nodes (data sources).
     *
     * @return array<int, array<string, mixed>>
     */
    public function listNodes(): array
    {
        Log::info('ArachneService: listing data nodes');

        return $this->get('/api/v1/data-sources');
    }

    /**
     * Create an analysis entry in Arachne Central and attach the Strategus spec
     * as the study package.
     *
     * @param  array<string, mixed>  $strategusSpec
     * @return array<string, mixed>
     */
    public function createAnalysis(string $title, string $description, array $strategusSpec): array
    {
        Log::info('ArachneService: creating analysis', ['title' => $title]);

        return $this->post('/api/v1/analyses', [
            'title' => $title,
            'description' => $description,
            'study_package' => $strategusSpec,
        ]);
    }

    /**
     * Distribute an analysis to the selected data nodes.
     *
     * @param  array<int>  $nodeIds
     * @param  array<string, mixed>  $strategusSpec
     * @return array<string, mixed> Includes distribution tracking IDs per node.
     */
    public function distribute(int $analysisId, array $nodeIds, array $strategusSpec): array
    {
        Log::info('ArachneService: distributing analysis', [
            'analysis_id' => $analysisId,
            'node_ids' => $nodeIds,
        ]);

        return $this->post("/api/v1/analyses/{$analysisId}/distribute", [
            'data_source_ids' => $nodeIds,
            'study_package' => $strategusSpec,
        ]);
    }

    /**
     * Get per-node execution status for an analysis.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getStatus(int $analysisId): array
    {
        Log::info('ArachneService: fetching status', ['analysis_id' => $analysisId]);

        return $this->get("/api/v1/analyses/{$analysisId}/submissions");
    }

    /**
     * Retrieve completed results for a specific submission.
     *
     * @return array<string, mixed>
     */
    public function getResults(int $analysisId, int $submissionId): array
    {
        Log::info('ArachneService: fetching results', [
            'analysis_id' => $analysisId,
            'submission_id' => $submissionId,
        ]);

        return $this->get("/api/v1/analyses/{$analysisId}/submissions/{$submissionId}/results");
    }

    // -----------------------------------------------------------------------
    // HTTP helpers
    // -----------------------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    private function get(string $path): array
    {
        try {
            $response = Http::withToken($this->token)
                ->timeout($this->timeout)
                ->get($this->baseUrl.$path);

            $response->throw();

            return $response->json() ?? [];
        } catch (ConnectionException $e) {
            Log::error('ArachneService: connection failed', [
                'url' => $this->baseUrl.$path,
                'error' => $e->getMessage(),
            ]);

            throw new RuntimeException(
                'Unable to connect to Arachne Central at '.$this->baseUrl.'. Verify ARACHNE_URL is correct and the service is running.',
                502,
                $e,
            );
        } catch (RequestException $e) {
            Log::error('ArachneService: request failed', [
                'url' => $this->baseUrl.$path,
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
            ]);

            throw new RuntimeException(
                'Arachne Central returned an error: '.($e->response?->body() ?? $e->getMessage()),
                $e->response?->status() ?? 500,
                $e,
            );
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function post(string $path, array $data): array
    {
        try {
            $response = Http::withToken($this->token)
                ->timeout($this->timeout)
                ->post($this->baseUrl.$path, $data);

            $response->throw();

            return $response->json() ?? [];
        } catch (ConnectionException $e) {
            Log::error('ArachneService: connection failed', [
                'url' => $this->baseUrl.$path,
                'error' => $e->getMessage(),
            ]);

            throw new RuntimeException(
                'Unable to connect to Arachne Central at '.$this->baseUrl.'. Verify ARACHNE_URL is correct and the service is running.',
                502,
                $e,
            );
        } catch (RequestException $e) {
            Log::error('ArachneService: request failed', [
                'url' => $this->baseUrl.$path,
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
            ]);

            throw new RuntimeException(
                'Arachne Central returned an error: '.($e->response?->body() ?? $e->getMessage()),
                $e->response?->status() ?? 500,
                $e,
            );
        }
    }
}
