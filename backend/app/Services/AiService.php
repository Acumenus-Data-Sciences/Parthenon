<?php

namespace App\Services;

use App\Models\App\AiProviderSetting;
use App\Services\AI\AbbyProviderPolicyService;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

class AiService
{
    private const ABBY_OPENAI_COMPATIBLE_BASE_URLS = [
        'deepseek' => 'https://api.deepseek.com',
        'mistral' => 'https://api.mistral.ai/v1',
        'moonshot' => 'https://api.moonshot.cn/v1',
        'qwen' => 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    ];

    private string $baseUrl;

    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = (string) config('services.ai.url');
        $this->timeout = (int) config('services.ai.timeout', 30);
    }

    /**
     * @return array<string, mixed>
     */
    public function health(): array
    {
        $response = Http::timeout($this->timeout)->get("{$this->baseUrl}/health");

        return $response->json();
    }

    /**
     * @return array<string, mixed>
     */
    public function encodeText(string $text): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/embeddings/encode", [
                'text' => $text,
            ]);

        return $response->json();
    }

    /**
     * @return array<string, mixed>
     */
    public function searchConcepts(string $query, int $topK = 10): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/embeddings/search", [
                'query' => $query,
                'top_k' => $topK,
            ]);

        return $response->json();
    }

    /**
     * @param  list<string>  $texts
     * @return array<string, mixed>
     */
    public function encodeBatch(array $texts): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/embeddings/encode-batch", [
                'texts' => $texts,
            ]);

        return $response->json();
    }

    /**
     * @param  list<string>  $terms
     * @return array<string, mixed>
     */
    public function mapConcepts(array $terms): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/concept-mapping/map", [
                'terms' => $terms,
            ]);

        return $response->json();
    }

    /**
     * Map a single source term to OMOP standard concepts.
     *
     * @param  list<string>|null  $samples
     * @return array<string, mixed>
     */
    public function mapTerm(
        string $sourceCode,
        ?string $description,
        ?string $vocabId,
        ?string $table,
        ?string $column,
        ?array $samples,
    ): array {
        $response = Http::timeout(120)
            ->post("{$this->baseUrl}/concept-mapping/map-term", [
                'source_code' => $sourceCode,
                'description' => $description,
                'vocabulary_id' => $vocabId,
                'table' => $table,
                'column' => $column,
                'samples' => $samples,
            ]);

        return $response->json();
    }

    /**
     * Map a batch of source terms to OMOP standard concepts.
     *
     * @param  list<array<string, mixed>>  $terms
     * @return array<string, mixed>
     */
    public function mapBatch(array $terms): array
    {
        $response = Http::timeout(120)
            ->post("{$this->baseUrl}/concept-mapping/map-batch", [
                'terms' => $terms,
            ]);

        return $response->json();
    }

    /**
     * Suggest CDM schema mappings for source columns.
     *
     * @param  list<array<string, mixed>>  $columns
     * @return array<string, mixed>
     */
    public function suggestSchemaMapping(array $columns): array
    {
        $response = Http::timeout($this->timeout)
            ->post("{$this->baseUrl}/schema-mapping/suggest", [
                'columns' => $columns,
            ]);

        return $response->json();
    }

    /**
     * Parse a natural-language cohort description using MedGemma.
     * Returns a structured spec: demographics, terms, temporal, study_design.
     *
     * @return array<string, mixed>
     */
    public function parseCohortPrompt(string $prompt, string $pageContext = 'cohort-builder'): array
    {
        $response = Http::timeout(120)
            ->post("{$this->baseUrl}/abby/parse-cohort", [
                'prompt' => $prompt,
                'page_context' => $pageContext,
            ]);

        return $response->json() ?? [];
    }

    /**
     * Page-aware conversational chat with Abby (MedGemma).
     *
     * @param  array<array{role: string, content: string}>  $history
     * @param  array<string, mixed>  $userProfile
     * @return array<string, mixed> {reply: string, suggestions: string[]}
     */
    public function abbyChat(
        string $message,
        string $pageContext = 'general',
        array $pageData = [],
        array $history = [],
        array $userProfile = [],
        ?int $userId = null,
        ?int $conversationId = null,
    ): array {
        $payload = [
            'message' => $message,
            'page_context' => $pageContext,
            'page_data' => $pageData ?: (object) [],
            'history' => $history,
        ];

        if (! empty($userProfile)) {
            $payload['user_profile'] = $userProfile;
        }

        if ($userId !== null) {
            $payload['user_id'] = $userId;
        }

        if ($conversationId !== null) {
            $payload['conversation_id'] = $conversationId;
        }

        $providerPolicy = $this->abbyProviderPolicyPayload();
        if ($providerPolicy !== null) {
            $payload['provider_policy'] = $providerPolicy;
        }

        $response = Http::timeout(300)
            ->post("{$this->baseUrl}/abby/chat", $payload);

        return $response->json() ?? ['reply' => 'Abby is unavailable.', 'suggestions' => []];
    }

    /**
     * Build the provider-neutral policy payload consumed by python-ai Abby chat.
     *
     * @return array<string, mixed>|null
     */
    private function abbyProviderPolicyPayload(): ?array
    {
        try {
            $surfacePolicy = app(AbbyProviderPolicyService::class)->payloadForSurface('chat');
            if ($surfacePolicy !== null) {
                return $surfacePolicy;
            }
        } catch (\Throwable) {
            // Preserve existing active-provider fallback during rollout/migration windows.
        }

        $provider = AiProviderSetting::query()
            ->where('is_active', true)
            ->where('is_enabled', true)
            ->first();

        if ($provider === null) {
            return null;
        }

        $settings = $provider->settings ?? [];
        $type = strtolower($provider->provider_type);
        $base = [
            'provider_type' => $type,
            'model' => $provider->model,
            'entitlement' => $settings['entitlement'] ?? 'org_api_key',
        ];

        if ($type === 'ollama') {
            return array_merge($base, [
                'profile_id' => 'local-medgemma',
                'mode' => 'local_only',
                'settings' => $this->onlyNonEmpty([
                    'base_url' => $settings['base_url'] ?? null,
                    'timeout' => $settings['timeout'] ?? null,
                    'max_output_tokens' => $settings['max_output_tokens'] ?? null,
                    'monthly_budget_usd' => $settings['monthly_budget_usd'] ?? null,
                ]),
            ]);
        }

        if ($type === 'anthropic') {
            return array_merge($base, [
                'profile_id' => 'anthropic-claude',
                'mode' => 'cloud_first',
                'settings' => $this->onlyNonEmpty([
                    'api_key' => $settings['api_key'] ?? null,
                    'timeout' => $settings['timeout'] ?? null,
                    'max_output_tokens' => $settings['max_output_tokens'] ?? null,
                    'monthly_budget_usd' => $settings['monthly_budget_usd'] ?? null,
                    'entitlement' => $settings['entitlement'] ?? null,
                ]),
            ]);
        }

        if ($type === 'openai') {
            return array_merge($base, [
                'profile_id' => 'openai-responses',
                'mode' => 'cloud_first',
                'settings' => $this->onlyNonEmpty([
                    'api_key' => $settings['api_key'] ?? null,
                    'base_url' => $settings['base_url'] ?? null,
                    'timeout' => $settings['timeout'] ?? null,
                    'max_output_tokens' => $settings['max_output_tokens'] ?? null,
                    'monthly_budget_usd' => $settings['monthly_budget_usd'] ?? null,
                    'entitlement' => $settings['entitlement'] ?? null,
                ]),
            ]);
        }

        if (array_key_exists($type, self::ABBY_OPENAI_COMPATIBLE_BASE_URLS)) {
            return array_merge($base, [
                'profile_id' => 'openai-compatible-chat',
                'mode' => 'cloud_first',
                'settings' => $this->onlyNonEmpty([
                    'api_key' => $settings['api_key'] ?? null,
                    'base_url' => $settings['base_url'] ?? self::ABBY_OPENAI_COMPATIBLE_BASE_URLS[$type],
                    'timeout' => $settings['timeout'] ?? null,
                    'max_output_tokens' => $settings['max_output_tokens'] ?? null,
                    'monthly_budget_usd' => $settings['monthly_budget_usd'] ?? null,
                    'entitlement' => $settings['entitlement'] ?? null,
                ]),
            ]);
        }

        return array_merge($base, [
            'profile_id' => 'local-medgemma',
            'mode' => 'local_only',
            'settings' => [],
        ]);
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function onlyNonEmpty(array $values): array
    {
        return array_filter(
            $values,
            fn ($value): bool => $value !== null && $value !== '',
        );
    }

    /**
     * Generic POST to the AI service.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function post(string $endpoint, array $data, int $timeout = 30): array
    {
        $response = Http::timeout($timeout)
            ->post("{$this->baseUrl}{$endpoint}", $data);

        return $response->json();
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    public function get(string $endpoint, array $query = [], int $timeout = 30): array
    {
        $response = Http::timeout($timeout)
            ->get("{$this->baseUrl}{$endpoint}", $query);

        return $response->json();
    }

    /**
     * @return array<string, mixed>
     */
    public function wikiWorkspaces(): Response
    {
        return Http::timeout(60)->get("{$this->baseUrl}/wiki/workspaces");
    }

    /**
     * @return array<string, mixed>
     */
    public function wikiInitWorkspace(string $workspace): Response
    {
        return Http::timeout(120)->post("{$this->baseUrl}/wiki/workspaces/{$workspace}/init");
    }

    /**
     * @return array<string, mixed>
     */
    public function wikiPages(string $workspace = 'platform', ?string $query = null, ?int $limit = null, int $offset = 0): Response
    {
        $params = ['workspace' => $workspace];
        if ($query !== null && $query !== '') {
            $params['q'] = $query;
        }
        if ($limit !== null) {
            $params['limit'] = $limit;
            $params['offset'] = $offset;
        }

        return Http::timeout(60)->get("{$this->baseUrl}/wiki/pages", $params);
    }

    /**
     * @return array<string, mixed>
     */
    public function wikiPage(string $slug, string $workspace = 'platform'): Response
    {
        return Http::timeout(60)->get("{$this->baseUrl}/wiki/pages/{$slug}", ['workspace' => $workspace]);
    }

    /**
     * @return array<string, mixed>
     */
    public function wikiActivity(string $workspace = 'platform', int $limit = 50): Response
    {
        return Http::timeout(60)->get("{$this->baseUrl}/wiki/activity", ['workspace' => $workspace, 'limit' => $limit]);
    }

    /**
     * @return array<string, mixed>
     */
    public function wikiIngest(
        string $workspace,
        ?UploadedFile $file,
        ?string $title,
        ?string $rawContent,
    ): Response {
        // FastAPI ingest endpoint uses Form() params — always send multipart
        $request = Http::timeout(300)->asMultipart();
        $multipart = [
            ['name' => 'workspace', 'contents' => $workspace],
        ];
        if ($title !== null && $title !== '') {
            $multipart[] = ['name' => 'title', 'contents' => $title];
        }
        if ($rawContent !== null && $rawContent !== '') {
            $multipart[] = ['name' => 'raw_content', 'contents' => $rawContent];
        }
        if ($file !== null) {
            $multipart[] = [
                'name' => 'file',
                'contents' => file_get_contents($file->getRealPath()),
                'filename' => $file->getClientOriginalName(),
            ];
        }

        return $request->post("{$this->baseUrl}/wiki/ingest", $multipart);
    }

    /**
     * @return array<string, mixed>
     */
    public function wikiQuery(
        string $workspace,
        string $question,
        ?string $pageSlug = null,
        ?string $sourceSlug = null,
    ): Response {
        $payload = [
            'workspace' => $workspace,
            'question' => $question,
        ];

        if ($pageSlug !== null && $pageSlug !== '') {
            $payload['page_slug'] = $pageSlug;
        }

        if ($sourceSlug !== null && $sourceSlug !== '') {
            $payload['source_slug'] = $sourceSlug;
        }

        return Http::timeout(180)->post("{$this->baseUrl}/wiki/query", $payload);
    }

    /**
     * @return array<string, mixed>
     */
    public function wikiLint(string $workspace): Response
    {
        return Http::timeout(180)->post("{$this->baseUrl}/wiki/lint", [
            'workspace' => $workspace,
        ]);
    }

    public function wikiSourceUrl(string $workspace, string $filename): string
    {
        return "{$this->baseUrl}/wiki/sources/{$workspace}/{$filename}";
    }
}
