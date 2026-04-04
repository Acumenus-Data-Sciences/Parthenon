<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class EmbeddingClient
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * Generate an embedding for a single patient's feature vector.
     *
     * @param  array<string, mixed>  $features  Patient feature data
     * @return float[]|null 512-dim embedding or null on failure
     */
    public function embed(array $features): ?array
    {
        try {
            $response = Http::timeout(30)
                ->post("{$this->baseUrl}/patient-similarity/embed", $features);

            if ($response->successful()) {
                /** @var float[]|null $embedding */
                $embedding = $response->json('embedding');

                return $embedding;
            }

            Log::warning('EmbeddingClient::embed: non-200 response', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return null;
        } catch (\Throwable $e) {
            Log::warning('EmbeddingClient::embed: request failed', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Generate embeddings for a batch of patients.
     *
     * @param  array<int, array<string, mixed>>  $patientFeatures  Array of patient feature data
     * @return array<int, float[]> Map of person_id => 512-dim embedding
     */
    public function embedBatch(array $patientFeatures): array
    {
        try {
            $response = Http::timeout(120)
                ->post("{$this->baseUrl}/patient-similarity/embed-batch", [
                    'patients' => $patientFeatures,
                ]);

            if ($response->successful()) {
                /** @var array<int, array{person_id: int, embedding: float[], dimension: int}> $raw */
                $raw = $response->json('embeddings', []);

                // Re-key by person_id so the caller can look up embeddings by patient
                $result = [];
                foreach ($raw as $entry) {
                    if (isset($entry['person_id'], $entry['embedding'])) {
                        $result[(int) $entry['person_id']] = $entry['embedding'];
                    }
                }

                return $result;
            }

            Log::warning('EmbeddingClient::embedBatch: non-200 response', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [];
        } catch (\Throwable $e) {
            Log::warning('EmbeddingClient::embedBatch: request failed', [
                'error' => $e->getMessage(),
            ]);

            return [];
        }
    }
}
