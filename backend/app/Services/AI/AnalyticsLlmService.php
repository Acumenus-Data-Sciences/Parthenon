<?php

namespace App\Services\AI;

use App\Exceptions\AiProviderNotConfiguredException;
use App\Exceptions\AiProviderRequestException;
use App\Models\App\AiProviderSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AnalyticsLlmService
{
    /**
     * Send a chat completion request to the active AI provider.
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  array{system?: string, max_tokens?: int, temperature?: float}  $options
     *
     * @throws AiProviderNotConfiguredException
     * @throws AiProviderRequestException
     */
    public function chat(array $messages, array $options = []): string
    {
        $provider = AiProviderSetting::where('is_active', true)->first();

        if (! $provider || ! $provider->is_enabled) {
            throw new AiProviderNotConfiguredException;
        }

        /** @var array<string, string> $settings */
        $settings = $provider->settings ?? [];
        $apiKey = $settings['api_key'] ?? '';
        $baseUrl = $settings['base_url'] ?? '';
        $model = $provider->model;

        if ($provider->provider_type !== 'ollama' && empty($apiKey)) {
            throw new AiProviderNotConfiguredException(
                "API key not configured for {$provider->display_name}. Add it in System Health > AI Providers."
            );
        }

        return match ($provider->provider_type) {
            'anthropic' => $this->callAnthropic($apiKey, $model, $messages, $options),
            'openai', 'deepseek', 'moonshot', 'mistral' => $this->callOpenAiCompatible(
                $provider->provider_type, $apiKey, $model, $messages, $options, $baseUrl,
            ),
            'gemini' => $this->callGemini($apiKey, $model, $messages, $options),
            'qwen' => $this->callOpenAiCompatible(
                'qwen', $apiKey, $model, $messages, $options, 'https://dashscope.aliyuncs.com/compatible-mode',
            ),
            'ollama' => $this->callOllama($baseUrl ?: 'http://host.docker.internal:11434', $model, $messages, $options),
            default => throw new AiProviderRequestException("Unsupported provider: {$provider->provider_type}", $provider->provider_type),
        };
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  array{system?: string, max_tokens?: int, temperature?: float}  $options
     */
    private function callAnthropic(string $apiKey, string $model, array $messages, array $options): string
    {
        $system = $options['system'] ?? null;

        $body = [
            'model' => $model,
            'max_tokens' => $options['max_tokens'] ?? 4096,
            'messages' => $messages,
        ];

        if ($system) {
            $body['system'] = $system;
        }

        if (isset($options['temperature'])) {
            $body['temperature'] = $options['temperature'];
        }

        $response = Http::timeout(120)
            ->withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
                'content-type' => 'application/json',
            ])
            ->post('https://api.anthropic.com/v1/messages', $body);

        if (! $response->successful()) {
            Log::warning('Anthropic API error', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new AiProviderRequestException(
                "Anthropic API returned HTTP {$response->status()}: ".($response->json('error.message') ?? $response->body()),
                'anthropic',
                $response->status(),
            );
        }

        /** @var array<int, array{type: string, text?: string}> $content */
        $content = $response->json('content', []);

        return collect($content)
            ->where('type', 'text')
            ->pluck('text')
            ->implode('');
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  array{system?: string, max_tokens?: int, temperature?: float}  $options
     */
    private function callOpenAiCompatible(string $providerType, string $apiKey, string $model, array $messages, array $options, string $baseUrl = ''): string
    {
        $url = match ($providerType) {
            'openai' => 'https://api.openai.com/v1/chat/completions',
            'deepseek' => 'https://api.deepseek.com/v1/chat/completions',
            'moonshot' => 'https://api.moonshot.cn/v1/chat/completions',
            'mistral' => 'https://api.mistral.ai/v1/chat/completions',
            default => rtrim($baseUrl, '/').'/v1/chat/completions',
        };

        $allMessages = $messages;
        if (! empty($options['system'])) {
            array_unshift($allMessages, ['role' => 'system', 'content' => $options['system']]);
        }

        $body = [
            'model' => $model,
            'messages' => $allMessages,
            'max_tokens' => $options['max_tokens'] ?? 4096,
        ];

        if (isset($options['temperature'])) {
            $body['temperature'] = $options['temperature'];
        }

        $response = Http::timeout(120)
            ->withToken($apiKey)
            ->post($url, $body);

        if (! $response->successful()) {
            throw new AiProviderRequestException(
                "{$providerType} API returned HTTP {$response->status()}: ".($response->json('error.message') ?? $response->body()),
                $providerType,
                $response->status(),
            );
        }

        return $response->json('choices.0.message.content', '');
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  array{system?: string, max_tokens?: int, temperature?: float}  $options
     */
    private function callGemini(string $apiKey, string $model, array $messages, array $options): string
    {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

        $contents = [];
        foreach ($messages as $msg) {
            $contents[] = [
                'role' => $msg['role'] === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => $msg['content']]],
            ];
        }

        $body = ['contents' => $contents];

        if (! empty($options['system'])) {
            $body['systemInstruction'] = [
                'parts' => [['text' => $options['system']]],
            ];
        }

        if (isset($options['temperature'])) {
            $body['generationConfig']['temperature'] = $options['temperature'];
        }

        if (isset($options['max_tokens'])) {
            $body['generationConfig']['maxOutputTokens'] = $options['max_tokens'];
        }

        $response = Http::timeout(120)
            ->post($url, $body);

        if (! $response->successful()) {
            throw new AiProviderRequestException(
                "Gemini API returned HTTP {$response->status()}: ".$response->body(),
                'gemini',
                $response->status(),
            );
        }

        return $response->json('candidates.0.content.parts.0.text', '');
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  array{system?: string, max_tokens?: int, temperature?: float}  $options
     */
    private function callOllama(string $baseUrl, string $model, array $messages, array $options): string
    {
        $allMessages = $messages;
        if (! empty($options['system'])) {
            array_unshift($allMessages, ['role' => 'system', 'content' => $options['system']]);
        }

        $response = Http::timeout(120)
            ->post(rtrim($baseUrl, '/').'/api/chat', [
                'model' => $model,
                'messages' => $allMessages,
                'stream' => false,
            ]);

        if (! $response->successful()) {
            throw new AiProviderRequestException(
                "Ollama returned HTTP {$response->status()}: ".$response->body(),
                'ollama',
                $response->status(),
            );
        }

        return $response->json('message.content', '');
    }
}
