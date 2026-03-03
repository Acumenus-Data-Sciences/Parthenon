<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

#[Group('System', weight: 230)]
class HealthController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'service' => 'parthenon-api',
            'version' => config('app.version', '0.1.0'),
            'timestamp' => now()->toIso8601String(),
            'services' => [
                'database' => $this->checkDatabase(),
                'redis' => $this->checkRedis(),
                'ai' => $this->checkService(config('services.ai.url').'/health'),
                'r_runtime' => $this->checkService(config('services.r_runtime.url').'/health'),
            ],
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
}
