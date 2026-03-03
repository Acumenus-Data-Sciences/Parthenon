<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\AiProviderSetting;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

#[Group('Administration', weight: 220)]
class AiProviderController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(AiProviderSetting::orderBy('provider_type')->get());
    }

    public function show(string $type): JsonResponse
    {
        $provider = AiProviderSetting::where('provider_type', $type)->firstOrFail();

        return response()->json($provider);
    }

    public function update(Request $request, string $type): JsonResponse
    {
        $validated = $request->validate([
            'display_name' => 'sometimes|string|max:100',
            'model' => 'sometimes|string|max:200',
            'settings' => 'sometimes|array',
        ]);

        $provider = AiProviderSetting::where('provider_type', $type)->firstOrFail();

        if (isset($validated['settings'])) {
            $validated['settings'] = array_merge(
                $provider->settings ?? [],
                $validated['settings'],
            );
        }

        $provider->fill(array_merge($validated, ['updated_by' => $request->user()->id]));
        $provider->save();

        return response()->json($provider->fresh());
    }

    public function activate(Request $request, string $type): JsonResponse
    {
        AiProviderSetting::where('provider_type', $type)->firstOrFail();

        DB::transaction(function () use ($type, $request) {
            AiProviderSetting::query()->update(['is_active' => false]);
            AiProviderSetting::where('provider_type', $type)
                ->update(['is_active' => true, 'updated_by' => $request->user()->id]);
        });

        return response()->json(AiProviderSetting::where('provider_type', $type)->first());
    }

    public function enable(Request $request, string $type): JsonResponse
    {
        $provider = AiProviderSetting::where('provider_type', $type)->firstOrFail();
        $provider->update(['is_enabled' => true, 'updated_by' => $request->user()->id]);

        return response()->json($provider->fresh());
    }

    public function disable(Request $request, string $type): JsonResponse
    {
        $provider = AiProviderSetting::where('provider_type', $type)->firstOrFail();
        $provider->update(['is_enabled' => false, 'updated_by' => $request->user()->id]);

        return response()->json($provider->fresh());
    }

    public function test(Request $request, string $type): JsonResponse
    {
        $provider = AiProviderSetting::where('provider_type', $type)->firstOrFail();
        $settings = $provider->settings ?? [];

        $result = match ($type) {
            'ollama' => $this->testOllama($settings),
            'anthropic' => $this->testAnthropic($settings),
            'openai' => $this->testOpenAi($settings),
            'gemini' => $this->testGemini($settings),
            'deepseek' => $this->testDeepSeek($settings),
            'qwen' => $this->testQwen($settings),
            'moonshot' => $this->testMoonshot($settings),
            'mistral' => $this->testMistral($settings),
            default => ['success' => false, 'message' => "Connection test not available for {$type}."],
        };

        return response()->json($result);
    }

    // ── Private test helpers ──────────────────────────────────────────────────

    /** @param array<string, mixed> $cfg */
    private function testOllama(array $cfg): array
    {
        $baseUrl = rtrim($cfg['base_url'] ?? 'http://localhost:11434', '/');

        try {
            $response = Http::timeout(5)->get("{$baseUrl}/api/tags");

            if ($response->successful()) {
                $models = collect($response->json('models', []))->pluck('name')->all();

                return ['success' => true, 'message' => 'Ollama is reachable.', 'details' => ['models' => $models]];
            }

            return ['success' => false, 'message' => "Ollama returned HTTP {$response->status()}."];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /** @param array<string, mixed> $cfg */
    private function testAnthropic(array $cfg): array
    {
        $apiKey = $cfg['api_key'] ?? '';

        if (empty($apiKey)) {
            return ['success' => false, 'message' => 'API key is not configured.'];
        }

        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'x-api-key' => $apiKey,
                    'anthropic-version' => '2023-06-01',
                    'content-type' => 'application/json',
                ])
                ->post('https://api.anthropic.com/v1/messages', [
                    'model' => 'claude-haiku-4-5-20251001',
                    'max_tokens' => 1,
                    'messages' => [['role' => 'user', 'content' => 'Hi']],
                ]);

            if ($response->status() === 200 || $response->status() === 400) {
                // 400 can mean bad request but key is valid
                return ['success' => true, 'message' => 'Anthropic API key is valid.'];
            }

            if ($response->status() === 401) {
                return ['success' => false, 'message' => 'Invalid API key.'];
            }

            return ['success' => false, 'message' => "Anthropic returned HTTP {$response->status()}."];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /** @param array<string, mixed> $cfg */
    private function testOpenAi(array $cfg): array
    {
        $apiKey = $cfg['api_key'] ?? '';

        if (empty($apiKey)) {
            return ['success' => false, 'message' => 'API key is not configured.'];
        }

        try {
            $response = Http::timeout(10)
                ->withToken($apiKey)
                ->get('https://api.openai.com/v1/models');

            if ($response->successful()) {
                return ['success' => true, 'message' => 'OpenAI API key is valid.'];
            }

            if ($response->status() === 401) {
                return ['success' => false, 'message' => 'Invalid API key.'];
            }

            return ['success' => false, 'message' => "OpenAI returned HTTP {$response->status()}."];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /** @param array<string, mixed> $cfg */
    private function testGemini(array $cfg): array
    {
        $apiKey = $cfg['api_key'] ?? '';

        if (empty($apiKey)) {
            return ['success' => false, 'message' => 'API key is not configured.'];
        }

        try {
            $response = Http::timeout(10)
                ->get("https://generativelanguage.googleapis.com/v1/models?key={$apiKey}");

            if ($response->successful()) {
                return ['success' => true, 'message' => 'Google Gemini API key is valid.'];
            }

            if ($response->status() === 400 || $response->status() === 403) {
                return ['success' => false, 'message' => 'Invalid API key.'];
            }

            return ['success' => false, 'message' => "Gemini returned HTTP {$response->status()}."];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /** @param array<string, mixed> $cfg */
    private function testDeepSeek(array $cfg): array
    {
        $apiKey = $cfg['api_key'] ?? '';

        if (empty($apiKey)) {
            return ['success' => false, 'message' => 'API key is not configured.'];
        }

        try {
            $response = Http::timeout(10)
                ->withToken($apiKey)
                ->get('https://api.deepseek.com/models');

            if ($response->successful()) {
                return ['success' => true, 'message' => 'DeepSeek API key is valid.'];
            }

            if ($response->status() === 401) {
                return ['success' => false, 'message' => 'Invalid API key.'];
            }

            return ['success' => false, 'message' => "DeepSeek returned HTTP {$response->status()}."];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /** @param array<string, mixed> $cfg */
    private function testQwen(array $cfg): array
    {
        $apiKey = $cfg['api_key'] ?? '';

        if (empty($apiKey)) {
            return ['success' => false, 'message' => 'API key is not configured.'];
        }

        try {
            $response = Http::timeout(10)
                ->withToken($apiKey)
                ->get('https://dashscope.aliyuncs.com/compatible-mode/v1/models');

            if ($response->successful()) {
                return ['success' => true, 'message' => 'Alibaba Qwen (DashScope) API key is valid.'];
            }

            if ($response->status() === 401) {
                return ['success' => false, 'message' => 'Invalid API key.'];
            }

            return ['success' => false, 'message' => "DashScope returned HTTP {$response->status()}."];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /** @param array<string, mixed> $cfg */
    private function testMoonshot(array $cfg): array
    {
        $apiKey = $cfg['api_key'] ?? '';

        if (empty($apiKey)) {
            return ['success' => false, 'message' => 'API key is not configured.'];
        }

        try {
            $response = Http::timeout(10)
                ->withToken($apiKey)
                ->get('https://api.moonshot.cn/v1/models');

            if ($response->successful()) {
                return ['success' => true, 'message' => 'Moonshot API key is valid.'];
            }

            if ($response->status() === 401) {
                return ['success' => false, 'message' => 'Invalid API key.'];
            }

            return ['success' => false, 'message' => "Moonshot returned HTTP {$response->status()}."];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /** @param array<string, mixed> $cfg */
    private function testMistral(array $cfg): array
    {
        $apiKey = $cfg['api_key'] ?? '';

        if (empty($apiKey)) {
            return ['success' => false, 'message' => 'API key is not configured.'];
        }

        try {
            $response = Http::timeout(10)
                ->withToken($apiKey)
                ->get('https://api.mistral.ai/v1/models');

            if ($response->successful()) {
                return ['success' => true, 'message' => 'Mistral API key is valid.'];
            }

            if ($response->status() === 401) {
                return ['success' => false, 'message' => 'Invalid API key.'];
            }

            return ['success' => false, 'message' => "Mistral returned HTTP {$response->status()}."];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
