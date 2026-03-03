<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;

class SystemHealthController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'services' => [
                $this->checkBackend(),
                $this->checkRedis(),
                $this->checkAiService(),
                $this->checkRRuntime(),
                $this->checkQueue(),
            ],
            'checked_at' => now()->toIso8601String(),
        ]);
    }

    private function checkBackend(): array
    {
        return [
            'name'    => 'Backend API',
            'key'     => 'backend',
            'status'  => 'healthy',
            'message' => 'Laravel is responding normally.',
        ];
    }

    private function checkRedis(): array
    {
        try {
            Redis::ping();

            return [
                'name'    => 'Redis',
                'key'     => 'redis',
                'status'  => 'healthy',
                'message' => 'Redis is reachable.',
            ];
        } catch (\Throwable $e) {
            return [
                'name'    => 'Redis',
                'key'     => 'redis',
                'status'  => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkAiService(): array
    {
        $url = rtrim(config('services.ai.url', env('AI_SERVICE_URL', 'http://ai:8002')), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/health");

            if ($response->successful()) {
                return [
                    'name'    => 'AI Service (Abby)',
                    'key'     => 'ai',
                    'status'  => 'healthy',
                    'message' => 'AI service is reachable.',
                ];
            }

            return [
                'name'    => 'AI Service (Abby)',
                'key'     => 'ai',
                'status'  => 'degraded',
                'message' => "AI service returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name'    => 'AI Service (Abby)',
                'key'     => 'ai',
                'status'  => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkRRuntime(): array
    {
        $url = rtrim(config('services.r.url', env('R_PLUMBER_URL', 'http://r:8787')), '/');

        try {
            $response = Http::timeout(3)->get("{$url}/healthz");

            if ($response->successful()) {
                return [
                    'name'    => 'R Analytics Runtime',
                    'key'     => 'r',
                    'status'  => 'healthy',
                    'message' => 'R Plumber is reachable.',
                ];
            }

            return [
                'name'    => 'R Analytics Runtime',
                'key'     => 'r',
                'status'  => 'degraded',
                'message' => "R Plumber returned HTTP {$response->status()}.",
            ];
        } catch (\Throwable $e) {
            return [
                'name'    => 'R Analytics Runtime',
                'key'     => 'r',
                'status'  => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkQueue(): array
    {
        try {
            $pending = DB::table('jobs')->count();
            $failed  = DB::table('failed_jobs')->count();

            $status = $failed > 0 ? 'degraded' : 'healthy';

            return [
                'name'    => 'Job Queue',
                'key'     => 'queue',
                'status'  => $status,
                'message' => "Pending: {$pending}, Failed: {$failed}",
                'details' => ['pending' => $pending, 'failed' => $failed],
            ];
        } catch (\Throwable $e) {
            return [
                'name'    => 'Job Queue',
                'key'     => 'queue',
                'status'  => 'down',
                'message' => $e->getMessage(),
            ];
        }
    }
}
