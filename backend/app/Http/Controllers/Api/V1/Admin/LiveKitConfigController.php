<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * @group Administration
 */
class LiveKitConfigController extends Controller
{
    public function show(): JsonResponse
    {
        $settings = SystemSetting::getGroup('livekit');

        $hasApiKey = ($settings['livekit_api_key'] ?? null) !== null && $settings['livekit_api_key'] !== '';
        $hasApiSecret = ($settings['livekit_api_secret'] ?? null) !== null && $settings['livekit_api_secret'] !== '';

        return response()->json([
            'data' => [
                'provider' => $settings['livekit_provider'] ?? 'env',
                'url' => $settings['livekit_url'] ?? '',
                'has_api_key' => $hasApiKey,
                'has_api_secret' => $hasApiSecret,
                'env_url' => (string) config('services.livekit.url', ''),
                'env_has_key' => config('services.livekit.api_key', '') !== '',
                'env_has_secret' => config('services.livekit.api_secret', '') !== '',
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => 'required|in:cloud,self-hosted,env',
            'url' => 'nullable|string|max:500',
            'api_key' => 'nullable|string|max:500',
            'api_secret' => 'nullable|string|max:500',
        ]);

        SystemSetting::setValue('livekit_provider', $validated['provider'], 'livekit');

        if ($validated['provider'] !== 'env') {
            SystemSetting::setValue('livekit_url', $validated['url'] ?? '', 'livekit');

            if (isset($validated['api_key']) && $validated['api_key'] !== '') {
                SystemSetting::setValue('livekit_api_key', $validated['api_key'], 'livekit', isSecret: true);
            }

            if (isset($validated['api_secret']) && $validated['api_secret'] !== '') {
                SystemSetting::setValue('livekit_api_secret', $validated['api_secret'], 'livekit', isSecret: true);
            }
        }

        return response()->json(['message' => 'LiveKit configuration updated.']);
    }

    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => 'required|string',
        ]);

        $url = $validated['url'];
        $httpUrl = (string) preg_replace('#^wss?://#', 'https://', $url);

        try {
            $response = Http::timeout(5)->get($httpUrl);

            return response()->json([
                'reachable' => true,
                'status_code' => $response->status(),
                'message' => 'LiveKit server is reachable.',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'reachable' => false,
                'message' => 'Cannot reach LiveKit: '.$e->getMessage(),
            ], 422);
        }
    }
}
