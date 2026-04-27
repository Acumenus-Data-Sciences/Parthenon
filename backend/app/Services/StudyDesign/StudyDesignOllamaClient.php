<?php

namespace App\Services\StudyDesign;

use App\Models\App\AiProviderSetting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class StudyDesignOllamaClient
{
    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  array{format?: string|array<string, mixed>|null, temperature?: float, num_ctx?: int, timeout?: int, model?: string}  $options
     * @return array<string, mixed>
     */
    public function chat(array $messages, array $options = []): array
    {
        $settings = $this->settings($options);
        $body = [
            'model' => $settings['model'],
            'messages' => $messages,
            'stream' => false,
            'options' => [
                'temperature' => $options['temperature'] ?? 0.2,
                'num_ctx' => $options['num_ctx'] ?? 8192,
            ],
        ];

        if (array_key_exists('format', $options) && $options['format'] !== null) {
            $body['format'] = $options['format'];
        }

        try {
            $response = Http::timeout((int) ($options['timeout'] ?? $settings['timeout']))
                ->post($settings['base_url'].'/api/chat', $body);
        } catch (ConnectionException $exception) {
            throw new RuntimeException('Local Abby Ollama harness request failed: '.$exception->getMessage(), previous: $exception);
        }

        if ($response->failed()) {
            throw new RuntimeException('Local Abby Ollama harness returned HTTP '.$response->status().': '.$response->body());
        }

        $content = trim((string) $response->json('message.content', ''));
        if ($content === '') {
            throw new RuntimeException('Local Abby Ollama harness returned an empty response.');
        }

        return [
            'provider' => 'ollama',
            'model' => $settings['model'],
            'base_url' => $settings['base_url'],
            'content' => $content,
            'usage' => [
                'prompt_eval_count' => $response->json('prompt_eval_count'),
                'eval_count' => $response->json('eval_count'),
                'total_duration' => $response->json('total_duration'),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array{format?: string|array<string, mixed>|null, temperature?: float, num_ctx?: int, timeout?: int, model?: string}  $options
     * @return array<string, mixed>
     */
    public function runJsonTask(string $task, array $payload, array $options = []): array
    {
        $safePayload = $this->safeValue($payload);
        $system = <<<'PROMPT'
You are Abby's local Study Design Compiler harness running on Ollama/MedGemma.
Summarize compiler state, plan next actions, and propose review wording only.
Do not perform research-grade protocol interpretation, invent OMOP concept IDs, or write canonical records.
Return strict JSON only.
PROMPT;
        $messages = [
            [
                'role' => 'system',
                'content' => $system,
            ],
            [
                'role' => 'user',
                'content' => json_encode([
                    'task' => $task,
                    'payload' => $safePayload,
                    'required_output' => [
                        'summary' => 'short user-facing guidance summary',
                        'actions' => 'array of next action objects',
                        'warnings' => 'array of caution strings',
                    ],
                ], JSON_THROW_ON_ERROR),
            ],
        ];

        $result = $this->chat($messages, ['format' => 'json', ...$options]);
        $decoded = $this->decodeJsonContent($result['content']);

        if ($decoded === []) {
            throw new RuntimeException('Local Abby Ollama harness did not return usable JSON.');
        }

        return [
            'task' => $task,
            'provider' => 'ollama',
            'model' => $result['model'],
            'harness_role' => 'local_control_plane',
            'output' => $decoded,
            'usage' => $result['usage'],
            'safety' => [
                'raw_protocol_text_included' => false,
                'canonical_writes_allowed' => false,
                'deep_protocol_evaluation_allowed' => false,
            ],
        ];
    }

    /**
     * @return array{provider: string, model: string, base_url: string, timeout: int}
     */
    public function metadata(): array
    {
        return $this->settings([]);
    }

    /**
     * @param  array{model?: string}  $options
     * @return array{provider: string, model: string, base_url: string, timeout: int}
     */
    private function settings(array $options): array
    {
        $provider = AiProviderSetting::query()
            ->where('provider_type', 'ollama')
            ->where('is_enabled', true)
            ->orderByDesc('is_active')
            ->first();
        /** @var array<string, mixed> $providerSettings */
        $providerSettings = $provider?->settings ?? [];
        $baseUrl = trim((string) ($providerSettings['base_url'] ?? ''));
        if ($baseUrl === '') {
            $baseUrl = trim((string) config('services.abby.ollama_url', 'http://host.docker.internal:11434'));
        }
        $model = trim((string) ($options['model'] ?? $provider?->model ?? ''));
        if ($model === '') {
            $model = trim((string) config('services.abby.ollama_model', 'puyangwang/medgemma-27b-it:q4_0'));
        }

        return [
            'provider' => 'ollama',
            'model' => $model !== '' ? $model : 'puyangwang/medgemma-27b-it:q4_0',
            'base_url' => rtrim($baseUrl, '/'),
            'timeout' => (int) config('services.abby.ollama_timeout', 120),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJsonContent(string $content): array
    {
        $decoded = json_decode(trim($content), true);
        if (is_array($decoded)) {
            return $decoded;
        }

        if (preg_match('/\{.*\}/s', $content, $matches) === 1) {
            $decoded = json_decode($matches[0], true);

            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }

    private function safeValue(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $safe = [];
        foreach ($value as $key => $item) {
            if (in_array($key, ['protocol_text', 'raw_protocol_text', 'source_rows', 'row_samples'], true)) {
                continue;
            }
            $safe[$key] = $this->safeValue($item);
        }

        return $safe;
    }
}
