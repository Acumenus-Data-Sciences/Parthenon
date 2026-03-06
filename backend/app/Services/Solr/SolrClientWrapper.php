<?php

namespace App\Services\Solr;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SolrClientWrapper
{
    private string $baseUrl;

    private int $timeout;

    private int $failureThreshold;

    private int $recoveryTimeout;

    public function __construct()
    {
        $host = config('solr.endpoint.default.host', 'solr');
        $port = config('solr.endpoint.default.port', 8983);
        $this->baseUrl = "http://{$host}:{$port}/solr";
        $this->timeout = (int) config('solr.endpoint.default.timeout', 5);
        $this->failureThreshold = (int) config('solr.circuit_breaker.failure_threshold', 5);
        $this->recoveryTimeout = (int) config('solr.circuit_breaker.recovery_timeout', 30);
    }

    public function isEnabled(): bool
    {
        return (bool) config('solr.enabled', false);
    }

    public function isAvailable(): bool
    {
        if (! $this->isEnabled()) {
            return false;
        }

        return ! $this->isCircuitOpen();
    }

    /**
     * Execute a Solr select query against a core.
     *
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>|null
     */
    public function select(string $core, array $params): ?array
    {
        return $this->query($core, '/select', $params);
    }

    /**
     * Execute a Solr suggest query.
     *
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>|null
     */
    public function suggest(string $core, array $params): ?array
    {
        return $this->query($core, '/suggest', $params);
    }

    /**
     * Add/update documents in a Solr core.
     *
     * @param  array<int, array<string, mixed>>  $documents
     */
    public function addDocuments(string $core, array $documents, bool $commit = false): bool
    {
        if (! $this->isEnabled()) {
            return false;
        }

        $url = "{$this->baseUrl}/{$core}/update/json/docs";
        if ($commit) {
            $url .= '?commit=true';
        }

        try {
            $response = Http::timeout($this->timeout * 4)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($url, $documents);

            if ($response->successful()) {
                $this->recordSuccess();

                return true;
            }

            Log::warning('Solr add documents failed', [
                'core' => $core,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        } catch (\Throwable $e) {
            $this->recordFailure();
            Log::error('Solr add documents error', ['core' => $core, 'error' => $e->getMessage()]);

            return false;
        }
    }

    /**
     * Commit pending changes to a core.
     */
    public function commit(string $core): bool
    {
        if (! $this->isEnabled()) {
            return false;
        }

        try {
            $response = Http::timeout($this->timeout * 2)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("{$this->baseUrl}/{$core}/update", ['commit' => new \stdClass]);

            return $response->successful();
        } catch (\Throwable $e) {
            Log::error('Solr commit error', ['core' => $core, 'error' => $e->getMessage()]);

            return false;
        }
    }

    /**
     * Delete all documents from a core.
     */
    public function deleteAll(string $core): bool
    {
        if (! $this->isEnabled()) {
            return false;
        }

        try {
            $response = Http::timeout($this->timeout * 4)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("{$this->baseUrl}/{$core}/update", [
                    'delete' => ['query' => '*:*'],
                    'commit' => new \stdClass,
                ]);

            return $response->successful();
        } catch (\Throwable $e) {
            Log::error('Solr delete all error', ['core' => $core, 'error' => $e->getMessage()]);

            return false;
        }
    }

    /**
     * Get document count for a core.
     */
    public function documentCount(string $core): ?int
    {
        $result = $this->select($core, ['q' => '*:*', 'rows' => 0]);

        return $result['response']['numFound'] ?? null;
    }

    /**
     * Ping a Solr core to check availability.
     */
    public function ping(string $core): bool
    {
        try {
            $response = Http::timeout(3)
                ->get("{$this->baseUrl}/{$core}/admin/ping");

            return $response->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>|null
     */
    private function query(string $core, string $handler, array $params): ?array
    {
        if (! $this->isEnabled()) {
            return null;
        }

        if ($this->isCircuitOpen()) {
            Log::debug('Solr circuit breaker open, skipping query');

            return null;
        }

        try {
            $params['wt'] = 'json';
            // Build query string manually — Solr expects repeated keys (e.g. facet.field=X&facet.field=Y)
            // Laravel's Http::get() serializes arrays with bracket notation which Solr doesn't understand.
            $queryParts = [];
            foreach ($params as $key => $value) {
                if (is_array($value)) {
                    foreach ($value as $v) {
                        $queryParts[] = urlencode($key).'='.urlencode((string) $v);
                    }
                } else {
                    $queryParts[] = urlencode($key).'='.urlencode((string) $value);
                }
            }
            $url = "{$this->baseUrl}/{$core}{$handler}?".implode('&', $queryParts);

            $response = Http::timeout($this->timeout)->get($url);

            if ($response->successful()) {
                $this->recordSuccess();

                return $response->json();
            }

            $this->recordFailure();
            Log::warning('Solr query failed', [
                'core' => $core,
                'handler' => $handler,
                'status' => $response->status(),
            ]);

            return null;
        } catch (\Throwable $e) {
            $this->recordFailure();
            Log::error('Solr query error', [
                'core' => $core,
                'handler' => $handler,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function isCircuitOpen(): bool
    {
        try {
            $failures = (int) Cache::get('solr:circuit_failures', 0);
            if ($failures < $this->failureThreshold) {
                return false;
            }

            $openedAt = Cache::get('solr:circuit_opened_at');
            if ($openedAt && (time() - $openedAt) > $this->recoveryTimeout) {
                Cache::forget('solr:circuit_failures');
                Cache::forget('solr:circuit_opened_at');

                return false;
            }

            return true;
        } catch (\Throwable) {
            // If Redis is down, assume circuit is closed (let Solr queries attempt)
            return false;
        }
    }

    private function recordSuccess(): void
    {
        try {
            $failures = (int) Cache::get('solr:circuit_failures', 0);
            if ($failures > 0) {
                Cache::decrement('solr:circuit_failures');
            }
        } catch (\Throwable) {
            // Redis unavailable — skip circuit state tracking
        }
    }

    private function recordFailure(): void
    {
        try {
            $failures = Cache::increment('solr:circuit_failures');
            if ($failures >= $this->failureThreshold) {
                Cache::put('solr:circuit_opened_at', time(), $this->recoveryTimeout + 60);
            }
        } catch (\Throwable) {
            // Redis unavailable — skip circuit state tracking
        }
    }
}
