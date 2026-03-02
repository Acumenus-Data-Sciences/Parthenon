<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class AiService
{
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
                'prompt'       => $prompt,
                'page_context' => $pageContext,
            ]);

        return $response->json() ?? [];
    }

    /**
     * Page-aware conversational chat with Abby (MedGemma).
     *
     * @param  array<array{role: string, content: string}>  $history
     * @return array<string, mixed>  {reply: string, suggestions: string[]}
     */
    public function abbyChat(
        string $message,
        string $pageContext = 'general',
        array  $pageData   = [],
        array  $history    = [],
    ): array {
        $response = Http::timeout(120)
            ->post("{$this->baseUrl}/abby/chat", [
                'message'      => $message,
                'page_context' => $pageContext,
                'page_data'    => $pageData,
                'history'      => $history,
            ]);

        return $response->json() ?? ['reply' => 'Abby is unavailable.', 'suggestions' => []];
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
}
