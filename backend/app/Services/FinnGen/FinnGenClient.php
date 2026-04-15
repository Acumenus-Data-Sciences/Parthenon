<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Services\FinnGen\Exceptions\FinnGenDarkstarMalformedResponseException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarRejectedException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarTimeoutException;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarUnreachableException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use JsonException;

/**
 * HTTP client for Darkstar's Plumber API (SP1 Runtime Foundation).
 *
 * Maps failures to typed exceptions so RunFinnGenAnalysisJob can pick a retry
 * policy (see spec §5.4):
 *   - ConnectionException / 5xx → FinnGenDarkstarUnreachableException (retriable)
 *   - Timeout → FinnGenDarkstarTimeoutException (retriable)
 *   - 4xx → FinnGenDarkstarRejectedException (NOT retriable; bad params)
 *   - Non-JSON body on 2xx → FinnGenDarkstarMalformedResponseException (NOT retriable; contract bug)
 *
 * Connection timeout is always 5s. Operation timeout varies per call type:
 *   - sync reads: 30s (user-interactive)
 *   - async dispatch: 10s (should return immediately with job_id)
 *   - job polling: 120s (long poll reserves allowed)
 */
class FinnGenClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly int $timeoutSyncMs,
        private readonly int $timeoutDispatchMs,
        private readonly int $timeoutPollMs,
    ) {}

    public static function forContainer(): self
    {
        return new self(
            baseUrl: rtrim((string) config('finngen.darkstar_url'), '/'),
            timeoutSyncMs: (int) config('finngen.darkstar_timeout_sync_ms'),
            timeoutDispatchMs: (int) config('finngen.darkstar_timeout_dispatch_ms'),
            timeoutPollMs: (int) config('finngen.darkstar_timeout_poll_ms'),
        );
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    public function getSync(string $path, array $query = []): array
    {
        return $this->request('GET', $path, query: $query, timeoutMs: $this->timeoutSyncMs);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function postAsyncDispatch(string $path, array $body): array
    {
        return $this->request('POST', $path, body: $body, timeoutMs: $this->timeoutDispatchMs);
    }

    /**
     * @return array<string, mixed>
     */
    public function pollJob(string $jobId): array
    {
        return $this->request('GET', "/jobs/status/{$jobId}", timeoutMs: $this->timeoutPollMs);
    }

    /**
     * @return array<string, mixed>
     */
    public function cancelJob(string $jobId): array
    {
        return $this->request('POST', "/jobs/cancel/{$jobId}", timeoutMs: $this->timeoutDispatchMs);
    }

    /**
     * @return array<string, mixed>
     */
    public function health(): array
    {
        return $this->request('GET', '/health', timeoutMs: $this->timeoutSyncMs);
    }

    /**
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     *
     * @throws FinnGenDarkstarUnreachableException
     * @throws FinnGenDarkstarTimeoutException
     * @throws FinnGenDarkstarRejectedException
     * @throws FinnGenDarkstarMalformedResponseException
     */
    private function request(
        string $method,
        string $path,
        array $query = [],
        array $body = [],
        int $timeoutMs = 30000,
    ): array {
        $url = $this->baseUrl.$path;

        $pending = Http::timeout((int) ceil($timeoutMs / 1000))
            ->connectTimeout(5)
            ->acceptJson();

        if ($body !== [] && $method !== 'GET') {
            $pending = $pending->asJson();
        }

        try {
            $response = match ($method) {
                'GET' => $pending->get($url, $query),
                'POST' => $pending->post($url, $body),
                'DELETE' => $pending->delete($url),
                default => throw new \InvalidArgumentException("Unsupported method: {$method}"),
            };
        } catch (ConnectionException $e) {
            // Laravel's ConnectionException covers connect-time and read-time timeouts.
            // Distinguish by message when useful; for now, route timeouts to a
            // dedicated class so retry policy can differ.
            $msg = strtolower($e->getMessage());
            if (str_contains($msg, 'timeout') || str_contains($msg, 'timed out')) {
                throw new FinnGenDarkstarTimeoutException("Darkstar timeout: {$e->getMessage()}", previous: $e);
            }
            throw new FinnGenDarkstarUnreachableException("Darkstar connection failed: {$e->getMessage()}", previous: $e);
        } catch (RequestException $e) {
            throw new FinnGenDarkstarUnreachableException("Darkstar HTTP error: {$e->getMessage()}", previous: $e);
        }

        if ($response->status() >= 500) {
            throw new FinnGenDarkstarUnreachableException("Darkstar returned {$response->status()}");
        }

        if ($response->status() >= 400) {
            $payload = $response->json() ?? [];
            $err = is_array($payload) ? ($payload['error'] ?? null) : null;
            throw new FinnGenDarkstarRejectedException(
                message: "Darkstar rejected request: {$response->status()}",
                darkstarError: is_array($err) ? $err : null,
                status: $response->status(),
            );
        }

        try {
            $decoded = $response->json();
            if ($decoded === null) {
                throw new JsonException('empty response body');
            }
            if (! is_array($decoded)) {
                throw new JsonException('response body is not a JSON object/array');
            }

            return $decoded;
        } catch (JsonException $e) {
            throw new FinnGenDarkstarMalformedResponseException(
                message: "Darkstar returned malformed JSON: {$e->getMessage()}",
                rawBody: substr($response->body(), 0, 4096),
                previous: $e,
            );
        }
    }
}
