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
}
