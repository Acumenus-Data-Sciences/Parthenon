<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * @group System
 */
class HealthController extends Controller
{
    public function index(SolrClientWrapper $solr): JsonResponse
    {
        $services = [
            'database' => $this->checkDatabase(),
            'redis' => $this->checkRedis(),
            'ai' => $this->checkService(config('services.ai.url').'/health'),
            'r_runtime' => $this->checkService(config('services.r_runtime.url').'/health'),
        ];

        if ($solr->isEnabled()) {
            $services['solr'] = $this->checkSolr($solr);
        }

        return response()->json([
            'status' => 'ok',
            'service' => 'parthenon-api',
            'version' => config('app.version', '0.1.0'),
            'timestamp' => now()->toIso8601String(),
            'services' => $services,
        ]);
    }

    private function checkDatabase(): string
    {
        try {
            DB::connection()->getPdo();

            return 'ok';
        } catch (\Throwable) {
            return 'error';
        }
    }

    private function checkRedis(): string
    {
        try {
            Cache::store('redis')->put('health_check', true, 10);

            return 'ok';
        } catch (\Throwable) {
            return 'error';
        }
    }

    private function checkService(string $url): string
    {
        try {
            $response = Http::timeout(5)->get($url);

            return $response->successful() ? 'ok' : 'error';
        } catch (\Throwable) {
            return 'unavailable';
        }
    }

    /**
     * @return array{status: string, cores: array<string, array{status: string, docs: int|null}>}
     */
    private function checkSolr(SolrClientWrapper $solr): array
    {
        $cores = [];
        foreach (config('solr.cores', []) as $name => $coreName) {
            $ping = $solr->ping($coreName);
            $cores[$name] = [
                'status' => $ping ? 'ok' : 'unavailable',
                'docs' => $ping ? $solr->documentCount($coreName) : null,
            ];
        }

        $anyOk = collect($cores)->contains(fn ($c) => $c['status'] === 'ok');

        return [
            'status' => $anyOk ? 'ok' : 'unavailable',
            'cores' => $cores,
        ];
    }
}
